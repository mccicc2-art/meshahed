import "server-only";
import { findByImdb, getSeason, tvSeasonCounts } from "@/lib/tmdb";
import {
  fribbEpisodeOf,
  imdbEpisodeOf,
  matchByAirDate,
  placeOnTmdb,
  type DatedEpisode,
  type FribbEntry,
  type KitsuMapEntry,
} from "@/core/kitsuEpisode";
import type { StremioRef, StremioVideo } from "@/core/stremioId";

/**
 * 🆕 **معرّفُ Stremio ⇢ عملٌ في TMDB وحلقتُه** — مسارُ المصادر ومسارُ الترجمة يمرّان من هنا (أحمد ٢٢ أكتوبر «نبني دعم كيتسو»).
 *
 *  - **IMDb** (`tt…`): كما كان — `findByImdb`، والموسمُ والحلقةُ كما أرسلهما Stremio.
 *  - **Kitsu** (`kitsu:{id}[:{ep}]`): 🆕 R74 — **جدولُ ربط إضافة «Anime Kitsu» المنشورُ على GitHub** (Apache-2.0)، لا بيانُها
 *    الحيّ: خادمُها يحجب الخوادمَ السحابيّة (`meta_http_403` في R72، وحتى بهويّة Loopz في R73)، وGitHub لا يحجبنا. المدخلُ
 *    يعطي رقمَ IMDb ومبدأَ الترقيم، فنأخذ IMDb إلى TMDB كالمسار الأوّل، ونضع الحلقةَ على مواسم TMDB (`kitsuEpisode.ts` — سببُه هناك).
 *
 * ⚖️ **لا جسرَ ⇐ لا إشارة** (`null`): أنمي ليس في الجدول، أو بلا رقم IMDb، أو حلقةٌ لا يسعها TMDB — يسكت سطرُنا لهذا العمل
 * وحده كما يسكت لعملٍ لا يعرفه TMDB، ولا يُخمَّن عملٌ بالاسم.
 */
const KITSU_MAP =
  "https://raw.githubusercontent.com/TheBeastLT/stremio-kitsu-anime/master/static/data/imdb_mapping.json";

/**
 * 🆕 R72 — **سطرُ تشخيصٍ لطلبات أنمي Kitsu** (أحمد ٢٢ أكتوبر «نفذ وارفع»؛ يُزال بطلبه): القائمةُ الفارغةُ لا تفرّق بين «لم يُسأل»
 * و«سُئل وفشل». فسطرٌ واحدٌ لكلِّ طلبٍ في سجلّ Vercel: المرحلةُ التي وقف عندها والمدّة — **رقمُ Kitsu والحلقةُ وحدَهما**، لا رمزَ
 * ولا عضو. ولا يغيّر ردّاً، وفشلُه لا يُفشل الطلب.
 */
function trace(fields: Record<string, unknown>) {
  try {
    console.log(`[stremio-kitsu] ${JSON.stringify(fields)}`);
  } catch {
    /* السجلُّ لا يُفشل طلباً */
  }
}

/** معرّفٌ فيه `kitsu` رفضه المحلّل — يفرّق «لم يُسأل» عن «سُئل بشكلٍ لا نعرفه» (النوعُ والمعرّفُ وحدَهما، ٨٠ محرفاً) */
export function traceRejected(type: string, id: string) {
  if (/kitsu/i.test(id)) trace({ stage: "parse_rejected", type: type.slice(0, 20), id: id.slice(0, 80) });
}

/**
 * الجدولُ (~٨٥٠ ك.ب، ~٧ آلاف مدخل): كاشُ Next نصفَ يوم للتنزيل، وفهرسٌ في ذاكرة النسخة لا يُعاد بناؤه مع كلِّ طلب —
 * Stremio يسأل عن الحلقة مرّتين على الأقلّ (فتحٌ ثمّ تشغيل). والفشلُ لا يُحفظ: الطلبُ التالي يحاول من جديد.
 */
const MAP_TTL_MS = 43_200_000;
let mapCache: { at: number; byId: Map<number, KitsuMapEntry> } | null = null;

async function kitsuMap(): Promise<{ byId: Map<number, KitsuMapEntry> | null; why: string }> {
  if (mapCache && Date.now() - mapCache.at < MAP_TTL_MS) return { byId: mapCache.byId, why: "ok" };
  try {
    const res = await fetch(KITSU_MAP, {
      next: { revalidate: 43_200 },
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "Loopz/1.0 (+https://loopztv.com)", Accept: "application/json" },
    });
    if (!res.ok) return { byId: null, why: `http_${res.status}` };
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return { byId: null, why: "bad_shape" };
    const byId = new Map<number, KitsuMapEntry>();
    for (const r of rows as KitsuMapEntry[]) {
      const id = Number(r?.kitsu_id);
      if (Number.isInteger(id) && id > 0) byId.set(id, r);
    }
    mapCache = { at: Date.now(), byId };
    return { byId, why: "ok" };
  } catch (e) {
    return { byId: null, why: e instanceof Error ? `error_${e.name}` : "error" };
  }
}

/**
 * 🆕 R77 — **جدولُ Fribb** (`anime-lists`، ~٧٫٥ م.ب): أكبرُ من كاش Next (٢ م.ب) فلا يُحفظ هناك — يُنزَّل **حين يفشل المسارُ
 * الأوّلُ فقط** ويبقى فهرسُه في ذاكرة النسخة نصفَ يوم. والفشلُ لا يُحفظ.
 */
const FRIBB =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
let fribbCache: { at: number; byId: Map<number, FribbEntry> } | null = null;

async function fribbMap(): Promise<{ byId: Map<number, FribbEntry> | null; why: string }> {
  if (fribbCache && Date.now() - fribbCache.at < MAP_TTL_MS) return { byId: fribbCache.byId, why: "ok" };
  try {
    const res = await fetch(FRIBB, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "Loopz/1.0 (+https://loopztv.com)", Accept: "application/json" },
    });
    if (!res.ok) return { byId: null, why: `http_${res.status}` };
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return { byId: null, why: "bad_shape" };
    const byId = new Map<number, FribbEntry>();
    for (const r of rows as FribbEntry[]) {
      const id = Number(r?.kitsu_id);
      /* ما بلا رقم TMDB لا ينفعنا — لا يُحفظ في الذاكرة */
      if (Number.isInteger(id) && id > 0 && r?.themoviedb_id?.tv) byId.set(id, r);
    }
    fribbCache = { at: Date.now(), byId };
    return { byId, why: "ok" };
  } catch (e) {
    return { byId: null, why: e instanceof Error ? `error_${e.name}` : "error" };
  }
}

async function viaFribb(kitsu: number, ep: number): Promise<{ tmdbId: number; placed: { season: number; episode: number } } | string> {
  const { byId, why } = await fribbMap();
  if (!byId) return `fribb_${why}`;
  const entry = byId.get(kitsu);
  if (!entry) return "fribb_not_found";
  const hit = fribbEpisodeOf(entry, ep);
  if (!hit) return "fribb_no_season";
  /* الموسمُ والحلقةُ يُتحقَّق منهما على مواسم TMDB الحاليّة — حلقةٌ لا يعرفها TMDB بعدُ لا تُعلَّم */
  const placed = placeOnTmdb(await tvSeasonCounts(hit.tmdbId), hit.at);
  return placed ? { tmdbId: hit.tmdbId, placed } : "fribb_no_place";
}

/**
 * 🆕 R75 — **تاريخُ عرض حلقة Kitsu من واجهتها الرسميّة** (`kitsu.app/api/edge`): للمطابقة بالتاريخ حين لا يتّفق تقسيمُ IMDb
 * وTMDB. نصفُ يومٍ في كاش Next (التاريخُ لا يتغيّر)، والفشلُ لا شيء — وسطرُ التشخيص يقول السبب.
 */
async function kitsuAirdate(kitsu: number, episode: number): Promise<{ date: string | null; why: string }> {
  try {
    const url = `https://kitsu.app/api/edge/anime/${kitsu}/episodes?filter%5Bnumber%5D=${episode}&page%5Blimit%5D=1`;
    const res = await fetch(url, {
      next: { revalidate: 43_200 },
      signal: AbortSignal.timeout(5_000),
      headers: { "User-Agent": "Loopz/1.0 (+https://loopztv.com)", Accept: "application/vnd.api+json" },
    });
    if (!res.ok) return { date: null, why: `http_${res.status}` };
    const body = (await res.json()) as { data?: { attributes?: { airdate?: string | null } }[] } | null;
    const date = body?.data?.[0]?.attributes?.airdate ?? null;
    return date ? { date: date.slice(0, 10), why: "ok" } : { date: null, why: "no_airdate" };
  } catch (e) {
    return { date: null, why: e instanceof Error ? `error_${e.name}` : "error" };
  }
}

/** حلقاتُ مواسم TMDB العاديّة بتواريخها — مواسمُ قليلةٌ في العادة، وسقفٌ ٣٠ للمسلسلات الطويلة (One Piece ٢٢) */
async function datedEpisodes(tmdbId: number, seasons: { season_number?: number }[]): Promise<DatedEpisode[]> {
  const numbers = seasons
    .map((s) => s.season_number)
    .filter((n): n is number => Number.isInteger(n) && (n as number) > 0)
    .slice(0, 30);
  const all = await Promise.all(numbers.map((n) => getSeason(tmdbId, n).catch(() => null)));
  return all.flatMap((s, i) =>
    (s?.episodes ?? []).map((e) => ({ season: numbers[i], episode: e.episode_number, air_date: e.air_date ?? null })),
  );
}

const IMDB = /^tt\d{5,10}$/;

export async function resolveStremioRef(ref: StremioRef): Promise<{ video: StremioVideo; tmdbId: number } | null> {
  if (ref.kind !== "kitsu") {
    const tmdbId = await findByImdb(ref.imdb, ref.kind);
    return tmdbId ? { video: ref, tmdbId } : null;
  }

  const t0 = Date.now();
  const done = (stage: string, extra: Record<string, unknown> = {}) =>
    trace({ kitsu: ref.kitsu, episode: ref.episode, stage, ms: Date.now() - t0, ...extra });

  const { byId, why } = await kitsuMap();
  const entry = byId?.get(ref.kitsu);
  const imdb = entry?.imdb_id && IMDB.test(entry.imdb_id) ? entry.imdb_id : null;

  if (ref.episode === null) {
    if (!byId) return done(`map_${why}`), null;
    if (!entry) return done("not_in_map"), null;
    if (!imdb) return done("no_imdb"), null;
    const tmdbId = await findByImdb(imdb, "movie");
    if (!tmdbId) return done("tmdb_not_found", { imdb }), null;
    done("ok", { imdb, tmdbId });
    return { video: { kind: "movie", imdb }, tmdbId };
  }
  const ep = ref.episode;

  /* ١) المسارُ الأوّل: جدولُ الإضافة ⇢ IMDb ⇢ TMDB بالرقم */
  let stage = !byId ? `map_${why}` : !entry ? "not_in_map" : !imdb ? "no_imdb" : "";
  const at = entry && imdb ? imdbEpisodeOf(entry, ep) : null;
  if (!stage && !at) stage = "no_imdb_episode";
  const firstTmdb = at && imdb ? await findByImdb(imdb, "tv") : null;
  if (!stage && !firstTmdb) stage = "tmdb_not_found";
  const seasons = firstTmdb ? await tvSeasonCounts(firstTmdb) : [];
  const byNumber = firstTmdb && at ? placeOnTmdb(seasons, at) : null;
  if (firstTmdb && byNumber) return finish(firstTmdb, byNumber, "number");
  if (!stage) stage = "no_place";

  /* ٢) 🆕 R77 — جدولُ Fribb: رقمُ TMDB والموسمُ مباشرةً */
  const fribb = await viaFribb(ref.kitsu, ep);
  if (typeof fribb !== "string") return finish(fribb.tmdbId, fribb.placed, `fribb after ${stage}`);

  /* ٣) R75 — المطابقةُ بيوم العرض على عمل المسار الأوّل */
  if (!firstTmdb) return done(stage, { imdb, fribb }), null;
  const { date, why: dateWhy } = await kitsuAirdate(ref.kitsu, ep);
  if (!date) return done(`no_place_date_${dateWhy}`, { imdb, tmdbId: firstTmdb, imdbAt: at, fribb }), null;
  const byDate = matchByAirDate(await datedEpisodes(firstTmdb, seasons), date);
  if (!byDate) return done("no_place_date_nomatch", { imdb, tmdbId: firstTmdb, imdbAt: at, date, fribb }), null;
  return finish(firstTmdb, byDate, `date ${date}`);

  function finish(tmdbId: number, placed: { season: number; episode: number }, how: string) {
    /* الفيديو يحمل رقمَ IMDb إن وُجد — وإلّا فرغاً: المسارُ بعده يعتمد رقمَ TMDB وحده */
    done("ok", { imdb, tmdbId, imdbAt: at, season: placed.season, ep: placed.episode, how });
    return { video: { kind: "tv" as const, imdb: imdb ?? "", season: placed.season, episode: placed.episode }, tmdbId };
  }
}
