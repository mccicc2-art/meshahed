/**
 * ====== 🆕 برايم فيديو — قراءةُ السجلّ وبناءُ صفوف الاستيراد (المهمّة ٦٠٤، الفحص S0 في ٢٨ نوفمبر) ======
 *
 * 🔑 **لا واجهةَ سجلٍّ في برايم**: البياناتُ JSON داخل صفحات الموقع نفسِها، والصفحةُ تطلبها بجلسة العضو (`fetch` من الأصل نفسِه) وتقرؤها.
 * صفحتان تكفيان (مقيستان على حساب أحمد):
 * - **سجلُّ المشاهدة** (`/settings/watch-history`): أيّامٌ، في كلٍّ أعمالٌ — الموسمُ بحلقاته التي ظهرت في السجلّ (`children`)، والفيلمُ وحدَه —
 *   ولكلٍّ وقتُه (`time` بالميلي ثانية). **بلا نسبةِ مشاهدة**: الظهورُ في السجلّ لا يعني الإكمال (حلقةٌ شوهد منها ٢٤ ثانية كانت فيه).
 * - **صفحةُ العمل** (`/detail/<id>`): للموسم اسمُ المسلسل (`parentTitle`) ورقمُه وسنتُه، ولكلِّ حلقةٍ رقمُها ومدّتُها، و**حالُ تشغيلها**:
 *   `FeatureFinished` (اكتملت، `progress: 1`) · `FeatureInProgress` (بنسبتها) · `FeatureNotStarted`. وللفيلم مثلُها.
 * فالمشاهَدُ = «اكتملت» أو ٩٠٪ فأكثر (قاعدةُ نتفليكس وOSN+ وشاهد)، وما دونه «بدأته ولم تكمله».
 *
 * ⚖️ **بلا معرّف IMDb ولا TMDB**، والأسماءُ بلغة الملفّ (العربيّة على حساب أحمد) — فالمطابقةُ بالاسم والسنة كشاهد. وسنةُ الموسم ليست
 * سنةَ المسلسل إلّا في الموسم الأوّل، فلا تُرسل لغيره (اسمٌ بلا سنةٍ أصدقُ من سنةٍ خاطئة).
 * ⚠️ **ما يصل هنا مقلَّمٌ في الصفحة نفسِها**: لا رمزَ ولا رابطَ حذفٍ ولا معرّفَ ملفّ — أسماءٌ وأرقامٌ وأوقاتٌ وحالاتُ تشغيل.
 */
import type { RawRecord } from "./importParse.ts";

export const PRIME_ORIGIN = "https://www.primevideo.com";
export const PRIME_HISTORY_PATH = "/settings/watch-history";
export const PRIME_WATCHED_SHARE = 0.9;
/** ما دون دقيقةٍ ليس «بدأته» — تشغيلٌ عابرٌ أو تشغيلٌ تلقائيٌّ للحلقة التالية (قيس: الحلقةُ التالية بدأت وحدها ٣٥ ثانية) */
export const PRIME_MIN_STARTED_SEC = 60;

/** حلقةٌ ظهرت في السجلّ بوقتها */
export interface PrimeHistoryEpisode {
  gti: string;
  at: number;
}
/** عملٌ في السجلّ — الموسمُ بحلقاته، أو الفيلم */
export interface PrimeHistoryItem {
  gti: string;
  kind: "season" | "movie";
  title: string;
  /** مسارُ صفحته (`/detail/<id>`) بلا استعلام */
  path: string;
  at: number;
  episodes: PrimeHistoryEpisode[];
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const int = (v: unknown, max: number): number | null => {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};
/** `/detail/0TZZ…?ref_=…` ⇒ `/detail/0TZZ…` — وما ليس صفحةَ عملٍ في برايم لا يُقرأ */
export function detailPath(href: unknown): string | null {
  const h = str(href);
  const m = h ? /^(?:https:\/\/www\.primevideo\.com)?(\/(?:-\/[a-z]{2}\/)?detail\/[A-Za-z0-9]+)/.exec(h) : null;
  return m ? m[1] : null;
}

/** أيّامُ السجلّ (`widgets[…].content.content.titles`) ⇒ أعمالُه، الأحدثُ أوّلاً كما يعرضها برايم */
export function parsePrimeHistory(groups: unknown): PrimeHistoryItem[] {
  if (!Array.isArray(groups)) return [];
  const out: PrimeHistoryItem[] = [];
  for (const g of groups) {
    const titles = obj(g)?.titles;
    if (!Array.isArray(titles)) continue;
    for (const t of titles) {
      const o = obj(t);
      const gti = str(o?.gti);
      const kind = o?.titleType === "season" ? "season" : o?.titleType === "movie" ? "movie" : null;
      const title = str(obj(o?.title)?.text);
      const path = detailPath(obj(o?.title)?.href);
      const at = num(o?.time);
      if (!o || !gti || !kind || !title || !path || at == null) continue;
      const episodes: PrimeHistoryEpisode[] = [];
      if (kind === "season" && Array.isArray(o.children)) {
        for (const c of o.children) {
          const co = obj(c);
          const cg = str(co?.gti);
          const ca = num(co?.time);
          if (co?.titleType === "episode" && cg && ca != null) episodes.push({ gti: cg, at: ca });
        }
      }
      out.push({ gti, kind, title, path, at, episodes });
    }
  }
  return out;
}

/** عنوانٌ في صفحة العمل — الموسمُ والحلقةُ والفيلم */
export interface PrimeTitle {
  gti: string;
  type: "season" | "episode" | "movie";
  title: string;
  parent: string | null;
  season: number | null;
  episode: number | null;
  year: number | null;
  durationSec: number | null;
}
/** حالُ التشغيل كما يقولها برايم */
export interface PrimePlayback {
  status: "finished" | "progress" | "none";
  progress: number | null;
  resumeSec: number | null;
}
export interface PrimeDetail {
  pageId: string;
  titles: Map<string, PrimeTitle>;
  playback: Map<string, PrimePlayback>;
}

/**
 * صفحةُ العمل المقلَّمة ⇒ عناوينُها وحالُ تشغيلها. `raw`: `{ pageTitleId, detail: {gti: …}, playback: {gti: {playbackStatus, progress, resumeTime}} }`
 * كما يبنيها سكربتُ الصفحة من `btf.state.detail.detail` و`action.atf/btf[gti].primaryActions[0].payload.playback`.
 */
export function parsePrimeDetail(raw: unknown): PrimeDetail | null {
  const o = obj(raw);
  const pageId = str(o?.pageTitleId);
  const detail = obj(o?.detail);
  if (!o || !pageId || !detail) return null;
  const titles = new Map<string, PrimeTitle>();
  for (const [gti, v] of Object.entries(detail)) {
    const d = obj(v);
    const type = d?.titleType === "season" || d?.titleType === "episode" || d?.titleType === "movie" ? d.titleType : null;
    const title = str(d?.title);
    if (!d || !type || !title) continue;
    titles.set(gti, {
      gti,
      type,
      title,
      parent: str(d.parentTitle),
      season: int(d.seasonNumber, 1000),
      episode: int(d.episodeNumber, 20_000),
      year: int(d.releaseYear, 3000),
      durationSec: int(d.duration, 24 * 3600),
    });
  }
  const playback = new Map<string, PrimePlayback>();
  for (const [gti, v] of Object.entries(obj(o.playback) ?? {})) {
    const p = obj(v);
    if (!p) continue;
    const st = p.playbackStatus === "FeatureFinished" ? "finished" : p.playbackStatus === "FeatureInProgress" ? "progress" : "none";
    const progress = num(p.progress);
    playback.set(gti, { status: st, progress: progress != null && progress >= 0 && progress <= 1 ? progress : null, resumeSec: num(p.resumeTime) });
  }
  return { pageId, titles, playback };
}

/** شوهد: «اكتملت» عند برايم، أو ٩٠٪ فأكثر */
export function isPrimeWatched(p: PrimePlayback | undefined): boolean {
  return !!p && (p.status === "finished" || (p.progress != null && p.progress >= PRIME_WATCHED_SHARE));
}

/** بدأه ولم يكمله — ودقيقةٌ فأكثر (`resumeSec`، وإلّا النسبةُ من المدّة) */
export function isPrimeStarted(p: PrimePlayback | undefined, durationSec: number | null): boolean {
  if (!p || isPrimeWatched(p)) return false;
  const sec = p.resumeSec ?? (p.progress != null && durationSec ? p.progress * durationSec : null);
  return sec != null && sec >= PRIME_MIN_STARTED_SEC;
}

/** الأعمالُ التي فيها جديدٌ بعد آخر مزامنة — صفحاتُها وحدَها تُطلب (`after` null ⇒ كلُّها) */
export function primePagesToRead(items: PrimeHistoryItem[], after: number | null, also: string[] = []): string[] {
  const fresh = items.filter((i) => after == null || i.at > after || i.episodes.some((e) => e.at > after)).map((i) => i.path);
  return [...new Set([...fresh, ...also])];
}

/** ما بدأه العضو ولم يبلغ ٩٠٪ — شكلُ «بدأته ولم تكمله» في المنصّات الأخرى، ومعه صفحتُه ليُعاد فحصُها */
export interface PrimePartial {
  id: string;
  path: string;
  title: string;
  show: string | null;
  season: number | null;
  episode: number | null;
  share: number | null;
  at: string;
}

export interface PrimeBuild {
  records: RawRecord[];
  partial: PrimePartial[];
  skipped: number;
  newest: number | null;
  /** ما دخل (معرّفاتُ الحلقات والأفلام) — يخرج من «بدأته ولم تكمله» */
  recorded: string[];
}

/**
 * السجلُّ وصفحاتُه ⇐ صفوفُ استيراد.
 * - `after`: ما شوهد عند هذه اللحظة أو قبلها لا يُقرأ — إلّا ما يُعاد فحصُه (`recheck`: كان «بدأته ولم تكمله»).
 * - الحلقةُ: اسمُ المسلسل (`parentTitle`، وإلّا اسمُ الموسم) وسنتُه في الموسم الأوّل وحدَه، والموسمُ والحلقة ⇐ `ep-name`.
 * - الفيلمُ: اسمُه وسنتُه ⇐ `movie-name`.
 */
export function buildPrimeRecords(items: PrimeHistoryItem[], pages: Map<string, PrimeDetail>, opts: { after?: number | null; recheck?: Set<string> } = {}): PrimeBuild {
  const after = opts.after ?? null;
  const recheck = opts.recheck ?? new Set<string>();
  const records: RawRecord[] = [];
  const partial: PrimePartial[] = [];
  const recorded: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let newest: number | null = null;
  const fresh = (gti: string, at: number) => {
    if (newest == null || at > newest) newest = at;
    return after == null || at > after || recheck.has(gti);
  };
  for (const it of items) {
    const page = pages.get(it.path);
    if (it.kind === "movie") {
      if (seen.has(it.gti) || !fresh(it.gti, it.at)) continue;
      seen.add(it.gti);
      const m = page?.titles.get(page.pageId) ?? page?.titles.get(it.gti) ?? null;
      const pb = page?.playback.get(m?.gti ?? it.gti) ?? page?.playback.get(it.gti);
      if (!m) {
        skipped++;
        continue;
      }
      const at = new Date(it.at).toISOString();
      if (isPrimeWatched(pb)) {
        recorded.push(it.gti);
        records.push({ kind: "movie-name", name: m.title, at, ...(m.year ? { year: m.year } : {}) });
      } else if (isPrimeStarted(pb, m.durationSec)) {
        partial.push({ id: it.gti, path: it.path, title: m.title, show: null, season: null, episode: null, share: pb?.progress ?? null, at });
      } else skipped++;
      continue;
    }
    const season = page?.titles.get(page.pageId) ?? page?.titles.get(it.gti) ?? null;
    const show = season?.parent ?? season?.title ?? null;
    for (const e of it.episodes) {
      if (seen.has(e.gti) || !fresh(e.gti, e.at)) continue;
      seen.add(e.gti);
      const ep = page?.titles.get(e.gti);
      const pb = page?.playback.get(e.gti);
      const s = season?.season ?? ep?.season ?? null;
      if (!show || !ep || ep.episode == null || s == null) {
        skipped++;
        continue;
      }
      const at = new Date(e.at).toISOString();
      if (isPrimeWatched(pb)) {
        recorded.push(e.gti);
        records.push({ kind: "ep-name", show, s, e: ep.episode, at, ...(s === 1 && season?.year ? { year: season.year } : {}) });
      } else if (isPrimeStarted(pb, ep.durationSec)) {
        partial.push({ id: e.gti, path: it.path, title: ep.title, show, season: s, episode: ep.episode, share: pb?.progress ?? null, at });
      } else skipped++;
    }
  }
  return { records, partial, skipped, newest, recorded };
}
