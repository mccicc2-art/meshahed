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
  displayNameOf,
  artKey,
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

  /* ===== 🆕 عقدُ D-679 — نفسُ تركيب `LibraryAnalysis` بقارئه العامّ ===== */
  const hero = pub
    ? {
        name: displayNameOf(pub, t.anonymousUser),
        avatarUrl: pub.avatar_url,
        coverUrl: pub.cover_url,
        /* **النبذةُ تتبع الاسمَ في الإخفاء** — والقطعُ في SQL أصلاً */
        bio: pub.hide_name ? null : (pub.bio ?? null),
        followers: followStats ? followStats.followers : null,
      }
    : null;

  const sortedRatings = [...ratings].sort((a, b) => b.rating - a.rating);
  const trioMap = new Map<string, { key: string; title: string; posterPath: string | null; href: string }>();
  for (const r of sortedRatings) {
    if (trioMap.size >= 3) break;
    const key = `${r.media_type}-${r.tmdb_id}`;
    if (!trioMap.has(key) && r.title) {
      trioMap.set(key, {
        key,
        title: r.title,
        posterPath: r.poster_path,
        href: r.media_type === "movie" ? `/movie/${r.tmdb_id}` : `/show/${r.tmdb_id}`,
      });
    }
  }
  for (const w of topWatched) {
    if (trioMap.size >= 3) break;
    const key = `tv-${w.id}`;
    if (!trioMap.has(key)) {
      trioMap.set(key, { key, title: w.title, posterPath: w.posterPath, href: `/show/${w.id}` });
    }
  }

  const buckets = [0, 0, 0, 0, 0];
  for (const r of ratings) {
    buckets[Math.min(4, Math.max(0, Math.ceil(r.rating / 2) - 1))]++;
  }

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
        mine: false,
        hero,
        trio: [...trioMap.values()],
        buckets,
      }}
    />
  );
}
