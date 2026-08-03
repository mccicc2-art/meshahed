import {
  getFollows,
  getProfile,
  getMyRatings,
  getWatchedMovieIds,
  getWatchSummary,
} from "@/lib/data";
import { discoverByGenres, recommendationsFor, type SearchResult } from "@/lib/tmdb";
import { blendRecommendations, type Candidate, type Recommendation } from "@/lib/recommend";

/**
 * محرّك الاقتراحات.
 *
 * كان يعيش داخل الصفحة الرئيسية، ونُقل هنا حين انتقل صفّ «مقترح لك» إلى
 * اكتشف: المكان الذي يُستكشف فيه الجديد. والبذور ثلاث — ما قيّمته عالياً،
 * وما تتابعه، وما شاهدته أخيراً — لأن بذرة واحدة تُنتج صفّاً كلّه من عائلة
 * عمل واحد.
 */
export async function getSuggestions(limit = 12): Promise<Recommendation[]> {
  const [follows, profile, myRatings, watchedMovieIds, summary] = await Promise.all([
    getFollows(),
    getProfile(),
    getMyRatings(),
    getWatchedMovieIds(),
    getWatchSummary(),
  ]);

  if (!follows.length) return [];

  const lastWatchedOrder = (summary ?? [])
    .slice()
    .sort((a, b) => (b.last_watched ?? "").localeCompare(a.last_watched ?? ""))
    .map((s) => s.show_tmdb_id);

  const titleById = new Map<number, string>(follows.map((f) => [f.tmdb_id, f.title]));
  const recentShowIds = lastWatchedOrder.slice(0, 2);
  const followSeeds = follows.filter((f) => !recentShowIds.includes(f.tmdb_id)).slice(0, 3);

  // أربع نجوم فأكثر بذرة، ونجمتان فأقل استبعاد — التقييم إشارة في اتجاهين
  const lovedSeeds = myRatings
    .filter((r) => r.rating >= 4)
    .sort((a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3);
  const dislikedIds = myRatings.filter((r) => r.rating <= 2).map((r) => r.tmdb_id);

  const favGenres = profile?.favorite_genres ?? [];

  const [genreDiscover, followRecs, recentRecs, ratedRecs] = await Promise.all([
    favGenres.length
      ? discoverByGenres(favGenres, "tv").catch(() => [] as SearchResult[])
      : Promise.resolve([] as SearchResult[]),
    Promise.all(
      followSeeds.map((f) =>
        recommendationsFor(f.media_type, f.tmdb_id)
          .then((rs) => ({ seed: f.title, rs }))
          .catch(() => ({ seed: f.title, rs: [] as SearchResult[] })),
      ),
    ),
    Promise.all(
      recentShowIds.map((id) =>
        recommendationsFor("tv", id)
          .then((rs) => ({ seed: titleById.get(id) ?? "", rs }))
          .catch(() => ({ seed: titleById.get(id) ?? "", rs: [] as SearchResult[] })),
      ),
    ),
    Promise.all(
      lovedSeeds.map((r) =>
        recommendationsFor(r.media_type, r.tmdb_id)
          .then((rs) => ({ seed: r.title ?? "", rs }))
          .catch(() => ({ seed: r.title ?? "", rs: [] as SearchResult[] })),
      ),
    ),
  ]);

  const candidates: Candidate[] = [];
  for (const { seed, rs } of ratedRecs)
    rs.forEach((r, i) => candidates.push({ result: r, source: "rated", seedTitle: seed, rank: i }));
  for (const { seed, rs } of followRecs)
    rs.forEach((r, i) => candidates.push({ result: r, source: "follows", seedTitle: seed, rank: i }));
  for (const { seed, rs } of recentRecs)
    rs.forEach((r, i) => candidates.push({ result: r, source: "recent", seedTitle: seed, rank: i }));
  genreDiscover.forEach((r, i) => candidates.push({ result: r, source: "genres", rank: i }));

  const excluded = new Set<number>([
    ...follows.map((f) => f.tmdb_id),
    ...watchedMovieIds,
    ...dislikedIds,
  ]);

  return blendRecommendations(candidates, { exclude: excluded, limit });
}
