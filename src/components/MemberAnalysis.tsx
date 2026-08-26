import {
  getFollowsOf,
  getFollowGenresOf,
  getRatingsOf,
  getWatchStatsOf,
  getMovieStatsOf,
  getWatchedOf,
} from "@/lib/data";
import { localizeRows } from "@/lib/localize";
import { getDict, type Locale } from "@/lib/i18n";
import { isComplete } from "@/lib/progress";
import { AnalysisView, tallyGenres } from "./LibraryAnalysis";

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

  const [rawFollows, genres, ratings, epStats, mvStats, watched] = await Promise.all([
    getFollowsOf(userId),
    getFollowGenresOf(userId),
    getRatingsOf(userId),
    getWatchStatsOf(userId),
    getMovieStatsOf(userId),
    getWatchedOf(userId),
  ]);

  /* العناوين بلغة القارئ لا بلغة يوم المتابعة (D-048) */
  const follows = await localizeRows(rawFollows, locale);

  if (!follows.length) {
    return <p className="text-sm text-muted text-center py-10">{t.analysisEmpty}</p>;
  }

  const tvFollows = follows.filter((f) => f.media_type === "tv");
  const movieFollows = follows.filter((f) => f.media_type === "movie");

  let done = 0;
  let inProgress = 0;
  let notStarted = 0;
  for (const f of tvFollows) {
    const w = epStats.byShow.get(f.tmdb_id)?.watched ?? 0;
    const aired = f.aired_episodes ?? f.total_episodes ?? 0;
    if (isComplete(w, aired)) done++;
    else if (w > 0) inProgress++;
    else notStarted++;
  }
  for (const f of movieFollows) {
    if (watched.movies.has(f.tmdb_id)) done++;
    else notStarted++;
  }

  const { topGenres, genreTags } = tallyGenres(
    follows.map((f) => genres.get(`${f.media_type}-${f.tmdb_id}`) ?? null),
    locale,
  );

  const titleById = new Map(tvFollows.map((f) => [f.tmdb_id, f]));
  const topWatched = [...epStats.byShow.entries()]
    .filter(([id, s]) => s.watched > 0 && titleById.has(id))
    .sort((a, b) => b[1].watched - a[1].watched)
    .slice(0, 3)
    .map(([id, s]) => {
      const f = titleById.get(id)!;
      return { id, title: f.title, posterPath: f.poster_path, watched: s.watched };
    });

  const ratedTotal = ratings.length;
  const avgAll = ratedTotal ? ratings.reduce((n, r) => n + r.rating, 0) / ratedTotal : 0;

  return (
    <AnalysisView
      locale={locale}
      data={{
        minutes: epStats.minutes + mvStats.minutes,
        /* **القوسُ كاملٌ لأن المعروضَ هو الكلّ** — ولا مدى يُقسَم عليه */
        share: 1,
        episodes: epStats.episodes,
        movies: mvStats.watched,
        titles: follows.length,
        ratings: ratedTotal,
        avgRating: avgAll,
        year: null,
        topWatched,
        topGenres,
        genreTags,
        status: { done, inProgress, notStarted },
        ratedTotal,
        avgAll,
      }}
    />
  );
}
