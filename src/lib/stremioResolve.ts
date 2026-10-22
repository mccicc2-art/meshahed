import "server-only";
import { findByImdb, tvSeasonCounts } from "@/lib/tmdb";
import { placeKitsuEpisode } from "@/core/kitsuEpisode";
import type { StremioRef, StremioVideo } from "@/core/stremioId";

/**
 * 🆕 **معرّفُ Stremio ⇢ عملٌ في TMDB وحلقتُه** — مسارُ المصادر ومسارُ الترجمة يمرّان من هنا (أحمد ٢٢ أكتوبر «نبني دعم كيتسو»).
 *
 *  - **IMDb** (`tt…`): كما كان — `findByImdb`، والموسمُ والحلقةُ كما أرسلهما Stremio.
 *  - **Kitsu** (`kitsu:{id}[:{ep}]`): بيانُ إضافة «Anime Kitsu» نفسِها — هي التي أعطت العضوَ المعرّف، وفي بيانها جسرُها
 *    إلى IMDb لكلِّ حلقة (`imdb_id · imdbSeason · imdbEpisode · absoluteEpisode`، جدولٌ تتحقّق منه وتصونه). فنأخذ رقمَ IMDb
 *    إلى TMDB كالمسار الأوّل، ونضع الحلقةَ على مواسم TMDB بالرقم التسلسليّ (`placeKitsuEpisode` — سببُه هناك).
 *
 * ⚖️ **لا جسرَ ⇐ لا إشارة** (`null`): أنمي بلا رقم IMDb في جدولهم، أو حلقةٌ لا يسعها TMDB، أو تعطّلٌ عندهم — يسكت سطرُنا
 * لهذا العمل وحده كما يسكت لعملٍ لا يعرفه TMDB، ولا يُخمَّن عملٌ بالاسم.
 */
const KITSU_META = "https://anime-kitsu.strem.fun/meta";

type KitsuVideo = {
  id?: string;
  imdb_id?: string;
  imdbSeason?: number;
  imdbEpisode?: number;
  absoluteEpisode?: number;
};
type KitsuMeta = { imdb_id?: string; videos?: KitsuVideo[] };

/**
 * 🆕 R72 — **سطرُ تشخيصٍ لطلبات أنمي Kitsu** (أحمد ٢٢ أكتوبر «نفذ وارفع»؛ يُزال بطلبه): بعد R71 لم يظهر سطرُنا في الأنمي
 * ولم تصل إشارة، والقائمةُ الفارغةُ لا تفرّق بين «لم يُسأل» و«سُئل وفشل». فسطرٌ واحدٌ لكلِّ طلبٍ في سجلّ Vercel: المرحلةُ التي
 * وقف عندها والمدّة — **رقمُ Kitsu والحلقةُ وحدَهما**، لا رمزَ ولا عضو. ولا يغيّر ردّاً، وفشلُه لا يُفشل الطلب.
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

type MetaResult = { meta: KitsuMeta | null; why: string };

async function kitsuMeta(type: "movie" | "series", kitsu: number): Promise<MetaResult> {
  try {
    const res = await fetch(`${KITSU_META}/${type}/kitsu:${kitsu}.json`, {
      /* البيانُ يتغيّر بحلقةٍ جديدةٍ لا بكلِّ فتح — نصفُ يوم، و Stremio قد يسأل عن الحلقة مرّتين (فتحٌ ثمّ تشغيل) */
      next: { revalidate: 43_200 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { meta: null, why: `http_${res.status}` };
    const body = (await res.json()) as { meta?: KitsuMeta } | null;
    return body?.meta ? { meta: body.meta, why: "ok" } : { meta: null, why: "no_meta" };
  } catch (e) {
    return { meta: null, why: e instanceof Error ? `error_${e.name}` : "error" };
  }
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

  if (ref.episode === null) {
    const { meta, why } = await kitsuMeta("movie", ref.kitsu);
    if (!meta) return done(`meta_${why}`), null;
    const imdb = meta.imdb_id;
    if (!imdb || !IMDB.test(imdb)) return done("no_imdb"), null;
    const tmdbId = await findByImdb(imdb, "movie");
    if (!tmdbId) return done("tmdb_not_found", { imdb }), null;
    done("ok", { imdb, tmdbId });
    return { video: { kind: "movie", imdb }, tmdbId };
  }

  const { meta, why } = await kitsuMeta("series", ref.kitsu);
  if (!meta) return done(`meta_${why}`), null;
  const ep = meta.videos?.find((v) => v.id === `kitsu:${ref.kitsu}:${ref.episode}`);
  if (!ep) return done("no_episode_in_meta", { videos: meta.videos?.length ?? 0 }), null;
  const imdb = ep.imdb_id ?? meta.imdb_id;
  if (!imdb || !IMDB.test(imdb)) return done("no_imdb"), null;
  const tmdbId = await findByImdb(imdb, "tv");
  if (!tmdbId) return done("tmdb_not_found", { imdb }), null;
  const seasons = await tvSeasonCounts(tmdbId);
  const placed = placeKitsuEpisode(seasons, ep);
  const nums = { imdb, tmdbId, imdbSeason: ep.imdbSeason, imdbEpisode: ep.imdbEpisode, absolute: ep.absoluteEpisode };
  if (!placed) return done("no_place", { ...nums, seasons: seasons.length }), null;
  done("ok", { ...nums, season: placed.season, ep: placed.episode });
  return { video: { kind: "tv", imdb, season: placed.season, episode: placed.episode }, tmdbId };
}
