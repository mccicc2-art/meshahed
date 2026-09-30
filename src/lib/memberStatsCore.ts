import "server-only";
import {
  getFollows,
  getFollowsOf,
  getFollowGenresOf,
  getRatingsOf,
  getWatchStatsOf,
  getMovieStatsOf,
  getWatchedOf,
  getProfileArt,
  getProfileByUsername,
  getFollowStats,
  getProfileFavorites,
  getProfileAnimeFlags,
  getTitleMetaFor,
  displayNameOf,
  artKey,
} from "@/lib/data";
import { localizeRows } from "@/lib/localize";
import { getDict, type Locale } from "@/core/i18n";
import { isComplete } from "@/core/progress";
import { tallyGenres, pickTasteTrioSlots, buildTaste, type AnalysisData, type TrioCandidate } from "@/components/LibraryAnalysis";
import { trioPosterPaths } from "@/core/heroPosters";
import { tasteMatch, onlyTheirs, type TasteMatch } from "@/core/tasteMatch";
import { browseGenreForId, browseGenreName } from "@/core/browse";

/**
 * ====== نواةُ «إحصاءات العضو» — Phase 11-N · N4 (٣٠ سبتمبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد (D-1192): «خلها اصلية»**. القراءةُ والاشتقاقُ كانا داخل `MemberAnalysis` (مكوّنٌ خادميّ) و`TasteMatchDoor` —
 * فخرجا هنا **بحرفهما** لتقرأهما صفحةُ `/u/{username}/stats` و`GET /api/v1/profile/{username}/stats` معاً (نهجُ `profileCore`:
 * مصدرٌ واحدٌ للحقيقة). الصفحةُ لا يتغيّر شكلُها — مكوّناها صارا يرسمان ما تعيده هذه.
 * 🔒 **الحارسُ في SQL كما هو**: كلُّ قارئٍ هنا دالّةُ `definer` تمرّ بـ`can_view_profile` (الحسابُ الخاصّ يعود فارغاً).
 */

/** تحليلُ مكتبة عضوٍ — `null` حين لا متابعاتِ له (الصفحةُ تقول `analysisEmptyOther`) */
export async function loadMemberAnalysis(userId: string, locale: Locale): Promise<AnalysisData | null> {
  const t = getDict(locale);

  const [rawFollows, genres, ratings, epStats, mvStats, watched, art, pub, followStats] = await Promise.all([
    getFollowsOf(userId),
    getFollowGenresOf(userId),
    getRatingsOf(userId),
    getWatchStatsOf(userId),
    getMovieStatsOf(userId),
    getWatchedOf(userId),
    /* الغلافُ المختارُ هو الملصقُ الحيّ — مصدرُ الصورة واحدٌ في السطحين (D-145) */
    getProfileArt(userId),
    getProfileByUsername(userId),
    getFollowStats(userId).catch(() => null),
  ]);

  const follows = await localizeRows(rawFollows, locale);
  if (art.size) {
    for (const f of follows) {
      const a = art.get(artKey(f.media_type, f.tmdb_id));
      if (a?.poster_path) f.poster_path = a.poster_path;
    }
  }
  if (!follows.length) return null;

  const tvFollows = follows.filter((f) => f.media_type === "tv");
  const { topGenres, allGenres, genreTags, bySlug } = tallyGenres(
    follows.map((f) => genres.get(`${f.media_type}-${f.tmdb_id}`) ?? null),
    locale,
  );

  const hero = pub
    ? {
        name: displayNameOf(pub, t.anonymousUser),
        avatarUrl: pub.avatar_url,
        bio: pub.hide_name ? null : (pub.bio ?? null),
        followers: followStats ? followStats.followers : null,
        identity: pub,
      }
    : null;

  const ratingByKey = new Map<string, number>();
  for (const r of ratings) {
    const key = `${r.media_type}-${r.tmdb_id}`;
    if (!ratingByKey.has(key)) ratingByKey.set(key, r.rating);
  }
  const trioCands: TrioCandidate[] = follows.map((f) => {
    const key = `${f.media_type}-${f.tmdb_id}`;
    const genreIds = genres.get(key) ?? [];
    const watchedEp = f.media_type === "tv" ? (epStats.byShow.get(f.tmdb_id)?.watched ?? 0) : 0;
    return {
      key,
      category: f.media_type === "movie" ? "movie" : genreIds.includes(16) ? "anime" : "series",
      title: f.title,
      posterPath: f.poster_path,
      href: f.media_type === "movie" ? `/movie/${f.tmdb_id}` : `/show/${f.tmdb_id}`,
      completed:
        f.media_type === "movie"
          ? watched.movies.has(f.tmdb_id)
          : isComplete(watchedEp, f.aired_episodes ?? f.total_episodes ?? 0),
      rating: ratingByKey.get(key) ?? null,
      watched: f.media_type === "movie" ? (watched.movies.has(f.tmdb_id) ? 1 : 0) : watchedEp,
    };
  });

  const [favs, animeFlags, metas] = await Promise.all([
    getProfileFavorites(userId),
    getProfileAnimeFlags(userId),
    getTitleMetaFor(follows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id }))),
  ]);
  const slots = pickTasteTrioSlots(trioCands);
  const isAnimeFav = (f: { media_type: string; tmdb_id: number }) => animeFlags.get(`${f.media_type}-${f.tmdb_id}`) === true;
  const favSeries = favs.find((f) => f.media_type === "tv" && !isAnimeFav(f));
  const favAnime = favs.find((f) => isAnimeFav(f));
  const favMovie = favs.find((f) => f.media_type === "movie" && !isAnimeFav(f));
  const heroPosters = trioPosterPaths({ movie: favMovie, anime: favAnime, series: favSeries }, slots);

  const taste = buildTaste({
    keys: follows.map((f) => ({
      media_type: f.media_type,
      tmdb_id: f.tmdb_id,
      title: f.title,
      poster: f.poster_path,
      genreIds: genres.get(`${f.media_type}-${f.tmdb_id}`) ?? null,
    })),
    metas,
    bySlug,
    genreTags,
    topGenres,
    allGenres,
    t,
    locale,
  });

  return {
    minutes: epStats.minutes + mvStats.minutes,
    episodes: epStats.episodes,
    movies: mvStats.watched,
    shows: tvFollows.length,
    reviews: ratings.length,
    rangeLabel: t.statsAllTime,
    heroPosters,
    taste,
    mine: false,
    hero,
  };
}

/** «أنت وهو» (D-814/D-829): التطابقُ من حصص الأنواع، وما في مكتبته وليس عندك — `null` لمن لا تُقارَن مكتبتُه (أو نفسي) */
export type TasteMatchOut = {
  match: TasteMatch;
  picks: { media_type: "tv" | "movie"; tmdb_id: number; title: string; poster_path: string | null }[];
};

export async function loadTasteMatch(meId: string | null, targetId: string, locale: Locale): Promise<TasteMatchOut | null> {
  if (!meId || meId === targetId) return null;
  const [mine, theirs, theirGenres] = await Promise.all([getFollows(), getFollowsOf(targetId), getFollowGenresOf(targetId)]);
  if (!mine.length || !theirs.length) return null;
  const { bySlug: myTally } = tallyGenres(mine.map((f) => f.genres ?? null), locale);
  const { bySlug: theirTally } = tallyGenres(
    theirs.map((f) => theirGenres.get(`${f.media_type}-${f.tmdb_id}`) ?? null),
    locale,
  );
  const match = tasteMatch(myTally, theirTally);
  if (match.thin) return null;
  const picks = onlyTheirs(mine, theirs, 12).map((f) => ({
    media_type: f.media_type,
    tmdb_id: f.tmdb_id,
    title: f.title,
    poster_path: f.poster_path,
  }));
  return { match, picks };
}

/** اسمُ النوع من مفتاحه — `tasteMatch` يعدّ بالمفاتيح (`browse` نفسُه) */
export function genreLabel(slug: string, locale: Locale): string {
  const g = GENRE_BY_SLUG.get(slug);
  return g ? browseGenreName(g, locale) : slug;
}
const GENRE_BY_SLUG = (() => {
  const m = new Map<string, NonNullable<ReturnType<typeof browseGenreForId>>>();
  const IDS = [
    28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37, 10759, 10762, 10763,
    10764, 10765, 10766, 10767, 10768,
  ];
  for (const id of IDS) {
    const g = browseGenreForId(id);
    if (g && !m.has(g.slug)) m.set(g.slug, g);
  }
  return m;
})();
