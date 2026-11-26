/**
 * ====== 🆕 مزامنةُ شاهد — قراءةُ ما يعيده موقعُ شاهد نفسُه، وتحويلُه إلى صفوف استيراد (المهمّة ٥٦٧، الفحص S0 في ٢٦ نوفمبر) ======
 *
 * 🔑 **لا يُقرأ شيءٌ من خادمنا**: متصفّحُ التطبيق على جهاز العضو يطلب واجهةَ شاهد بجلسته هو (رمزُه في كوكي الموقع ولا يغادر
 * الجهاز)، وهذا الملفُّ نقيٌّ لا يعرف الشبكة — يأخذ الردودَ ويعيد صفوفاً يفهمها مسارُ الاستيراد الواحد (`importRecords`، D-145).
 * أخو `core/osn.ts`: القاعدةُ نفسُها (٩٠٪ أو «اكتملت» = شوهدت) وشكلُ «بدأته ولم تكمله» نفسُه.
 *
 * ما يعطيه شاهد (مقيسٌ على حساب أحمد، `claude/STUDY-SHAHID-S0-2026-11-26.md`):
 * - **«تابع المشاهدة»** (`continuewatching/watchingitems`): ما بدأه الملفّ — للمسلسل حلقتُه التالية (رقمُ الموسم والحلقة) وللفيلم
 *   معرّفُه. **بلا وقت** — فما تغيّر منذ آخر مزامنة يُعرف بلقطةٍ تُحفظ على الجهاز (`cwSnapshot`).
 * - **تقدُّمُ كلِّ حلقة** (`heartbeat/query/event-logs` بمعرّفاتها): المدّةُ المشاهَدة والمدّةُ الكاملة و«اكتملت» ووقتُ آخر مشاهدة.
 *   الحلقةُ المكتملة تخرج من «تابع المشاهدة» وتبقى هنا — فالمسلسلُ يُقرأ حلقةً حلقة.
 * - **العملُ ومواسمُه وحلقاتُه** (`product/id` · `product/playlist`): عامّةٌ بلا دخول. الاسمُ بلغة الطلب، والسنةُ سنةُ الإنتاج.
 *   **بلا معرّف IMDb ولا TMDB**، والاسمُ الإنجليزيُّ عندهم كتابةٌ صوتيّة («Anbar Al Mout») — فالمطابقةُ بالاسم العربيّ والسنة.
 */
import type { RawRecord } from "./importParse.ts";

/** نسبةُ «شوهدت» — قاعدةُ نتفليكس وOSN+ نفسُها، أو علامةُ شاهد «اكتملت» */
export const SHAHID_WATCHED_SHARE = 0.9;

export const SHAHID_API = "https://api3.shahid.net/";

export const SHAHID_EP = {
  /** `GET` — بجلسة العضو */
  watching: "proxy/v2.1/continuewatching/watchingitems",
  /** `GET` — بجلسة العضو، ومعرّفاتُ الحلقات إجباريّة (طلبٌ بلا معرّفاتٍ يعود فارغاً) */
  progress: "v3/heartbeat/query/event-logs",
  /** `GET` — عامّ */
  product: "proxy/v2.1/product/id",
  /** `GET` — عامّ */
  playlist: "proxy/v2.1/product/playlist",
} as const;

/** معرّفاتٌ في طلب التقدّم — حدُّ صفحته مئة */
export const SHAHID_IDS_PER_REQUEST = 100;

/** 🆕 أقصرُ تشغيلٍ يُعدّ «بدأته» — ما دونه فتحٌ لا مشاهدة (قاعدةُ OSN+) */
export const SHAHID_MIN_STARTED_SEC = 60;
export const SHAHID_MAX_RUNTIME_SEC = 6 * 3600;

export interface ShahidCwItem {
  /** معرّفُ العمل (المسلسل أو الفيلم) */
  programId: string;
  /** معرّفُ الحلقة أو الفيلم */
  contentId: string;
  kind: "episode" | "movie";
  season: number | null;
  episode: number | null;
  progressSec: number;
}

export interface ShahidProgress {
  assetId: string;
  watchedSec: number | null;
  runtimeSec: number | null;
  done: boolean;
  /** وقتُ آخر مشاهدة (ملّي ثانية) */
  at: number;
}

export interface ShahidProgram {
  id: string;
  kind: "show" | "movie";
  title: string;
  year: number | null;
  /** مواسمُ المسلسل: المعرّفُ ورقمُه */
  seasons: { id: string; number: number }[];
  /** مدّةُ الفيلم (ثانية) */
  runtimeSec: number | null;
}

export interface ShahidEpisode {
  assetId: string;
  programId: string;
  season: number;
  number: number;
  runtimeSec: number | null;
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const yearOf = (v: unknown): number | null => {
  const s = str(v);
  const y = s ? Number(s.slice(0, 4)) : null;
  return y != null && y > 1870 && y < 2200 ? y : null;
};

export function parseWatchingItems(json: unknown): ShahidCwItem[] {
  const list = obj(json)?.watchingItems;
  if (!Array.isArray(list)) return [];
  const out: ShahidCwItem[] = [];
  for (const v of list) {
    const o = obj(v);
    const programId = str(o?.programId);
    const contentId = str(o?.contentId);
    if (!o || !programId || !contentId) continue;
    const type = String(o.contentType ?? "").toUpperCase();
    const kind = type === "MOVIE" ? "movie" : type === "EPISODE" ? "episode" : null;
    if (!kind) continue;
    out.push({ programId, contentId, kind, season: num(o.seasonNumber), episode: num(o.episodeNumber), progressSec: num(o.progressSeconds) ?? 0 });
  }
  return out;
}

export function parseProgress(json: unknown): { rows: ShahidProgress[]; more: boolean } {
  const o = obj(json);
  /* «progrersses» بخطئها الإملائيّ كما يعيده شاهد — والصحيحةُ احتياطٌ ليومٍ يصلحونها */
  const list = o?.progrersses ?? o?.progresses;
  const rows: ShahidProgress[] = [];
  for (const v of Array.isArray(list) ? list : []) {
    const p = obj(v);
    const assetId = str(p?.assetId);
    if (!p || !assetId || p.deleted === true) continue;
    const at = typeof p.updated === "string" ? Date.parse(p.updated) : NaN;
    const dur = num(p.duration);
    rows.push({ assetId, watchedSec: num(p.timeWatched), runtimeSec: dur != null && dur > 0 ? dur : null, done: p.completed === true, at: Number.isFinite(at) ? at : 0 });
  }
  return { rows, more: o?.hasMore === true };
}

/** `product/id` ⇐ العمل — المسلسلُ بمواسمه، والفيلمُ بمدّته. ما ليس هذا ولا ذاك يُسقط */
export function parseProgram(json: unknown): ShahidProgram | null {
  const p = obj(obj(json)?.productModel);
  const id = str(p?.id);
  if (!p || !id) return null;
  const type = String(p.productType ?? "").toUpperCase();
  const kind = type === "MOVIE" ? "movie" : type === "SHOW" ? "show" : null;
  if (!kind) return null;
  const seasons: { id: string; number: number }[] = [];
  for (const v of Array.isArray(p.seasons) ? p.seasons : []) {
    const s = obj(v);
    const sid = str(s?.id);
    const n = num(s?.seasonNumber);
    if (sid && n != null) seasons.push({ id: sid, number: n });
  }
  /* مسلسلٌ بموسمٍ واحدٍ قد يأتي موسمُه في `season` وحده */
  const one = obj(p.season);
  const oneId = str(one?.id);
  const oneN = num(one?.seasonNumber);
  if (oneId && oneN != null && !seasons.some((s) => s.id === oneId)) seasons.push({ id: oneId, number: oneN });
  const dur = num(p.duration);
  return { id, kind, title: (str(p.title) ?? "").trim(), year: yearOf(p.productionDate) ?? yearOf(p.releaseDate), seasons, runtimeSec: dur != null && dur > 0 ? dur : null };
}

/** `product/id` لموسم ⇐ معرّفاتُ قوائم حلقاته (قد تكون أكثرَ من قائمة: مجّانيّةٌ وكاملة) */
export function parseSeasonPlaylists(json: unknown): string[] {
  const p = obj(obj(json)?.productModel);
  const list = p?.playlists ?? obj(p?.season)?.playlists;
  return (Array.isArray(list) ? list : [])
    .map(obj)
    .filter((x) => String(x?.type ?? "").toUpperCase() === "EPISODE")
    .map((x) => str(x?.id))
    .filter((x): x is string => !!x);
}

/** `product/playlist` ⇐ حلقاتُ الصفحة */
export function parsePlaylist(json: unknown, programId: string, season: number): { episodes: ShahidEpisode[]; more: boolean } {
  const l = obj(obj(json)?.productList);
  const episodes: ShahidEpisode[] = [];
  for (const v of Array.isArray(l?.products) ? l.products : []) {
    const e = obj(v);
    const assetId = str(e?.id);
    const n = num(e?.number);
    if (!e || !assetId || n == null) continue;
    const dur = num(e.duration);
    episodes.push({ assetId, programId, season, number: n, runtimeSec: dur != null && dur > 0 ? dur : null });
  }
  return { episodes, more: l?.hasMore === true };
}

export function watchedShare(p: Pick<ShahidProgress, "watchedSec" | "runtimeSec">): number | null {
  if (p.watchedSec == null || p.runtimeSec == null || p.runtimeSec <= 0) return null;
  return Math.max(0, Math.min(1, p.watchedSec / p.runtimeSec));
}

export function isWatched(p: Pick<ShahidProgress, "watchedSec" | "runtimeSec" | "done">): boolean {
  if (p.done) return true;
  const s = watchedShare(p);
  return s != null && s >= SHAHID_WATCHED_SHARE;
}

/** تقدُّمٌ لا يدلّ على مشاهدة: لم يكتمل، ودون دقيقةٍ أو بلا مدّةٍ معقولة */
export function isNoise(p: Pick<ShahidProgress, "watchedSec" | "runtimeSec" | "done">): boolean {
  if (p.done) return false;
  return p.watchedSec == null || p.watchedSec < SHAHID_MIN_STARTED_SEC || p.runtimeSec == null || p.runtimeSec > SHAHID_MAX_RUNTIME_SEC;
}

export function chunks<T>(ids: T[], size = SHAHID_IDS_PER_REQUEST): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * لقطةُ «تابع المشاهدة» — عملٌ ⇐ حلقتُه وموضعُها. شاهد لا يعطي وقتاً لما فيها، فما تغيّر بين لقطتين هو ما يُقرأ من جديد: حلقةٌ
 * اكتملت تُخرجها وتُدخل التاليةَ، وتقدّمٌ في حلقةٍ يغيّر موضعَها.
 */
export function cwSnapshot(items: ShahidCwItem[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of items) out[i.programId] = `${i.contentId}:${Math.round(i.progressSec)}`;
  return out;
}

/**
 * الأعمالُ التي تُقرأ: الجديدةُ والمتغيّرةُ منذ اللقطة السابقة، **والخارجةُ منها** — فيلمٌ اكتمل أو مسلسلٌ انتهت آخرُ حلقاته يخرج من
 * «تابع المشاهدة» ولا يعود، وخروجُه هو الخبر. وكلُّ ما فيها في القراءة الأولى (`prev` غائبة).
 */
export function programsToRead(items: ShahidCwItem[], prev: Record<string, string> | null, also: string[] = []): string[] {
  const now = cwSnapshot(items);
  const changed = Object.keys(now).filter((id) => !prev || prev[id] !== now[id]);
  const gone = prev ? Object.keys(prev).filter((id) => !(id in now)) : [];
  return [...new Set([...changed, ...gone, ...also])];
}

/** ما بدأه العضو ولم يبلغ ٩٠٪ — شكلُ `NetflixPartial` نفسُه، ومعه معرّفُ عمله ليُعاد السؤالُ عنه */
export interface ShahidPartial {
  id: string;
  programId: string;
  title: string;
  show: string | null;
  season: number | null;
  episode: number | null;
  share: number | null;
  at: string;
}

export interface ShahidBuild {
  records: RawRecord[];
  partial: ShahidPartial[];
  skipped: number;
  newest: number | null;
  recorded: string[];
}

/**
 * التقدُّمُ ⇐ صفوفُ استيراد.
 * - `after`: ما شوهد عند هذه اللحظة أو قبلها لا يُقرأ — إلا ما يُعاد فحصُه (`recheck`: كان «بدأته ولم تكمله»).
 * - الحلقةُ: مسلسلُها باسمه العربيّ وسنة إنتاجه، وموسمُها ورقمُها ⇐ `ep-name`.
 * - الفيلمُ: اسمُه العربيّ وسنتُه ⇐ `movie-name`.
 */
export function buildShahidRecords(
  progress: ShahidProgress[],
  programs: Map<string, ShahidProgram>,
  episodes: Map<string, ShahidEpisode>,
  movieOf: Map<string, string>,
  opts: { after?: number | null; recheck?: Set<string> } = {},
): ShahidBuild {
  const after = opts.after ?? null;
  const recheck = opts.recheck ?? new Set<string>();
  const records: RawRecord[] = [];
  const partial: ShahidPartial[] = [];
  const recorded: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let newest: number | null = null;
  for (const p of progress) {
    if (seen.has(p.assetId)) continue;
    seen.add(p.assetId);
    if (p.at > 0 && (newest == null || p.at > newest)) newest = p.at;
    if (after != null && p.at <= after && !recheck.has(p.assetId)) continue;
    const ep = episodes.get(p.assetId);
    const movieId = movieOf.get(p.assetId);
    /* مدّةُ الحلقة من قائمتها حين لا يعطيها التقدّم */
    const runtimeSec = p.runtimeSec ?? ep?.runtimeSec ?? (movieId ? (programs.get(movieId)?.runtimeSec ?? null) : null);
    const q = { ...p, runtimeSec };
    if (isNoise(q)) {
      skipped++;
      continue;
    }
    const at = new Date(p.at || Date.now()).toISOString();
    if (ep) {
      const sh = programs.get(ep.programId);
      if (!sh || !sh.title) {
        skipped++;
        continue;
      }
      if (!isWatched(q)) {
        partial.push({ id: p.assetId, programId: sh.id, title: sh.title, show: sh.title, season: ep.season, episode: ep.number, share: watchedShare(q), at });
        continue;
      }
      recorded.push(p.assetId);
      records.push({ kind: "ep-name", show: sh.title, s: ep.season, e: ep.number, at, ...(sh.year ? { year: sh.year } : {}) });
    } else if (movieId) {
      const m = programs.get(movieId);
      if (!m || !m.title) {
        skipped++;
        continue;
      }
      if (!isWatched(q)) {
        partial.push({ id: p.assetId, programId: m.id, title: m.title, show: null, season: null, episode: null, share: watchedShare(q), at });
        continue;
      }
      recorded.push(p.assetId);
      records.push({ kind: "movie-name", name: m.title, at, ...(m.year ? { year: m.year } : {}) });
    } else {
      skipped++;
    }
  }
  return { records, partial, skipped, newest, recorded };
}
