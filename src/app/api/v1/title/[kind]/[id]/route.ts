import { NextRequest } from "next/server";
import { getTv, getMovie, getTrailer } from "@/lib/tmdb";
import {
  getFollowState,
  getWatchedForShow,
  isMovieWatched,
  getMovieProgress,
  getUserId,
  getMyRating,
  getMyArtFor,
} from "@/lib/data";
import { airedPerSeason, airedEpisodeCount, firstEpisodeOf } from "@/core/progress";
import { handle, positiveInt, limited, fail } from "@/lib/v1";
import { originAdjectives } from "@/core/region";
import { getLocale } from "@/lib/locale";
import { ok } from "@/core/contracts/result";
import type { MovieTitlePayload, TitleArtChoice, TitlePayload, TvTitlePayload } from "@/core/contracts/title";

/**
 * `GET /api/v1/title/{tv|movie}/{id}` — صفحةُ العمل للتطبيق في ردٍّ واحد.
 *
 * 🔑 **الحقولُ الشخصيّةُ تأتي فارغةً للزائر لا مرفوضة**: العملُ عامٌّ
 * (D-892: الزائرُ يقرأ ويُدعى عند الفعل)، **ومعه حالتي فقط إن كنتُ
 * مسجَّلاً** — فلا يحتاج التطبيقُ نداءَين ولا يُغلَق البابُ على من يتصفّح.
 *
 * 🔑 **والتقدّمُ يُحسب هنا بنفس الدوالّ التي تحسبه للويب** (`core/progress`):
 * الترقيمُ المطلق (D-603) وحلقاتُ ما بُثّ — **قاعدةٌ واحدة، منصّتان.**
 *
 * ⚠️ **الطاقمُ والأعمالُ المرتبطة ليست هنا عمداً**: تحت الطيّة في الويب
 * (Suspense) وتُطلب في التطبيق حين تُفتح — لا يدفع أحدٌ كلفةَ ما لن يراه (D-510).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ kind: string; id: string }> },
) {
  return handle(
    async () => {
      const { kind, id } = await ctx.params;
      const tmdbId = positiveInt(id);
      if ((kind !== "tv" && kind !== "movie") || !tmdbId) return fail("invalid_input");

      const uid = await getUserId();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:title:${uid ?? ip}`, 120, 60_000);
      if (lim) return lim;

      const payload: TitlePayload =
        kind === "tv" ? await tvPayload(tmdbId, !!uid) : await moviePayload(tmdbId, !!uid);
      return ok(payload);
    },
    // العملُ عامٌّ وثابتٌ لدقائق؛ **لكنّ الردَّ يحمل حالتي** — فالكاشُ خاصٌّ
    /* 🔴 D-986 — **ردٌّ يحمل `me` لا يُخزَّن**: `max-age=120` كان يجعل OkHttp (شبكةُ أندرويد في
       React Native تملك كاشاً قرصيّاً يحترم `Cache-Control`) يعيد الردَّ القديمَ لدقيقتين بعد
       كلِّ كتابة — فتظهر «تابع» ثمّ تعود، والحلقةُ تُعلَّم ثمّ تُمحى (بلاغُ أحمد بتسجيل على
       1.8.7). الكتابةُ نجحت، والقراءةُ بعدها كذبت. */
    { cacheControl: "private, no-store" },
  );
}

async function tvPayload(tvId: number, signedIn: boolean): Promise<TvTitlePayload> {
  const [tv, trailer, following, watched, rating, art] = await Promise.all([
    getTv(tvId),
    getTrailer("tv", tvId).catch(() => null),
    signedIn ? getFollowState(tvId, "tv") : { following: false, dropped: false },
    signedIn ? getWatchedForShow(tvId) : new Set<string>(),
    // 🆕 D-919: تقييمي مع الصفحة — نداءٌ رابعٌ بالتوازي لا رحلةٌ ثانية من التطبيق
    signedIn ? getMyRating(tvId, "tv") : null,
    signedIn ? myArt(tvId, "tv") : null,
  ]);
  const aired = airedPerSeason(tv);
  const first = firstEpisodeOf(tv);
  return {
    kind: "tv",
    id: tv.id,
    name: tv.name,
    original_name: tv.original_name ?? null,
    overview: tv.overview,
    poster_path: tv.poster_path,
    backdrop_path: tv.backdrop_path,
    first_air_date: tv.first_air_date,
    status: tv.status,
    genres: tv.genres,
    /* D-1479 — النسبةُ كما في صفحة الويب حرفاً (D-562): الدالّةُ نفسُها والسقفُ نفسُه */
    origins: originAdjectives({ origin: tv.origin_country, production: tv.production_countries }, await getLocale()),
    vote_average: tv.vote_average,
    episode_run_time: tv.episode_run_time?.[0] ?? null,
    next_episode_to_air: tv.next_episode_to_air
      ? {
          season_number: tv.next_episode_to_air.season_number,
          episode_number: tv.next_episode_to_air.episode_number,
          air_date: tv.next_episode_to_air.air_date,
          name: tv.next_episode_to_air.name,
        }
      : null,
    seasons: (tv.seasons ?? [])
      .filter((s) => s.season_number >= 1)
      .map((s) => ({
        season_number: s.season_number,
        name: s.name,
        episode_count: s.episode_count,
        aired: aired.get(s.season_number) ?? 0,
        first_episode: first.get(s.season_number) ?? 1,
        poster_path: s.poster_path,
        air_date: s.air_date,
      })),
    aired_total: airedEpisodeCount(tv),
    trailer_key: trailer && "key" in trailer ? (trailer as { key: string }).key : null,
    me: {
      following: following.following,
      dropped: following.dropped,
      watched_count: watched.size,
      watched: [...watched],
      rating: rating?.rating ?? null,
      art,
    },
  };
}

async function moviePayload(movieId: number, signedIn: boolean): Promise<MovieTitlePayload> {
  const [movie, trailer, following, watched, progress, rating, art] = await Promise.all([
    getMovie(movieId),
    getTrailer("movie", movieId).catch(() => null),
    signedIn ? getFollowState(movieId, "movie") : { following: false, dropped: false },
    signedIn ? isMovieWatched(movieId) : false,
    signedIn ? getMovieProgress(movieId).catch(() => null) : null,
    signedIn ? getMyRating(movieId, "movie") : null,
    signedIn ? myArt(movieId, "movie") : null,
  ]);
  return {
    kind: "movie",
    id: movie.id,
    name: movie.title,
    original_name: movie.original_title ?? null,
    overview: movie.overview,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    release_date: movie.release_date,
    status: movie.status,
    genres: movie.genres,
    origins: originAdjectives({ origin: movie.origin_country, production: movie.production_countries }, await getLocale()),
    vote_average: movie.vote_average,
    runtime: movie.runtime,
    trailer_key: trailer && "key" in trailer ? (trailer as { key: string }).key : null,
    me: {
      following: following.following,
      dropped: following.dropped,
      watched,
      progress,
      rating: rating?.rating ?? null,
      art,
    },
  };
}

/**
 * 🆕 D-1498 — **غلافي المختار مع الصفحة** (بلاغُ أحمد بتسجيل ٢١ أكتوبر: «ما تظهر لا الخلفية ولا البوستر
 * اللي انا اخترته»). الويبُ يقرؤه بـ`getMyArtFor` منذ D-131، **وهذا الردُّ لم يقرأه قطّ** — فالكتابةُ تنجح،
 * ثمّ يعيد التطبيقُ الجلبَ فيعود بصورة TMDB ويومض الاختيارُ ويختفي. الدالّةُ نفسُها، وسقوطُها يعيد null:
 * الغلافُ زينةٌ لا تُسقط الصفحة.
 */
async function myArt(tmdbId: number, kind: "tv" | "movie"): Promise<TitleArtChoice | null> {
  const a = await getMyArtFor(tmdbId, kind).catch(() => null);
  return a && (a.poster_path || a.backdrop_path) ? { poster: a.poster_path, backdrop: a.backdrop_path } : null;
}
