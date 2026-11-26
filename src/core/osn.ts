/**
 * ====== 🆕 مزامنةُ OSN+ — قراءةُ ما يعيده موقعُ OSN+ نفسُه، وتحويلُه إلى صفوف استيراد (المهمّة ٥٥٧، الفحص S0 في ٢٦ نوفمبر) ======
 *
 * 🔑 **لا يُقرأ شيءٌ من خادمنا**: متصفّحُ التطبيق على جهاز العضو يطلب واجهةَ OSN+ بجلسته هو (رموزُه في كوكي الموقع ولا تغادر
 * الجهاز)، وهذا الملفُّ نقيٌّ لا يعرف الشبكة — يأخذ الردودَ ويعيد صفوفاً يفهمها مسارُ الاستيراد الواحد (`importRecords`، D-145).
 * أخو `core/netflix.ts`: القاعدةُ نفسُها (٩٠٪ = شوهدت) وشكلُ «بدأته ولم تكمله» نفسُه.
 *
 * ما يعطيه OSN+ (مقيسٌ على حساب أحمد، `claude/STUDY-OSN-S0-2026-11-26.md`):
 * - **علامةٌ لكلِّ ما بدأه الملفّ** (`get-latest-bookmarks`): للمسلسل آخرُ حلقةٍ فيه (معرّفُها ومعرّفا موسمها ومسلسلها)، وللفيلم
 *   معرّفُه — ومع كلٍّ موضعُ التوقّف والمدّةُ وعلامةُ «اكتملت» ووقتُ المشاهدة.
 * - **علامةُ كلِّ حلقة** (`get-bookmarks` بمعرّفاتها): الحقولُ نفسُها — فالمسلسلُ يُقرأ حلقةً حلقة لا آخرُ حلقةٍ وحدها.
 * - **المسلسلُ ومواسمُه** (`get-series`) و**حلقاتُ الموسم** (`get-episodes-by-season`) و**الفيلم** (`get-movies`): الأسماءُ
 *   بالعربيّة والإنجليزيّة، وأرقامُ المواسم والحلقات، والسنة. **بلا معرّف IMDb ولا TMDB** — فالمطابقةُ بالاسم الإنجليزيّ والسنة،
 *   والمسلسلُ بحلقةٍ منه (اسمُها الإنجليزيّ برقمَيها) كنتفليكس.
 * - الحقلُ المجهولُ في الطلب يُرفض («unknown field») — فالأجسامُ هنا بحرف ما قيس.
 */
import type { RawRecord } from "./importParse.ts";

/** نسبةُ «شوهدت» — قاعدةُ نتفليكس نفسُها (أحمد ٢٢ نوفمبر «١ ب»)، أو علامةُ OSN+ «اكتملت» */
export const OSN_WATCHED_SHARE = 0.9;

export const OSN_API = "https://api.osnplus.com/osn/";

/** المساراتُ كما في الموقع — كلُّها `POST` بجسم JSON */
export const OSN_EP = {
  latest: "media/v1/get-latest-bookmarks",
  bookmarks: "media/v1/get-bookmarks",
  series: "media/v1/get-series",
  seasons: "media/v1/get-episodes-by-season",
  movies: "media/v1/get-movies",
  profiles: "account/v1/get-profiles",
} as const;

/** معرّفاتٌ في الطلب الواحد — دفعةٌ معقولةٌ لا تُثقل على OSN+ في الاستيراد الأوّل */
export const OSN_IDS_PER_REQUEST = 50;

export interface OsnBookmark {
  kind: "episode" | "movie";
  /** معرّفُ الحلقة أو الفيلم */
  id: string;
  seasonId: string | null;
  seriesId: string | null;
  /** وقتُ المشاهدة (ملّي ثانية) */
  at: number;
  positionSec: number | null;
  runtimeSec: number | null;
  done: boolean;
}

export interface OsnSeries {
  id: string;
  title: string;
  /** سنةُ أوّل موسم — للمطابقة؛ سنةُ المسلسل في الردّ سنةُ آخر موسم */
  year: number | null;
  /** معرّفُ الموسم ⇐ رقمُه */
  seasons: Map<string, number>;
}

export interface OsnEpisode {
  id: string;
  number: number;
  seasonId: string;
  title: string;
}

export interface OsnMovie {
  id: string;
  title: string;
  year: number | null;
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
/** الاسمُ الإنجليزيّ أوّلاً — الملفُّ العربيّ يعطي «ذا هنتينغ وايفز» لـ«The Hunting Wives»، والمطابقةُ في TMDB بالإنجليزيّ */
const en = (v: unknown): string => {
  const o = obj(v);
  const s = o ? (str(o.en) ?? str(o.ar)) : str(v);
  return (s ?? "").trim();
};
const yearOf = (v: unknown): number | null => {
  const y = num(v);
  return y != null && y > 1870 && y < 2200 ? Math.trunc(y) : null;
};

/** صفُّ علامةٍ من `get-latest-bookmarks` أو `get-bookmarks` — وما ليس حلقةً ولا فيلماً يُسقط */
function bookmarkOf(v: unknown): OsnBookmark | null {
  const b = obj(v);
  const c = obj(b?.content);
  if (!b || !c) return null;
  const ep = obj(c.episode);
  const mv = obj(c.movie);
  const at = num(b.clientTimestampMs);
  const pos = num(b.timeInMediaMs);
  const dur = num(b.contentDurationMs);
  const base = { at: at ?? 0, positionSec: pos != null ? pos / 1000 : null, runtimeSec: dur != null && dur > 0 ? dur / 1000 : null, done: b.finishedViewing === true };
  if (ep) {
    const id = str(ep.contentId);
    if (!id) return null;
    return { kind: "episode", id, seasonId: str(ep.seasonContentId), seriesId: str(ep.seriesContentId), ...base };
  }
  if (mv) {
    const id = str(mv.contentId);
    if (!id) return null;
    return { kind: "movie", id, seasonId: null, seriesId: null, ...base };
  }
  return null;
}

export function parseBookmarks(json: unknown): OsnBookmark[] {
  const list = obj(json)?.bookmarks;
  return Array.isArray(list) ? list.map(bookmarkOf).filter((x): x is OsnBookmark => !!x) : [];
}

export function parseSeries(json: unknown): Map<string, OsnSeries> {
  const out = new Map<string, OsnSeries>();
  const all = obj(obj(json)?.series);
  for (const v of Object.values(all ?? {})) {
    const s = obj(v);
    const id = str(s?.contentId);
    if (!s || !id) continue;
    const seasons = new Map<string, number>();
    let first: number | null = null;
    for (const x of Array.isArray(s.seasons) ? s.seasons : []) {
      const o = obj(x);
      const sid = str(o?.contentId);
      const n = num(o?.seasonNumber);
      if (sid && n != null) seasons.set(sid, n);
      const y = yearOf(o?.year);
      if (y != null && (first == null || y < first)) first = y;
    }
    out.set(id, { id, title: en(s.title), year: first ?? yearOf(s.year), seasons });
  }
  return out;
}

export function parseSeasonEpisodes(json: unknown): Map<string, OsnEpisode> {
  const out = new Map<string, OsnEpisode>();
  const all = obj(obj(json)?.episodesBySeason);
  for (const [sid, v] of Object.entries(all ?? {})) {
    for (const x of Array.isArray(obj(v)?.episodes) ? (obj(v)?.episodes as unknown[]) : []) {
      const e = obj(x);
      const id = str(e?.contentId);
      const n = num(e?.episodeNumber);
      if (!e || !id || n == null) continue;
      out.set(id, { id, number: n, seasonId: str(e.seasonContentId) ?? sid, title: en(e.title) });
    }
  }
  return out;
}

export function parseMovies(json: unknown): Map<string, OsnMovie> {
  const out = new Map<string, OsnMovie>();
  const all = obj(obj(json)?.movies);
  for (const v of Object.values(all ?? {})) {
    const m = obj(v);
    const id = str(m?.contentId);
    if (!m || !id) continue;
    out.set(id, { id, title: en(m.title), year: yearOf(m.year) });
  }
  return out;
}

export function watchedShare(b: Pick<OsnBookmark, "positionSec" | "runtimeSec">): number | null {
  if (b.positionSec == null || b.runtimeSec == null || b.runtimeSec <= 0) return null;
  return Math.max(0, Math.min(1, b.positionSec / b.runtimeSec));
}

/** شوهدت: علامةُ OSN+ «اكتملت»، أو ٩٠٪ فأكثر من المدّة */
export function isWatched(b: Pick<OsnBookmark, "positionSec" | "runtimeSec" | "done">): boolean {
  if (b.done) return true;
  const s = watchedShare(b);
  return s != null && s >= OSN_WATCHED_SHARE;
}

/** دفعاتٌ من المعرّفات لطلبات `contentIds` */
export function chunks<T>(ids: T[], size = OSN_IDS_PER_REQUEST): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** مسلسلاتٌ فيها جديدٌ بعد الحدّ — مسلسلٌ آخرُ علامةٍ فيه قبل آخر مزامنة لا يُقرأ من جديد */
export function seriesToRead(latest: OsnBookmark[], after: number | null): string[] {
  return [...new Set(latest.filter((b) => b.kind === "episode" && b.seriesId && (after == null || b.at > after)).map((b) => b.seriesId as string))];
}

/** ما بدأه العضو ولم يبلغ ٩٠٪ — شكلُ `NetflixPartial` نفسُه، لصفّ «بدأته ولم تكمله» */
export interface OsnPartial {
  /** 🆕 المهمّة ٥٥٩ — معرّفُ الحلقة أو الفيلم في OSN+: يُعاد السؤالُ عنه في المزامنة التالية */
  id: string;
  title: string;
  show: string | null;
  season: number | null;
  episode: number | null;
  share: number | null;
  at: string;
}

export interface OsnBuild {
  records: RawRecord[];
  partial: OsnPartial[];
  /** ما لم يُفهم: حلقةٌ بلا مسلسلٍ أو موسمٍ أو رقمٍ مقروء، أو فيلمٌ بلا اسم */
  skipped: number;
  newest: number | null;
  /** 🆕 المهمّة ٥٥٩ — معرّفاتُ ما دخل المكتبة في هذه القراءة: يخرج من قائمة «بدأته ولم تكمله» */
  recorded: string[];
}

/** 🆕 المهمّة ٥٥٩ — أقصرُ تشغيلٍ يُعدّ «بدأته»: ما دونه فتحٌ لا مشاهدة */
export const OSN_MIN_STARTED_SEC = 60;
/** مدّةٌ أطولُ من هذا ليست مدّةً — OSN+ يحفظ الحلقةَ التالية التي بدأت وحدها بمدّة 2^31 ملّي ثانية (فيديو خالد ٢٦ نوفمبر) */
export const OSN_MAX_RUNTIME_SEC = 6 * 3600;

/** علامةٌ لا تدلّ على مشاهدة: لم تكتمل، وموضعُها دون دقيقة أو مدّتُها مجهولةٌ أو غيرُ معقولة */
export function isNoise(b: Pick<OsnBookmark, "positionSec" | "runtimeSec" | "done">): boolean {
  if (b.done) return false;
  return b.positionSec == null || b.positionSec < OSN_MIN_STARTED_SEC || b.runtimeSec == null || b.runtimeSec > OSN_MAX_RUNTIME_SEC;
}

/**
 * العلاماتُ ⇐ صفوفُ استيراد.
 * - `after`: ما شوهد عند هذه اللحظة أو قبلها لا يُقرأ (آخرُ مزامنة أو «من الآن فقط»).
 * - الحلقةُ: مسلسلُها وموسمُها ورقمُها مقروءة ⇐ `ep-name` بسنة أوّل موسم، ومعرّفُ المسلسل (`osn-…`) واسمُ الحلقة الإنجليزيّ يطابقان
 *   المسلسلَ في TMDB كحلقات نتفليكس (`tvByEpisode`). المعرّفُ مسبوقٌ بـ`osn-` فلا يلتقي بمعرّفٍ من نتفليكس في الدفعة نفسِها.
 * - الفيلمُ: اسمُه الإنجليزيّ وسنتُه.
 */
export function buildOsnRecords(
  bookmarks: OsnBookmark[],
  series: Map<string, OsnSeries>,
  episodes: Map<string, OsnEpisode>,
  movies: Map<string, OsnMovie>,
  opts: { after?: number | null; recheck?: Set<string> } = {},
): OsnBuild {
  const after = opts.after ?? null;
  const recheck = opts.recheck ?? new Set<string>();
  const recorded: string[] = [];
  const records: RawRecord[] = [];
  const partial: OsnPartial[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let newest: number | null = null;
  for (const b of bookmarks) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    if (b.at > 0 && (newest == null || b.at > newest)) newest = b.at;
    /* 🆕 المهمّة ٥٥٩ — ما كان «بدأته ولم تكمله» يُعاد النظرُ فيه مهما كان وقتُ علامته: OSN+ يحفظ التقديمَ بعد دقيقةٍ من
       التشغيل (فيديو خالد ٢٦ نوفمبر)، وقد يصل حفظُه بعد المزامنة التي رأته ناقصاً */
    if (after != null && b.at <= after && !recheck.has(b.id)) continue;
    if (isNoise(b)) {
      skipped++;
      continue;
    }
    const at = new Date(b.at || Date.now()).toISOString();
    if (b.kind === "episode") {
      const sh = b.seriesId ? series.get(b.seriesId) : undefined;
      const ep = episodes.get(b.id);
      const sid = ep?.seasonId ?? b.seasonId;
      const s = sh && sid ? sh.seasons.get(sid) : undefined;
      if (!sh || !sh.title || !ep || s == null) {
        skipped++;
        continue;
      }
      if (!isWatched(b)) {
        partial.push({ id: b.id, title: ep.title || sh.title, show: sh.title, season: s, episode: ep.number, share: watchedShare(b), at });
        continue;
      }
      recorded.push(b.id);
      records.push({
        kind: "ep-name",
        show: sh.title,
        s,
        e: ep.number,
        at,
        ...(sh.year ? { year: sh.year } : {}),
        ...(ep.title ? { nfx: { show: `osn-${sh.id}`, title: ep.title } } : {}),
      });
    } else {
      const m = movies.get(b.id);
      if (!m || !m.title) {
        skipped++;
        continue;
      }
      if (!isWatched(b)) {
        partial.push({ id: b.id, title: m.title, show: null, season: null, episode: null, share: watchedShare(b), at });
        continue;
      }
      recorded.push(b.id);
      records.push({ kind: "movie-name", name: m.title, at, ...(m.year ? { year: m.year } : {}) });
    }
  }
  return { records, partial, skipped, newest, recorded };
}
