/**
 * ====== 🆕 مزامنةُ نتفليكس — قراءةُ ما تعيده صفحاتُ نتفليكس نفسُها، وتحويلُه إلى صفوف استيراد (خطّة `PLAN-NETFLIX-SYNC.md`) ======
 *
 * 🔑 **لا يُقرأ شيءٌ من خادمنا**: متصفّحُ التطبيق على جهاز العضو يطلب صفحاتِ نتفليكس بجلسته هو (كوكي نتفليكس لا يغادر الجهاز)،
 * وهذا الملفُّ نقيٌّ لا يعرف الشبكة — يأخذ الردودَ ويعيد صفوفاً يفهمها مسارُ الاستيراد الواحد (`importRecords`، D-145).
 * فيُختبر بعيّناتٍ حقيقيّةٍ من حساب أحمد (`netflix.test.ts`، الفحص S0 في ٢٥ نوفمبر).
 *
 * ما تعطيه نتفليكس (مقيسٌ لا مفترض):
 * - **السجلّ** (`ViewingHistoryPaginated`): لكلِّ مشاهدةٍ معرّفُ الفيديو واسمُه ونوعُه، ومعرّفُ موسمه ومسلسله واسماهما، ووقتُ
 *   المشاهدة بالملّي ثانية. **بلا رقم حلقة ولا مدّة.**
 * - **الموسم** (`PreviewModalEpisodeSelectorSeasonEpisodes`): رقمُه، ولكلِّ حلقةٍ رقمُها واسمُها ومدّتُها و**أين توقّف العضو**.
 *   فمعرّفُ الحلقة يقرن الردّين بلا تخمين، والنسبةُ تحكم: **٩٠٪ فأكثر = شوهدت** (أحمد ٢٢ نوفمبر «١ ب»).
 * - **الأفلام** (`PreviewModalVideoTitleGroup`، مقيس ٢٥ نوفمبر على ملفّ خالد): أفلامٌ كثيرةٌ في طلبٍ واحد (`videoIds`)، ولكلٍّ
 *   أين توقّف العضو (`bookmark.position`) ومدّتُه (`displayRuntimeSec`) وسنتُه (`latestYear`). والقاعدةُ نفسُها: ٩٠٪.
 * - **الأسماء بالإنجليزيّة دائماً** (ترويسةُ اللغة): الملفُّ العربيّ يعطي «الوسيط الروحي» لـ«The Mentalist» — اسمٌ يطابق عملاً آخر.
 * - **رقمُ الطلب المحفوظ يتغيّر** مع نشرات نتفليكس: يُقرأ من حزمة الصفحة عند كلِّ مزامنة (`persistedIdIn`) ولا يُكتب ثابتاً.
 */
import type { RawRecord } from "./importParse.ts";

/** نسبةُ «شوهدت» — ما دونها «بدأته ولم تكمله» ولا يدخل المكتبة (أحمد ٢٢ نوفمبر «١ ب») */
export const NETFLIX_WATCHED_SHARE = 0.9;

/** ترويسةُ اللغة التي تُرجع الأسماءَ بالإنجليزيّة — `?languages=` و`Accept-Language` لا يغيّران شيئاً (مقيس، ٢٥ نوفمبر) */
export const NETFLIX_LANG_HEADER = { "x-netflix.request.client.languages": "en-US" } as const;

/** اسما الطلبين المحفوظين كما في حزمة الموقع — منهما يُقرأ رقمُ كلٍّ منهما */
export const NETFLIX_OPS = {
  history: "ViewingHistoryPaginated",
  season: "PreviewModalEpisodeSelectorSeasonEpisodes",
  movies: "PreviewModalVideoTitleGroup",
} as const;

/** أفلامٌ في الطلب الواحد — دفعةٌ معقولةٌ لا تُثقل على نتفليكس في الاستيراد الأوّل الطويل */
export const NETFLIX_MOVIES_PER_REQUEST = 40;

/** نسخةُ الطلب المحفوظ التي يقبلها الخادم (مقيس، ٢٥ نوفمبر) */
export const NETFLIX_PQ_VERSION = 102;

export interface NetflixViewing {
  videoId: number;
  kind: "episode" | "movie" | "other";
  /** اسمُ الحلقة أو الفيلم */
  title: string;
  /** وقتُ المشاهدة (ملّي ثانية) */
  at: number;
  seasonId: number | null;
  seasonTitle: string | null;
  showId: number | null;
  showTitle: string | null;
}

export interface NetflixPage<T> {
  items: T[];
  hasNext: boolean;
  next: string | null;
}

export interface NetflixEpisode {
  videoId: number;
  number: number | null;
  title: string;
  runtimeSec: number | null;
  /** أين توقّف العضو (ثوانٍ) — `null`: لم يشغّلها قطّ */
  positionSec: number | null;
}

export interface NetflixSeason {
  seasonId: number;
  number: number | null;
  showId: number | null;
  /** مسلسلٌ يخفي أرقامَ حلقاته — رقمُها لا يُعتمد */
  hideNumbers: boolean;
  episodes: NetflixEpisode[];
  hasNext: boolean;
  next: string | null;
}

/** تقدّمُ فيلم (`PreviewModalVideoTitleGroup`) — موضعُ التوقّف صفرٌ يبقى «بدأته ولم تكمله»: قد تعيده نتفليكس إلى البداية بعد الانتهاء،
 *  ولا دليلَ أنه اكتمل (أحمد ٢٥ نوفمبر «١أ») */
export interface NetflixMovieProgress {
  runtimeSec: number | null;
  positionSec: number | null;
  /** سنةُ الفيلم في نتفليكس — تُعين المطابقةَ في TMDB حين يتشابه الاسم (البحثُ يتسامح بثلاث سنوات) */
  year?: number | null;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * رقمُ الطلب المحفوظ من نصّ حزمة الموقع — `null` إن لم يوجد (نتفليكس غيّرت شكلَ الحزمة ⇐ «تعذّرت المزامنة» لا تخمين).
 * الشكلُ المقيس: `ViewingHistoryPaginatedDocument={__meta__:{q:"d17f5a15-…"}`.
 */
export function persistedIdIn(bundle: string, op: string): string | null {
  const esc = op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`\\b${esc}Document=\\{__meta__:\\{q:"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"`).exec(bundle);
  return m ? m[1] : null;
}

/** جسمُ طلب السجلّ — صفحةٌ بعد صفحة بالمؤشّر */
export function historyRequest(id: string, profileGuid: string, first: number, after?: string | null) {
  return {
    operationName: NETFLIX_OPS.history,
    variables: { profileGuid, first, ...(after ? { after } : {}) },
    extensions: { persistedQuery: { id, version: NETFLIX_PQ_VERSION } },
  };
}

/** جسمُ طلب الموسم — الحلقاتُ صفحاتٌ بالمؤشّر أيضاً */
export function seasonRequest(id: string, seasonId: number, count: number, cursor?: string | null) {
  return {
    operationName: NETFLIX_OPS.season,
    variables: { seasonId, count, opaqueImageFormat: "WEBP", artworkContext: {}, ...(cursor ? { cursor } : {}) },
    extensions: { persistedQuery: { id, version: NETFLIX_PQ_VERSION } },
  };
}

/** جسمُ طلب الأفلام — معرّفاتٌ في طلبٍ واحد */
export function moviesRequest(id: string, videoIds: number[]) {
  return {
    operationName: NETFLIX_OPS.movies,
    variables: { videoIds },
    extensions: { persistedQuery: { id, version: NETFLIX_PQ_VERSION } },
  };
}

/** ردُّ الأفلام ⇐ تقدّمُ كلِّ فيلمٍ بمعرّفه. ما ليس فيلماً أو بلا معرّفٍ يُتخطّى */
export function parseMovieProgress(json: unknown): Map<number, NetflixMovieProgress> {
  const out = new Map<number, NetflixMovieProgress>();
  const videos = obj(obj(json)?.data)?.videos;
  if (!Array.isArray(videos)) return out;
  for (const v of videos) {
    const o = obj(v);
    const id = num(o?.videoId);
    if (!o || id == null || o.__typename !== "Movie") continue;
    out.set(id, { positionSec: num(obj(o.bookmark)?.position), runtimeSec: num(o.displayRuntimeSec) ?? num(o.runtimeSec), year: num(o.latestYear) });
  }
  return out;
}

/** أفلامُ السجلّ التي يلزم طلبُ تقدّمها — مرّةً لكلِّ فيلم */
export function moviesToFetch(items: NetflixViewing[]): number[] {
  return [...new Set(items.filter((i) => i.kind === "movie").map((i) => i.videoId))];
}

/** ردُّ السجلّ ⇐ مشاهدات. ما لا يُفهم يُتخطّى بصمت — ردٌّ معطوبٌ لا يُسقط المزامنة كلَّها */
export function parseViewingHistory(json: unknown): NetflixPage<NetflixViewing> {
  const conn = obj(obj(obj(obj(json)?.data)?.profile)?.viewingHistoryPaginated);
  const edges = Array.isArray(conn?.edges) ? conn.edges : [];
  const items: NetflixViewing[] = [];
  for (const e of edges) {
    const node = obj(obj(e)?.node);
    const video = obj(node?.video);
    const videoId = num(video?.videoId);
    const at = num(node?.lastWatchedTimeMs);
    if (!video || videoId == null || at == null) continue;
    const type = str(video.__typename);
    const season = obj(video.parentSeason);
    const show = obj(video.parentShow);
    items.push({
      videoId,
      kind: type === "Episode" ? "episode" : type === "Movie" ? "movie" : "other",
      title: str(video.title),
      at,
      seasonId: num(season?.videoId),
      seasonTitle: str(season?.title) || null,
      showId: num(show?.videoId),
      showTitle: str(show?.title) || null,
    });
  }
  const info = obj(conn?.pageInfo);
  return { items, hasNext: info?.hasNextPage === true, next: str(info?.endCursor) || null };
}

/** ردُّ الموسم ⇐ موسمٌ بحلقاته — `null` إن لم يكن موسماً */
export function parseSeasonEpisodes(json: unknown): NetflixSeason | null {
  const videos = obj(obj(json)?.data)?.videos;
  const s = obj(Array.isArray(videos) ? videos[0] : null);
  const seasonId = num(s?.videoId);
  if (!s || seasonId == null) return null;
  const conn = obj(s.episodes);
  const edges = Array.isArray(conn?.edges) ? conn.edges : [];
  const episodes: NetflixEpisode[] = [];
  for (const e of edges) {
    const n = obj(obj(e)?.node);
    const videoId = num(n?.videoId);
    if (!n || videoId == null) continue;
    episodes.push({
      videoId,
      number: num(n.number),
      title: str(n.title),
      runtimeSec: num(n.runtimeSec) ?? num(n.displayRuntimeSec),
      positionSec: num(obj(n.bookmark)?.position),
    });
  }
  const info = obj(conn?.pageInfo);
  return {
    seasonId,
    number: num(s.number),
    showId: num(obj(s.parentShow)?.videoId),
    hideNumbers: s.hideEpisodeNumbers === true,
    episodes,
    hasNext: info?.hasNextPage === true,
    next: str(info?.endCursor) || null,
  };
}

/** يضمّ صفحاتِ الموسم الواحد — الحلقةُ المكرّرةُ تبقى مرّة */
export function mergeSeasonPages(a: NetflixSeason, b: NetflixSeason): NetflixSeason {
  const seen = new Set(a.episodes.map((e) => e.videoId));
  return { ...a, episodes: [...a.episodes, ...b.episodes.filter((e) => !seen.has(e.videoId))], hasNext: b.hasNext, next: b.next };
}

/** النسبةُ المشاهَدة (٠–١) — `null` إن غابت المدّةُ أو موضعُ التوقّف */
export function watchedShare(positionSec: number | null, runtimeSec: number | null): number | null {
  if (positionSec == null || runtimeSec == null || runtimeSec <= 0) return null;
  return Math.max(0, Math.min(1, positionSec / runtimeSec));
}

export function isWatched(positionSec: number | null, runtimeSec: number | null): boolean {
  const share = watchedShare(positionSec, runtimeSec);
  return share != null && share >= NETFLIX_WATCHED_SHARE;
}

/** مواسمُ يلزم طلبُها — مرّةً لكلِّ موسم مهما تكرّرت حلقاتُه في السجلّ */
export function seasonsToFetch(items: NetflixViewing[]): number[] {
  return [...new Set(items.filter((i) => i.kind === "episode" && i.seasonId != null).map((i) => i.seasonId as number))];
}

/** ما بدأه العضو ولم يبلغ ٩٠٪ — لصفّ «بدأته ولم تكمله» في صفحة نتفليكس، لا يدخل المكتبة */
export interface NetflixPartial {
  title: string;
  show: string | null;
  season: number | null;
  episode: number | null;
  /** النسبة (٠–١)، أو `null`: لم تُعرف */
  share: number | null;
  at: string;
}

export interface NetflixBuild {
  records: RawRecord[];
  partial: NetflixPartial[];
  /** ما لم يُفهم: حلقةٌ بلا موسمٍ مقروء، أو بلا رقم، أو نوعٌ آخر (مقاطعُ إضافيّة) */
  skipped: number;
  /** أحدثُ مشاهدةٍ في القراءة كلِّها (ملّي ثانية) — المزامنةُ التالية تبدأ بعده */
  newest: number | null;
}

/**
 * المشاهداتُ ⇐ صفوفُ استيراد.
 * - `after`: ما شوهد عند هذه اللحظة أو قبلها لا يُقرأ — آخرُ مزامنة (`last_item_at`) أو «من الآن فقط» (`since_at`)، أيُّهما أحدث.
 * - الحلقةُ: موسمُها مقروءٌ وفيه رقمُها ⇐ `ep-name` برقمَي نتفليكس، ومعرّفُ مسلسلها واسمُ حلقةٍ منه يُطابَق بهما المسلسلُ في TMDB.
 * - الفيلمُ: يدخل إن عُرف تقدّمُه وبلغ ٩٠٪ — وإن لم يُعرف (طلبُ الأفلام لم يُجب) أو كان موضعُه صفراً فهو «بدأته» لا مشاهدة.
 */
export function buildNetflixRecords(
  items: NetflixViewing[],
  seasons: Map<number, NetflixSeason>,
  movies: Map<number, NetflixMovieProgress> = new Map(),
  opts: { after?: number | null } = {},
): NetflixBuild {
  const after = opts.after ?? null;
  const records: RawRecord[] = [];
  const partial: NetflixPartial[] = [];
  let skipped = 0;
  let newest: number | null = null;
  for (const it of items) {
    if (newest == null || it.at > newest) newest = it.at;
    if (after != null && it.at <= after) continue;
    const at = new Date(it.at).toISOString();
    if (it.kind === "episode") {
      const season = it.seasonId != null ? seasons.get(it.seasonId) : undefined;
      const ep = season?.episodes.find((e) => e.videoId === it.videoId);
      const s = season?.number ?? null;
      const e = season && !season.hideNumbers ? (ep?.number ?? null) : null;
      if (!season || !ep || s == null || e == null || !it.showTitle || it.showId == null) {
        skipped++;
        continue;
      }
      if (!isWatched(ep.positionSec, ep.runtimeSec)) {
        partial.push({ title: ep.title || it.title, show: it.showTitle, season: s, episode: e, share: watchedShare(ep.positionSec, ep.runtimeSec), at });
        continue;
      }
      records.push({ kind: "ep-name", show: it.showTitle, s, e, at, nfx: { show: String(it.showId), title: ep.title || it.title } });
    } else if (it.kind === "movie") {
      if (!it.title) {
        skipped++;
        continue;
      }
      const p = movies.get(it.videoId);
      if (!p || !isWatched(p.positionSec, p.runtimeSec)) {
        partial.push({ title: it.title, show: null, season: null, episode: null, share: p ? watchedShare(p.positionSec, p.runtimeSec) : null, at });
        continue;
      }
      records.push({ kind: "movie-name", name: it.title, at, ...(p.year && p.year > 1870 ? { year: p.year } : {}) });
    } else {
      skipped++;
    }
  }
  return { records, partial, skipped, newest };
}
