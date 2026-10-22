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

async function kitsuMeta(type: "movie" | "series", kitsu: number): Promise<KitsuMeta | null> {
  try {
    const res = await fetch(`${KITSU_META}/${type}/kitsu:${kitsu}.json`, {
      /* البيانُ يتغيّر بحلقةٍ جديدةٍ لا بكلِّ فتح — نصفُ يوم، و Stremio قد يسأل عن الحلقة مرّتين (فتحٌ ثمّ تشغيل) */
      next: { revalidate: 43_200 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { meta?: KitsuMeta } | null;
    return body?.meta ?? null;
  } catch {
    return null;
  }
}

const IMDB = /^tt\d{5,10}$/;

export async function resolveStremioRef(ref: StremioRef): Promise<{ video: StremioVideo; tmdbId: number } | null> {
  if (ref.kind !== "kitsu") {
    const tmdbId = await findByImdb(ref.imdb, ref.kind);
    return tmdbId ? { video: ref, tmdbId } : null;
  }

  if (ref.episode === null) {
    const meta = await kitsuMeta("movie", ref.kitsu);
    const imdb = meta?.imdb_id;
    if (!imdb || !IMDB.test(imdb)) return null;
    const tmdbId = await findByImdb(imdb, "movie");
    return tmdbId ? { video: { kind: "movie", imdb }, tmdbId } : null;
  }

  const meta = await kitsuMeta("series", ref.kitsu);
  const ep = meta?.videos?.find((v) => v.id === `kitsu:${ref.kitsu}:${ref.episode}`);
  const imdb = ep?.imdb_id ?? meta?.imdb_id;
  if (!ep || !imdb || !IMDB.test(imdb)) return null;
  const tmdbId = await findByImdb(imdb, "tv");
  if (!tmdbId) return null;
  const placed = placeKitsuEpisode(await tvSeasonCounts(tmdbId), ep);
  return placed ? { video: { kind: "tv", imdb, season: placed.season, episode: placed.episode }, tmdbId } : null;
}
