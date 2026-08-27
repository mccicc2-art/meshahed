import {
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
import { getDict, type Locale } from "@/lib/i18n";
import { isComplete } from "@/lib/progress";
import { AnalysisView, tallyGenres, pickTasteTrioSlots, buildTaste, type TrioCandidate } from "./LibraryAnalysis";

/**
 * 🆕 **إحصائياتُ عضوٍ أزوره** (D-649، طلبُ أحمد: «كل الحسابات خلي الكارد
 * الأساسي فيها مسلسلات أفلام احصائيات»).
 *
 * 🔴 **ولماذا لم تُوجَّه الخانةُ إلى `/stats` وحسب**: تلك الصفحةُ تقرأ
 * **صاحبَ الجلسة** — **فزائرٌ يضغط «إحصائيات» في ملفِّ مشعل كان سيرى
 * أرقامَ نفسِه ويظنّها أرقامَه** (D-217: **بابٌ يَعِد بما لا يعطي أسوأُ
 * من بابٍ غائب**). **فالسطحُ جديدٌ والقارئُ هدفٌ صريح.**
 *
 * 🔑 **والوجهُ وجهُ `/stats` نفسُه** (`AnalysisView`) — **لا نسخةَ
 * ثانيةً منه** (القاعدة ٣/D-145): **المختلفُ القارئُ لا الرسم.**
 *
 * ⚠️ **وما لا تعطيه الدوالُّ العامّةُ يغيب لا يُصفَّر** (D-217):
 * — **لا سطرَ «منذ يناير»**: `user_watch_stats` تجمع بالمسلسل لا
 *   بالحلقة، **فلا تاريخَ حلقةٍ يُقرأ** — **وسطرٌ بأصفارٍ يقول «لم
 *   يشاهد شيئاً هذا العام» وهو كذب.**
 * — **ولا تبويباتُ مدى** للسبب نفسِه: **الرقمُ هنا كلُّ العمر، وقوسُ
 *   الحلقة كاملٌ لأنه الكلّ.**
 * — **و«جارٍ» للأفلام لا يُحسب**: `movie_progress` مقصورٌ على صاحبه،
 *   **فالفيلمُ عنده «شوهد» أو «لم يبدأ»** — والمسلسلاتُ بأقسامها الثلاثة.
 */
export async function MemberAnalysis({
  userId,
  locale,
}: {
  userId: string;
  locale: Locale;
}) {
  const t = getDict(locale);

  const [rawFollows, genres, ratings, epStats, mvStats, watched, art, pub, followStats] = await Promise.all([
    getFollowsOf(userId),
    getFollowGenresOf(userId),
    getRatingsOf(userId),
    getWatchStatsOf(userId),
    getMovieStatsOf(userId),
    getWatchedOf(userId),
    /* 🔴 **وأغلفتُه تُقرأ هنا كما تُقرأ في ملفّه** (D-131): **صفُّ
       المتابعة قد يكون بلا ملصقٍ أصلاً والغلافُ المختارُ هو الملصق** —
       **و«الأكثر مشاهدة» بمربّعاتٍ سوداء كان أوّلَ ما ظهر في الفحص
       الحيّ.** **ومصدرُ الصورة واحدٌ في السطحين** (D-145). */
    getProfileArt(userId),
    /* 🆕 **الهويّةُ للترويسة** (D-679) — العرضُ العامُّ نفسُه (فرعُ UUID
       من D-655) ودالّةُ العدّادين المحروسة (١٣٨). */
    getProfileByUsername(userId),
    getFollowStats(userId).catch(() => null),
  ]);

  /* العناوين بلغة القارئ لا بلغة يوم المتابعة (D-048) */
  const follows = await localizeRows(rawFollows, locale);
  if (art.size) {
    for (const f of follows) {
      const a = art.get(artKey(f.media_type, f.tmdb_id));
      if (a?.poster_path) f.poster_path = a.poster_path;
    }
  }

  if (!follows.length) {
    return <p className="text-sm text-muted text-center py-10">{t.analysisEmptyOther}</p>;
  }

  const tvFollows = follows.filter((f) => f.media_type === "tv");

  const { topGenres, genreTags, bySlug } = tallyGenres(
    follows.map((f) => genres.get(`${f.media_type}-${f.tmdb_id}`) ?? null),
    locale,
  );

  /* ===== 🆕 عقدُ D-679 — نفسُ تركيب `LibraryAnalysis` بقارئه العامّ ===== */
  const hero = pub
    ? {
        name: displayNameOf(pub, t.anonymousUser),
        avatarUrl: pub.avatar_url,
        /* **النبذةُ تتبع الاسمَ في الإخفاء** — والقطعُ في SQL أصلاً */
        bio: pub.hide_name ? null : (pub.bio ?? null),
        followers: followStats ? followStats.followers : null,
      }
    : null;

  /* ⚖️ **الثلاثيةُ فئويّةٌ هنا أيضاً** (D-682) — **المُنتقي واحدٌ
     والقارئان يطعمانه** (D-145): «جارٍ» للأفلام لا يُقرأ عند الزائر
     فالفيلمُ «شوهد» أو لا (تعليقُ الرأس) — والمعيارُ لا يحتاجه */
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
      category:
        f.media_type === "movie" ? "movie" : genreIds.includes(16) ? "anime" : "series",
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

  /* 🆕 D-700: خلفيّةُ الترويسة أوّلُ مفضّلاته في كلِّ قائمة (المُنتقي
     الفئويُّ سدُّ الفراغ)، وبطاقةُ ذوقه من كتالوج `title_meta` نفسِه */
  const [favs, animeFlags, metas] = await Promise.all([
    getProfileFavorites(userId),
    getProfileAnimeFlags(userId),
    getTitleMetaFor(follows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id }))),
  ]);
  const slots = pickTasteTrioSlots(trioCands);
  const isAnimeFav = (f: { media_type: string; tmdb_id: number }) =>
    animeFlags.get(`${f.media_type}-${f.tmdb_id}`) === true;
  const favSeries = favs.find((f) => f.media_type === "tv" && !isAnimeFav(f));
  const favAnime = favs.find((f) => isAnimeFav(f));
  const favMovie = favs.find((f) => f.media_type === "movie" && !isAnimeFav(f));
  const heroPosters = [
    favSeries?.poster_path ?? slots.series?.posterPath,
    favAnime?.poster_path ?? slots.anime?.posterPath,
    favMovie?.poster_path ?? slots.movie?.posterPath,
  ].filter((x): x is string => !!x);

  const taste = buildTaste({
    keys: follows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id })),
    metas,
    bySlug,
    genreTags,
    topGenres,
    t,
    locale,
  });

  return (
    <AnalysisView
      locale={locale}
      data={{
        minutes: epStats.minutes + mvStats.minutes,
        episodes: epStats.episodes,
        movies: mvStats.watched,
        /* 🆕 D-698: مسلسلاتُ مكتبته، وتعليقاتُه ما كُتب فيه نصٌّ فعلاً */
        shows: tvFollows.length,
        reviews: ratings.filter((r) => (r.review ?? "").trim().length > 0).length,
        /* **لا مدى للزائر** (تعليقُ الرأس) — فالصادقُ «كل الأوقات» */
        rangeLabel: t.statsAllTime,
        heroPosters,
        taste,
        mine: false,
        hero,
      }}
    />
  );
}
