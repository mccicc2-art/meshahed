import {
  getFollows,
  getWatchSummary,
  getWatchedMovies,
  getProfile,
  getAllMovieProgress,
  getMyRatings,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { titleOf, yearOf } from "@/lib/tmdb";
import {
  buildHomeHeader,
  buildHomeBody,
  continueBackdrops,
  upcomingWithEpisodes,
  trendingRail,
} from "@/lib/homeCore";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { HomeExtrasPayload } from "@/core/contracts/home";

/**
 * `GET /api/v1/me/home/extras` — ما كان الويبُ يبثّه **بعد** الرفوف (D-1066):
 * مشاهدُ «التالي» لبطاقات القوائم (D-507)، أرقامُ حلقات القادم (D-437)،
 * والرائجُ (D-599). التطبيقُ يرسم `me/home` أوّلاً ثمّ يركّب هذا عليه —
 * فلا ينتظر أوّلُ رسمٍ أبطأَ نداءِ TMDB، كما لا تنتظره الصفحة.
 *
 * ⚠️ **الموجتان تُعادان هنا** لأنّ المدخلاتِ (أيُّ بطاقاتٍ، أيُّ قادم)
 * تُعرف منهما — وكلُّ قرّائها `cache()` في الطلب، وTMDB مخبّأٌ ساعةً؛ الثمنُ
 * رحلاتُ قاعدةٍ مكرّرةٌ بين طلبين لا نداءُ TMDB مكرّر.
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:home-extras:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;

    const { locale, t } = await getT();
    const movieProgressPromise = getAllMovieProgress();
    const [followRows, summary, watchedMovies, profile, myRatings] = await Promise.all([
      getFollows(),
      getWatchSummary(),
      getWatchedMovies(),
      getProfile(),
      getMyRatings(),
    ]);
    const { watchedMovieIds, prefs, today, watchedByShow, lastWatchedOrder, rewatchSinceMap } =
      await buildHomeHeader({ followRows, summary, watchedMovies, profile, myRatings, t });
    const body = await buildHomeBody({
      followRows,
      summary,
      watchedMovieIds,
      profile,
      movieProgress: movieProgressPromise,
      prefs,
      watchedByShow,
      lastWatchedOrder,
      rewatchSinceMap,
      myRatings,
      locale,
      t,
      today,
    });

    const [{ nextBackdrops }, upRows, trend] = await Promise.all([
      continueBackdrops({ toWatchCard: body.toWatchCard, playlistCards: body.playlistCards, listCards: body.listCards }),
      upcomingWithEpisodes(body.upcomingRow, t),
      // شرطُ الظهور التفضيلُ وحدَه (D-599) — من أخفاه لا يدفع نداءَه
      prefs.order.includes("trending") ? trendingRail() : Promise.resolve([]),
    ]);

    const upcoming_eps: Record<string, string> = {};
    for (const r of upRows) if (r.ep) upcoming_eps[r.key] = r.ep;

    const payload: HomeExtrasPayload = {
      backdrops: Object.fromEntries(nextBackdrops),
      upcoming_eps,
      trending: trend.map((r) => {
        const mt = r.media_type === "tv" ? "tv" : "movie";
        const seen = mt === "movie" ? watchedMovieIds.has(r.id) : body.doneShowIds.has(r.id);
        return {
          kind: mt,
          id: r.id,
          title: titleOf(r),
          poster_path: r.poster_path,
          year: yearOf(r),
          badge: mt === "tv" ? t.typeSeries : t.typeMovie,
          added: body.followedKeys.has(`${mt}-${r.id}`),
          watched: seen,
        };
      }),
    };
    return ok(payload);
  });
}
