import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getDict, type Locale } from "@/lib/i18n";
import { RailSkeleton } from "@/components/Skeletons";
import {
  getUser,
  getFollows,
  getMyTitleArt,
  artKey,
  getAllWatchedEpisodes,
  getWatchSummary,
  getWatchedMovies,
  watchedMovieMinutes,
  getProfile,
  getAllMovieProgress,
  getMyRatings,
  getMyLists,
  getFriendsWatching,
  getFollowLists,
  getIncomingFollowRequests,
  getReceivedLikes,
} from "@/lib/data";
import {
  getTv,
  getMovie,
  trending,
  titleOf,
  yearOf,
  type SearchResult,
} from "@/lib/tmdb";
/* حارسُ الرفوف — نفسُ الملفّ الذي يحرس اكتشف، **لا نسخةٌ ثانية** (D-321) */
import { railGuard } from "@/lib/topChart";
import { getWatchedForShow, getNewsGenStale, refreshLoopzNews } from "@/lib/data";
import { nextUnwatchedEpisode } from "@/lib/progress";
import { getT, getLocale } from "@/lib/locale";
import { whenLabel } from "@/lib/when";
import { localizeFollows, localizeRows } from "@/lib/localize";
import { airedEpisodeCount, percentOf } from "@/lib/progress";
import { PosterCard } from "@/components/PosterCard";
import { ContinueCard } from "@/components/ContinueCard";
import { ToWatchCard } from "@/components/ToWatchCard";
import { QuickSaveCard } from "@/components/QuickSaveCard";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { RailNewBadge } from "@/components/RailNewBadge";
import { PublicListsRail } from "@/components/PublicListsRail";
import { Icon, type IconName } from "@/components/Icon";
import { posterUrl } from "@/lib/media";
import { getWatchHistory } from "@/lib/data";
import { ProfileHeader, type HeaderStat } from "@/components/ProfileHeader";
import { getLevel, levelPoints } from "@/lib/level";
import {
  sanitizeHomePrefs,
  type HomeSection,
  type HeaderStatKey,
} from "@/lib/homePrefs";
import { capCards } from "@/lib/cardCount";
import { WeekStrip, type WeekEntry } from "@/components/WeekStrip";
import { ShowStatsSync, type ShowStat } from "@/components/ShowStatsSync";
import { FollowMetaSync, MovieStatsSync } from "@/components/MetaSync";
import { RoutePrewarm } from "@/components/RoutePrewarm";
import { LandingHero } from "@/components/LandingHero";
import { LandingContent } from "@/components/LandingContent";
import { JsonLd } from "@/components/JsonLd";
import { siteGraph, faqGraph, seoKeywords } from "@/lib/seo";

/**
 * الجذر يعرض صفحة الهبوط للزائر غير المسجّل بدل أن يحوّله (D-122).
 *
 * كان `redirect("/login")`، أي أن كل رابطٍ خارجي وكل إشارةٍ تصل إلى
 * loopztv.com تُهدَر على تحويلٍ إلى صفحةٍ بلا نصّ، ويفهرس قوقل عنوان
 * `/login` مكان الجذر. الآن الجذر نفسه يجيب بمحتوىً كامل: نفس الشاشة
 * الأولى بالضبط (بكسل ببكسل)، وتحتها ما يُقرأ ويُفهرَس.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    // الجذر هو الرابط الرسمي للعلامة، و`/login` يشير إليه بـcanonical
    alternates: { canonical: "/" },
    keywords: seoKeywords(locale),
  };
}

export default async function HomePage() {
  const user = await getUser();
  const { locale, t } = await getT();

  /* **بابٌ ثانٍ لتجديد الأخبار** (D-215): كان التجديدُ لا يقع إلا حين
     يُفتح تبويبُ الأخبار — **وهو أقلُّ أسطح التطبيق زيارةً**، فبقيت
     الأخبارُ ساكنةً ساعاتٍ (بلاغُ أحمد). والرئيسيةُ أكثرُها زيارةً،
     **والكلفةُ سؤالٌ منطقيٌّ واحد** على القاعدة، **والعملُ كلُّه بعد
     إرسال الصفحة** (`after`) فلا يبطئ رسمة. */
  if (user) {
    try {
      if (await getNewsGenStale(10)) after(() => refreshLoopzNews());
    } catch {
      /* تجديدُ الأخبار خدمةٌ خلفية — سقوطُه لا يمسّ الصفحة */
    }
  }

  if (!user) {
    /* البيانات المُهيكلة على الجذر لا في التخطيط: التخطيط يخدم كل صفحةٍ
       في التطبيق، وتكرار تعريف العلامة في مئات الصفحات ضجيجٌ لا إشارة.
       الجذر هو الصفحة التي تُعرّف بالمنتج، فهنا موضعها. */
    return (
      <>
        <JsonLd data={siteGraph(locale, getDict(locale))} />
        <JsonLd data={faqGraph(locale)} />
        <LandingHero variant="flow" showWordmark={false} />
        <LandingContent locale={locale} />
      </>
    );
  }

  // ملخّص مجمّع: صف لكل مسلسل بدل صف لكل حلقة (آلاف الصفوف سابقاً).
  // صفوف الحلقات التفصيلية تُقرأ لاحقاً لمسلسل واحد فقط — صاحب «الحلقة التالية».
  const [
    followRows,
    summary,
    watchedMovies,
    profile,
    movieProgress,
    myRatings,
    receivedLikes,
    followLists,
    followRequests,
  ] = await Promise.all([
    getFollows(),
    getWatchSummary(),
    getWatchedMovies(),
    getProfile(),
    getAllMovieProgress(),
    getMyRatings(),
    getReceivedLikes(user.id),
    /* قائمتا المتابعة وطلباتها — انتقل عدّاداهما إلى الترويسة (D-133)،
       والقائمتان تُقرآن معهما لأن الورقتين تُفتحان من هنا. استعلاماتٌ
       ثلاثة سقطت عن `/people` مقابل هذه، فالميزان لم يتغيّر */
    getFollowLists(user.id),
    getIncomingFollowRequests(),
  ]);

  // مستخدم بلا مكتبة يذهب لشاشة الانضمام — قبل أي رسمٍ أو جلبٍ آخر
  if (followRows.length === 0) redirect("/welcome");

  /* احتياط ما قبل performance.sql — كان في الموجة الثانية وصعد هنا:
     أرقام الترويسة تُبنى من عدّاد المشاهدات، والترويسة (منذ D-087) تُرسم
     قبل الموجة الثانية. من شغّل performance.sql لا يدفع هذا الطلب أصلاً */
  const fallbackEps = summary ? null : await getAllWatchedEpisodes();

  // مجموعة المعرّفات للحالة، والدقائق الفعلية للوقت — من الصفوف نفسها
  const watchedMovieIds = new Set(watchedMovies.map((m) => m.id));
  const movieMinutes = watchedMovieMinutes(watchedMovies);

  const prefs = sanitizeHomePrefs(profile?.home_prefs);

  const myRatingsCount = myRatings.length;
  const myComments = myRatings.filter((r) => r.review?.trim()).length;

  const today = new Date().toISOString().slice(0, 10);

  /* ===== الموجة الثانية: كل ما تبقّى من قراءاتٍ خارجية دفعةً واحدة =====
     كانت الصفحة سبع موجات انتظارٍ متسلسلة (ترجمة ← تهيئة ← بطاقات ←
     رائج ← أفلام ← ملخّص) رغم أن أغلبها مستقل. المعرّفات والأعداد كلها
     تُحسب من الصفوف الخام قبل الترجمة — الترجمة تغيّر النص لا الهوية —
     فتنطلق الطلبات كلها معاً وتبقى موجتان لا سبع. */

  const rawActive = followRows.filter((f) => !f.dropped);
  const rawTv = rawActive.filter((f) => f.media_type === "tv");
  const rawMovies = rawActive.filter((f) => f.media_type === "movie");

  const watchedByShow = new Map<number, number>();
  // المسلسلات مرتّبة من الأحدث مشاهدةً — أساس اختيار «الحلقة التالية» والاقتراحات
  let lastWatchedOrder: number[] = [];
  if (summary) {
    for (const s of summary) watchedByShow.set(s.show_tmdb_id, s.watched);
    lastWatchedOrder = [...summary]
      .sort((a, b) => (b.last_watched ?? "").localeCompare(a.last_watched ?? ""))
      .map((s) => s.show_tmdb_id);
  }

  // لحظات بدء الإعادة بيدنا هنا — تُمرَّر فلا يستعلم عنها أحد مرة ثانية
  const rewatchSinceMap = new Map<number, string>();
  for (const f of rawTv) {
    if (f.rewatch_started_at) rewatchSinceMap.set(f.tmdb_id, f.rewatch_started_at);
  }

  if (!summary && fallbackEps) {
    // مسار ما قبل performance.sql — مع احترام دورات الإعادة
    for (const w of fallbackEps) {
      const since = rewatchSinceMap.get(w.show_tmdb_id);
      if (since && w.watched_at < since) continue;
      watchedByShow.set(
        w.show_tmdb_id,
        (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1,
      );
    }
    for (const w of [...fallbackEps].sort((a, b) =>
      b.watched_at.localeCompare(a.watched_at),
    )) {
      if (!lastWatchedOrder.includes(w.show_tmdb_id))
        lastWatchedOrder.push(w.show_tmdb_id);
    }
  }

  /* ===== أرقام الترويسة — من الموجة الأولى وحدها (D-087) =====
     الترجمة تغيّر الأسماء لا الأعداد، وتفاصيل TMDB تُجمّل البطاقات لا
     العدّادات — فالترويسة تُرسم من الصفوف الخام فوراً ولا تنتظر الموجة
     الثانية. استثناء واحد مقصود: عدّاد «القادم» يقرأ تواريخ الأفلام
     المخزّنة فقط؛ فيلمٌ توبِع للتوّ ينضم للعدّاد بعد أول مزامنةٍ لبياناته
     (MovieStatsSync تكتبها من أول رسمة) — نقصٌ نادر يشفى ذاتياً. */
  let unfinishedCount = 0;
  let finishedShowsCount = 0;
  for (const row of rawTv) {
    const aired = row.aired_episodes ?? row.total_episodes ?? 0;
    const watched = Math.min(
      watchedByShow.get(row.tmdb_id) ?? 0,
      aired || Infinity,
    );
    if (aired === 0 || watched < aired) unfinishedCount++;
    if (aired > 0 && watched >= aired) finishedShowsCount++;
  }
  const finishedMoviesCount = rawMovies.filter((f) =>
    watchedMovieIds.has(f.tmdb_id),
  ).length;
  const toWatchCount =
    unfinishedCount +
    rawMovies.filter((f) => !watchedMovieIds.has(f.tmdb_id)).length;
  const droppedCount = followRows.filter((f) => f.dropped).length;

  const watchedEpisodeTotal = [...watchedByShow.values()].reduce(
    (a, n) => a + n,
    0,
  );
  const level = getLevel(
    levelPoints(watchedEpisodeTotal, watchedMovieIds.size),
  );

  const totalMinutes =
    (summary ?? []).reduce((a, r) => a + (r.minutes ?? 0), 0) + movieMinutes;
  const hours = Math.round(totalMinutes / 60);
  const watchTime =
    hours < 24 ? t.hours(hours) : t.days(Math.floor(hours / 24));

  const upcomingCount = Math.min(
    16,
    rawTv.filter((r) => r.next_air_date && r.next_air_date >= today).length +
      rawMovies.filter(
        (f) =>
          !watchedMovieIds.has(f.tmdb_id) &&
          f.stats_updated_at != null &&
          f.next_air_date &&
          f.next_air_date >= today,
      ).length,
  );

  const allHeaderStats: Record<HeaderStatKey, HeaderStat> = {
    shows: {
      key: "shows",
      icon: "tv",
      value: String(rawTv.length),
      label: t.shortShows,
      href: "/library?filter=tv",
      color: "var(--accent)",
    },
    movies: {
      key: "movies",
      icon: "film",
      value: String(rawMovies.length),
      label: t.shortMovies,
      href: "/library?filter=movie",
      color: "var(--accent-2)",
    },
    towatch: {
      key: "towatch",
      icon: "bookmark",
      value: String(toWatchCount),
      label: t.libToWatch,
      href: "/library",
      color: "var(--brand-3)",
    },
    time: {
      key: "time",
      icon: "clock",
      value: watchTime,
      label: t.statWatchTime,
      href: "/stats",
      color: "var(--accent)",
    },
    episodes: {
      key: "episodes",
      icon: "play",
      value: String(watchedEpisodeTotal),
      label: t.shortEpisodes,
      href: "/stats",
      color: "var(--info)",
    },
    upcoming: {
      key: "upcoming",
      icon: "hourglass",
      value: String(upcomingCount),
      label: t.libUpcoming,
      href: "/library",
      color: "var(--brand-3)",
    },
    completed: {
      key: "completed",
      icon: "check",
      value: String(finishedShowsCount + finishedMoviesCount),
      label: t.libTabFinished,
      href: "/library",
      color: "var(--success)",
    },
    dropped: {
      key: "dropped",
      icon: "card",
      value: String(droppedCount),
      label: t.droppedBadge,
      href: "/library",
      color: "var(--error)",
    },
    // خانة «تقييماتي» في بطاقة الأرقام (طلب أحمد 9 Aug)
    ratings: {
      key: "ratings",
      icon: "star",
      value: String(myRatingsCount),
      label: t.panelRatings,
      href: "/ratings",
      color: "var(--verified)",
    },
  };
  const headerStats: HeaderStat[] = prefs.statsPick.map(
    (k) => allHeaderStats[k],
  );

  const displayName = profile?.nickname || user.email?.split("@")[0] || "";

  /* ===== D-087: الترويسة فوراً والجسدُ يتدفق =====
     كانت الصفحة تنتظر موجتي جلبٍ كاملتين قبل أول بايت (~1.2s باردةً).
     الآن الترويسة تخرج من الموجة الأولى وحدها، والجسد الثقيل — ترجمة
     المكتبة وتفاصيل TMDB وكل الصفوف — خلف Suspense يصل حين يجهز.
     الهيكل يحجز ارتفاع صفّين (D-046). نمطُ /news نفسه (D-071). */
  return (
    <div className="space-y-8 sm:space-y-10">
      {/* تسخين بقية التبويبات بعد هدوء الرئيسية (طلب أحمد) — أول ضغطة
          تبويب تُعاد من كاش الراوتر لحظياً. البحث ليس بينها: تبويبه
          ورقةٌ تنبثق لا صفحةٌ تُجلب */}
      <RoutePrewarm routes={["/news", "/library", "/people"]} />
      <ProfileHeader
        displayName={displayName}
        bioText={profile?.bio ?? null}
        username={profile?.username ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        coverUrl={profile?.cover_url ?? null}
        coverPos={profile?.cover_pos ?? null}
        avatarPos={profile?.avatar_pos ?? null}
        level={level}
        stats={headerStats}
        followingList={followLists.following}
        followersList={followLists.followers}
        followRequests={followRequests}
        comments={myComments}
        ratings={myRatingsCount}
        likes={receivedLikes}
        show={prefs}
        verified
        locale={locale}
      />
      <Suspense
        fallback={
          <div className="space-y-8" aria-hidden>
            <RailSkeleton count={6} />
            <RailSkeleton count={6} />
          </div>
        }
      >
        <HomeBody
          followRows={followRows}
          summary={summary}
          watchedMovieIds={watchedMovieIds}
          profile={profile}
          movieProgress={movieProgress}
          prefs={prefs}
          watchedByShow={watchedByShow}
          lastWatchedOrder={lastWatchedOrder}
          rewatchSinceMap={rewatchSinceMap}
          myRatings={myRatings}
          locale={locale}
          t={t}
          today={today}
        />
      </Suspense>
    </div>
  );
}

type T = Awaited<ReturnType<typeof getT>>["t"];

/**
 * جسد الرئيسية — كل ما تحت الترويسة (D-087).
 *
 * مكوّن خادمٍ مستقل خلف Suspense: يحمل الموجة الثانية كاملة (ترجمة
 * المكتبة، تفاصيل TMDB، بطاقات «أكمل المشاهدة»…) بعيداً عن المسار الحرج،
 * فأول بايت للصفحة لم يعد رهينة أبطأ طلبٍ خارجي.
 */
async function HomeBody({
  followRows,
  summary,
  watchedMovieIds,
  profile,
  movieProgress,
  prefs,
  watchedByShow,
  lastWatchedOrder,
  rewatchSinceMap,
  myRatings,
  locale,
  t,
  today,
}: {
  followRows: Awaited<ReturnType<typeof getFollows>>;
  summary: Awaited<ReturnType<typeof getWatchSummary>>;
  watchedMovieIds: Set<number>;
  profile: Awaited<ReturnType<typeof getProfile>>;
  movieProgress: Awaited<ReturnType<typeof getAllMovieProgress>>;
  prefs: ReturnType<typeof sanitizeHomePrefs>;
  watchedByShow: Map<number, number>;
  lastWatchedOrder: number[];
  rewatchSinceMap: Map<number, string>;
  myRatings: Awaited<ReturnType<typeof getMyRatings>>;
  locale: Locale;
  t: T;
  today: string;
}) {
  const rawActive = followRows.filter((f) => !f.dropped);
  const rawTv = rawActive.filter((f) => f.media_type === "tv");
  const rawMovies = rawActive.filter((f) => f.media_type === "movie");

  // الصفوف التي لم يُحسب لها عدد حلقات بعد تحتاج TMDB مرة واحدة لتهيئتها
  const bootstrapIds = rawTv
    .filter((f) => f.aired_episodes == null)
    .slice(0, 12)
    .map((f) => f.tmdb_id);

  // مرشّحو «أكمل المشاهدة» يُعرفون من الملخّص قبل الترجمة — فتنضم
  // تفاصيلهم إلى نفس الموجة بدل موجةٍ خاصة بهم
  const CONTINUE_CARDS = 4;
  /* نستطلع أكثر مما نعرض: البطاقات أربع، لكن معرفة «الحلقة التالية»
     تلزم لكل عملٍ قيد المشاهدة لا للبطاقات وحدها — بها نعرف مَن ينتظره
     موسمٌ جديد فيبقى في «للمشاهدة». عشرةٌ سقفٌ يكفي ولا يفتح موجة
     طلباتٍ بحجم المكتبة. */
  const CONTINUE_PROBE = 10;
  const earlyContinueIds: number[] = summary
    ? rawTv
        .map((row) => {
          const aired = row.aired_episodes ?? row.total_episodes ?? 0;
          const watched = Math.min(watchedByShow.get(row.tmdb_id) ?? 0, aired || Infinity);
          return { id: row.tmdb_id, watched, aired };
        })
        .filter((i) => i.watched > 0 && (i.aired === 0 || i.watched < i.aired))
        .sort((a, b) => {
          const ai = lastWatchedOrder.indexOf(a.id);
          const bi = lastWatchedOrder.indexOf(b.id);
          return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
        })
        .slice(0, CONTINUE_PROBE)
        .map((i) => i.id)
    : [];

  // «الرائج» يظهر فقط لمن لا يشاهد شيئاً الآن — معروفٌ مسبقاً مع الملخّص
  const earlyShowTrending = summary ? earlyContinueIds.length === 0 : false;

  // مواعيد الأفلام: المخزّن في صفّ المتابعة يغني عن TMDB، والناقص يُطلب
  // مرة واحدة ثم يُخزَّن عبر MovieStatsSync
  const upcomingMovieCandidates = rawMovies
    .filter((f) => !watchedMovieIds.has(f.tmdb_id))
    .slice(0, 10);
  const movieIdsNeedingDate = upcomingMovieCandidates
    .filter((f) => f.stats_updated_at == null)
    .map((f) => f.tmdb_id);

  /* قسما «تقييماتي» و«قوائمي» (طلب أحمد 9 Aug) — لا يدفع كلفتهما إلا
     من أظهرهما من التخصيص، كقاعدة «recap» نفسها */
  const topRatedRaw = prefs.order.includes("ratings")
    ? [...myRatings]
        .sort((a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at))
        .slice(0, 16)
    : [];

  const [
    follows,
    bootstrapDetails,
    fetchedMovieDetails,
    recapHist,
    earlyExtra,
    earlyTrend,
    topRated,
    myListsRaw,
    friendsRows,
  ] = await Promise.all([
    // أسماء المكتبة وملصقاتها بلغة الواجهة لا بلغة يوم المتابعة
    localizeFollows(followRows, locale),
    Promise.all(bootstrapIds.map((id) => getTv(id).catch(() => null))),
    Promise.all(movieIdsNeedingDate.map((id) => getMovie(id).catch(() => null))),
    prefs.order.includes("recap")
      ? getWatchHistory(300).catch(() => [])
      : Promise.resolve(null),
    Promise.all(
      earlyContinueIds.map(async (id) => {
        const [tv, keys] = await Promise.all([
          getTv(id).catch(() => null),
          getWatchedForShow(id, rewatchSinceMap.get(id) ?? null).catch(
            () => new Set<string>(),
          ),
        ]);
        const next = tv ? nextUnwatchedEpisode(tv, keys) : null;
        return {
          id,
          backdropPath: tv?.backdrop_path ?? null,
          episodeLabel: next ? `S${next.season} E${next.episode}` : null,
          season: next?.season ?? null,
          episode: next?.episode ?? null,
          runtime: tv?.episode_run_time?.[0] ?? null,
        };
      }),
    ),
    /* 🆕 **والحارسُ على فم «الرائج» هنا أيضاً** (D-321): هذا الصفُّ ينادي
       `/trending` عارياً منذ أوّل يوم — **وليس عطلاً عاد، بل موضعٌ لم
       يُعالَج قطّ**: حارسُ D-194 وُلد في `news/page.tsx` وحدَه فبقي الكوريُّ
       والهنديُّ يدخلان من أوّل شاشةٍ تُفتح. و`anime: "keep"` مقصودة —
       الرئيسيةُ ليست تبويبَ أفلامٍ ولا مسلسلات، ولم يطلب أحدٌ إخراجَ
       الأنمي منها. */
    earlyShowTrending
      ? trending()
          .then((rows) => railGuard(rows, { anime: "keep" }))
          .catch(() => [] as SearchResult[])
      : Promise.resolve(null),
    // العناوين بلغة الواجهة لا بلغة يوم التقييم (قاعدة D-048)
    topRatedRaw.length
      ? localizeRows(topRatedRaw, locale).catch(() => topRatedRaw)
      : Promise.resolve(topRatedRaw),
    prefs.order.includes("lists")
      ? getMyLists().catch(() => [])
      : Promise.resolve([]),
    /* 🆕 **«أعمالُ أصدقائك الآن»** (البند ٧) — **ولا يدفع كلفتَه إلا من
       أظهره** (قاعدةُ «recap» و«قوائمي» نفسُها)، **وهو نداءُ الخطّ نفسِه
       بلا إعجاباتٍ ولا ترجمة** (D-205). */
    prefs.order.includes("friends")
      ? getFriendsWatching(12).catch(() => [])
      : Promise.resolve([]),
  ]);

  /* أغلفتي المختارة (D-131) — استبدالٌ في مصدرٍ واحد بعد الترجمة: بطاقات
     «أكمل» و«ابدأ» و«للمشاهدة» كلّها تُبنى من `follows`، والرئيسية سطحي
     أنا فلا تسريب (ق٨). التقييمات كذلك — بطاقةُ عملٍ قيّمتُه في صفحتي. */
  const homeArt = await getMyTitleArt();
  if (homeArt.size) {
    for (const f of follows) {
      const a = homeArt.get(artKey(f.media_type, f.tmdb_id));
      if (a?.poster_path) f.poster_path = a.poster_path;
    }
    for (const r of topRated) {
      const a = homeArt.get(artKey(r.media_type, r.tmdb_id));
      if (a?.poster_path) r.poster_path = a.poster_path;
    }
  }

  /* قوائمي بنفس بطاقة المجتمع (PublicListCard): بطاقة واحدة للأبواب
     كلها — بلا سطر صاحبٍ فالصفحة صفحته، والفارغة لا تُعرض */
  const myListCards = myListsRaw
    .map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind ?? null,
      owner: null,
      item_count: l.item_count,
      posters: l.posters ?? [],
    }))
    .filter((c) => c.item_count > 0);

  // ما تغيّر اسمه بالترجمة يُكتب مرة واحدة في قاعدة البيانات
  const metaToCache = follows
    .filter((f, n) => f.title !== followRows[n]?.title)
    .slice(0, 24)
    .map((f) => ({
      tmdbId: f.tmdb_id,
      mediaType: f.media_type,
      title: f.title,
      posterPath: f.poster_path,
    }));

  // الموقوف ببطاقةٍ حمراء لا مكان له في الرئيسية — مكانه المكتبة وحدها
  const active = follows.filter((f) => !f.dropped);
  const tvFollows = active.filter((f) => f.media_type === "tv");
  const movieFollows = active.filter((f) => f.media_type === "movie");

  interface UpcomingItem {
    key: string;
    href: string;
    title: string;
    posterPath: string | null;
    date: string;
  }

  /**
   * المسلسل كما تحتاجه هذه الصفحة.
   *
   * كانت الصفحة تطلب من TMDB تفاصيل كل مسلسل في المكتبة — أربعون متابعة
   * تعني أربعين طلباً خارجياً قبل أن يظهر شيء. وكل ما نعرضه هنا (الاسم،
   * الملصق، الحلقات المعروضة، موعد القادمة) مخزّنٌ عندنا في صفّ المتابعة
   * نفسه، يُحدَّث من صفحة المسلسل ومن `ShowStatsSync`. فالطلبات الخارجية
   * بقيت للحالتين اللتين تحتاجانها فعلاً: بطاقة «الحلقة التالية»، وصفٌّ
   * جديد لم يُحسب له عدد بعد.
   */
  type Item = {
    id: number;
    name: string;
    posterPath: string | null;
    watched: number;
    aired: number;
    progress: number;
  };

  const items: Item[] = [];
  const upcoming: UpcomingItem[] = [];

  for (const row of tvFollows) {
    const aired = row.aired_episodes ?? row.total_episodes ?? 0;
    // لا تتجاوز المشاهَد ما عُرض، وإلا خرجت نسبة فوق ١٠٠٪
    const watched = Math.min(
      watchedByShow.get(row.tmdb_id) ?? 0,
      aired || Infinity,
    );
    items.push({
      id: row.tmdb_id,
      name: row.title,
      posterPath: row.poster_path,
      watched,
      aired,
      progress: percentOf(watched, aired),
    });

    if (row.next_air_date && row.next_air_date >= today) {
      upcoming.push({
        key: `tv-${row.tmdb_id}`,
        href: `/show/${row.tmdb_id}`,
        title: row.title,
        posterPath: row.poster_path,
        date: row.next_air_date,
      });
    }
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  // كل ما لم يكتمل — ثم ما بدأته فعلاً
  const unfinished = items
    .filter((i) => i.aired === 0 || i.watched < i.aired)
    .sort((a, b) => {
      if (a.watched > 0 !== b.watched > 0) return a.watched > 0 ? -1 : 1;
      return b.progress - a.progress;
    });

  const continueWatching = unfinished.filter((i) => i.watched > 0);

  const statsToCache: ShowStat[] = [];
  for (const tv of bootstrapDetails) {
    if (!tv) continue;
    const row = tvFollows.find((f) => f.tmdb_id === tv.id);
    if (!row) continue;
    const nextDate = tv.next_episode_to_air?.air_date ?? null;
    statsToCache.push({
      tmdbId: tv.id,
      total: tv.number_of_episodes ?? 0,
      aired: airedEpisodeCount(tv),
      nextAirDate: nextDate,
    });
  }

  // ===== أكمل المشاهدة =====
  // ما أنت في وسطه، الأحدث مشاهدةً أولاً — صفٌّ واحد حلّ محلّ البطاقة
  // العريضة التي كانت تعرض عملاً واحداً وتأخذ ثلث الشاشة
  const continueRow = [...continueWatching].sort((a, b) => {
    const ai = lastWatchedOrder.indexOf(a.id);
    const bi = lastWatchedOrder.indexOf(b.id);
    return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
  });

  /* بطاقات «أكمل المشاهدة»: تفاصيلها جاءت مع الموجة الثانية أصلاً في
     المسار الطبيعي؛ الاحتياط (قبل performance.sql) وحده يطلبها هنا */
  const continueTop = continueRow.slice(0, CONTINUE_CARDS);
  const extraById = new Map(earlyExtra.map((e) => [e.id, e]));

  /* موسمٌ جديد ينتظر: أنهيت كل ما سبق، وأوّل حلقةٍ لم تُشاهَد هي حلقة
     موسمٍ جديد. هذا العمل «لم يبدأ» من جهة المستخدم وإن كان في وسط
     المسلسل، فيبقى في «للمشاهدة» ولا يُطوى في «أكمل المشاهدة» وحدها. */
  const newSeasonWaiting = new Set(
    earlyExtra
      .filter((e) => e.episode === 1 && (e.season ?? 0) > 1)
      .map((e) => e.id),
  );
  const continueExtra = summary
    ? continueTop.map(
        (i) =>
          extraById.get(i.id) ?? {
            id: i.id,
            backdropPath: null,
            episodeLabel: null,
            season: null,
            episode: null,
            runtime: null,
          },
      )
    : await Promise.all(
        continueTop.map(async (i) => {
          const [tv, keys] = await Promise.all([
            getTv(i.id).catch(() => null),
            getWatchedForShow(i.id, rewatchSinceMap.get(i.id) ?? null).catch(
              () => new Set<string>(),
            ),
          ]);
          const next = tv ? nextUnwatchedEpisode(tv, keys) : null;
          return {
            id: i.id,
            backdropPath: tv?.backdrop_path ?? null,
            episodeLabel: next ? `S${next.season} E${next.episode}` : null,
            season: next?.season ?? null,
            episode: next?.episode ?? null,
            runtime: tv?.episode_run_time?.[0] ?? null,
          };
        }),
      );

  const empty = false;

  const favGenres = profile?.favorite_genres ?? [];

  // «الرائج» احتياطٌ لمن لا شيء في يده الآن — جاء مع الموجة الثانية في
  // المسار الطبيعي، والاحتياط وحده يطلبه هنا
  const showTrending = empty || continueWatching.length === 0;
  /* **والمساران يمرّان بالحارس نفسِه** (D-321): هذا هو المسار البطيء
     (بلا موجةٍ أولى)، **ونسخةٌ واحدةٌ محروسةٌ من اثنتين تعني أن نصفَ
     الزيارات ترى المكتوم** — وهو بالضبط ما كلّفنا D-175. */
  const trend: SearchResult[] =
    earlyTrend ??
    (showTrending
      ? await trending()
          .then((rows) => railGuard(rows, { anime: "keep" }))
          .catch(() => [] as SearchResult[])
      : []);


  // لزرّ الحفظ السريع على «الرائج»: ما تتابعه، وما أنهيته فعلاً
  const followedKeys = new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`));
  const doneShowIds = new Set(
    items.filter((i) => i.aired > 0 && i.watched >= i.aired).map((i) => i.id),
  );

  // ===== مسلسلاتي: كل ما تتابعه، الأقرب إلى الاستئناف أولاً =====
  const myShows = [...items].sort((a, b) => {
    const rank = (i: typeof a) =>
      i.watched > 0 && (i.aired === 0 || i.watched < i.aired)
        ? 0
        : i.watched === 0
          ? 1
          : 2;
    const d = rank(a) - rank(b);
    return d !== 0 ? d : b.progress - a.progress;
  });

  // ===== أفلامي: الموضع المحفوظ يصير شريط تقدّم، والمشاهَد يمتلئ =====
  const progressById = new Map(movieProgress.map((m) => [m.movie_tmdb_id, m]));
  const myMovies = movieFollows
    .map((f) => {
      const prog = progressById.get(f.tmdb_id);
      const done = watchedMovieIds.has(f.tmdb_id);
      const pct = done
        ? 100
        : prog?.runtime_minutes && prog.runtime_minutes > 0
          ? Math.round((prog.position_minutes / prog.runtime_minutes) * 100)
          : 0;
      return {
        tmdbId: f.tmdb_id,
        title: f.title,
        posterPath: f.poster_path,
        progress: pct,
        badge: done
          ? "✓"
          : prog
            ? t.minuteBadge(prog.position_minutes)
            : t.typeMovie,
        rank: done ? 2 : prog ? 0 : 1,
      };
    })
    .sort((a, b) => a.rank - b.rank || b.progress - a.progress);

  // ===== «للمشاهدة» و«القادم» في الرئيسية: مسلسلات وأفلام معاً =====
  // للمشاهدة: كل ما لم يكتمل — المسلسلات غير المنتهية والأفلام غير
  // المشاهَدة — بترتيب الأقرب إلى الاستئناف. القادم: ما له موعدٌ آتٍ.
  type MixedItem = {
    key: string;
    mediaType?: "tv" | "movie";
    tmdbId?: number;
    runtime?: number | null;
    href: string;
    title: string;
    posterPath: string | null;
    progress?: number;
    badge?: string;
    badgeTone?: "neutral" | "progress" | "watched" | "rating";
  };

  const toWatchRow: MixedItem[] = [
    ...myShows
      /* لا تكرار بين الصفّين: ما بدأته مكانه «أكمل المشاهدة» وحدها،
         و«للمشاهدة» لِما لم يبدأ — عملٌ جديد، أو موسمٌ جديد ينتظر أوّل
         حلقةٍ منه. كان الصفّان يعرضان الشيء نفسه فيقرأ المستخدم مكتبته
         مرّتين ويظنّ أن أحدهما معطّل. قرارُ المالك. */
      .filter(
        (i) =>
          (i.aired === 0 || i.watched < i.aired) &&
          (i.watched === 0 || newSeasonWaiting.has(i.id)),
      )
      .map((i) => ({
        key: `tw-tv-${i.id}`,
        mediaType: "tv" as const,
        tmdbId: i.id,
        href: `/show/${i.id}`,
        title: i.name,
        posterPath: i.posterPath,
        progress: i.progress,
        badge: i.watched === 0 ? t.notStartedBadge : undefined,
      })),
    ...myMovies
      .filter((m) => m.progress < 100)
      .map((m) => ({
        key: `tw-mv-${m.tmdbId}`,
        mediaType: "movie" as const,
        tmdbId: m.tmdbId,
        runtime: progressById.get(m.tmdbId)?.runtime_minutes ?? null,
        href: `/movie/${m.tmdbId}`,
        title: m.title,
        posterPath: m.posterPath,
        progress: m.progress,
        badge: m.progress === 0 ? t.typeMovie : m.badge,
      })),
  ].slice(0, 16);

  // مواعيد الأفلام: المخزّن يُقرأ من صفّ المتابعة، والمجلوب حديثاً يُكتب
  // عبر MovieStatsSync فلا يُطلب مرتين
  const fetchedDateById = new Map(
    movieIdsNeedingDate.map((id, n) => [id, fetchedMovieDetails[n]?.release_date ?? null]),
  );
  const movieDatesToCache = movieIdsNeedingDate.map((id) => ({
    tmdbId: id,
    releaseDate: fetchedDateById.get(id) ?? null,
  }));
  const movieDateOf = (f: (typeof upcomingMovieCandidates)[number]) =>
    f.stats_updated_at != null ? (f.next_air_date ?? null) : (fetchedDateById.get(f.tmdb_id) ?? null);

  const upcomingRow: MixedItem[] = [
    ...upcoming.map((u) => ({
      key: `up-${u.key}`,
      href: u.href,
      title: u.title,
      posterPath: u.posterPath,
      badge: whenLabel(u.date, t),
      date: u.date,
    })),
    ...upcomingMovieCandidates
      .map((f) => ({ f, d: movieDateOf(f) }))
      .filter(({ d }) => d && d >= today)
      .map(({ f, d }) => ({
        key: `up-mv-${f.tmdb_id}`,
        href: `/movie/${f.tmdb_id}`,
        title: f.title,
        posterPath: f.poster_path,
        badge: whenLabel(d!, t),
        date: d!,
      })),
  ]
    .sort((a, b) => (a as { date: string }).date.localeCompare((b as { date: string }).date))
    .slice(0, 16);

  // ===== ملخّص أسبوعك — قسمٌ اختياري يطيع نظام التخصيص كأي قسم =====
  // لا يُقرأ السجلّ إلا لمن فعّله، ولا يُرسم إن كان الأسبوع صفراً
  let recap: { line: string; posters: (string | null)[] } | null = null;
  if (prefs.order.includes("recap") && recapHist) {
    const hist = recapHist;
    // مكوّن خادمي ديناميكي: لحظة الطلب جزء من مدخلات الرسم لا كسرٌ لنقائه —
    // «أسبوعك» يُحسب من الآن، وقاعدة النقاء كُتبت لإعادة رسم العميل لا لهذا
    // eslint-disable-next-line react-hooks/purity
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const rows = hist.filter((h) => h.watchedAt >= weekAgo);
    if (rows.length > 0) {
      const eps = rows.filter((h) => h.kind === "episode").length;
      const mv = rows.filter((h) => h.kind === "movie").length;
      const mins = rows.reduce(
        (n, h) => n + (h.runtime ?? (h.kind === "movie" ? 110 : 40)),
        0,
      );
      const hrs = Math.round(mins / 60);
      const seen = new Set<string>();
      const posters: (string | null)[] = [];
      for (const h of rows) {
        const key = `${h.kind === "movie" ? "movie" : "tv"}-${h.tmdbId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const f = follows.find(
          (x) => `${x.media_type}-${x.tmdb_id}` === key,
        );
        posters.push(f?.poster_path ?? null);
        if (posters.length === 3) break;
      }
      const parts: string[] = [];
      if (eps > 0) parts.push(t.diaryEpsGrouped(eps));
      if (mv > 0) parts.push(t.moviesGrouped(mv));
      if (hrs > 0)
        parts.push(hrs < 24 ? t.hours(hrs) : t.days(Math.floor(hrs / 24)));
      recap = { line: parts.join(" · "), posters };
    }
  }

  // ===== الأيام السبعة القادمة — لشريط التقويم إن كان ظاهراً =====
  const nowTs = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(nowTs.getTime() + i * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      weekday: new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
        weekday: "short",
        timeZone: "UTC",
      }).format(d),
      dayNum: new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" }).format(d),
    };
  });
  const weekEnd = weekDays[6].date;
  const weekEntries: WeekEntry[] = upcoming
    .filter((u) => u.date >= weekDays[0].date && u.date <= weekEnd && u.key.startsWith("tv-"))
    .map((u) => ({
      date: u.date,
      showTmdbId: Number(u.key.replace("tv-", "")),
      title: u.title,
      label: "",
    }));

  return (
    <>
      <ShowStatsSync stats={statsToCache} />
      <FollowMetaSync rows={metaToCache} />
      <MovieStatsSync rows={movieDatesToCache} />

      {empty && (
        <section className="text-center py-4">
          <p className="text-muted">{t.emptyStart}</p>
        </section>
      )}

      {(() => {
        /* سقفُ البطاقات (D-152) — يُطبَّق **عند الرسم لا عند الجلب**:
           أرقام الجلب أعلاه مضبوطةٌ على كلفة نداءات TMDB والفحوص
           (`bootstrapIds`, `CONTINUE_PROBE`)، وقصُّها هناك كان سيغيّر ما
           يُحسب لا ما يُعرض. و`capCards` تأخذ الأصغر فالافتراضي `full`
           لا يمسّ سطراً واحداً. */
        const cap = (n: number) => capCards(n, prefs.cards);

        /* أقسام المحتوى تُرسم بترتيب التفضيلات: قائمة أسماء من التخصيص
           تُترجم إلى قوالب هنا، والغائب عن القائمة لا يُرسم أصلاً */
        const sections: Record<HomeSection, React.ReactNode> = {
          continue:
            continueTop.length > 0 ? (
              <Section
                key="continue"
                title={t.continueWatching}
                icon="play"
                iconColor="var(--accent)"
                href="/library"
                seeAll={t.seeAll}
                wide
              >
                {continueTop.map((i, n) => (
                  <ContinueCard
                    key={`c-${i.id}`}
                    tmdbId={i.id}
                    href={`/show/${i.id}`}
                    title={i.name}
                    backdropPath={continueExtra[n]?.backdropPath ?? null}
                    posterPath={i.posterPath}
                    progress={i.progress}
                    watched={i.watched}
                    aired={i.aired}
                    episodeLabel={continueExtra[n]?.episodeLabel}
                    season={continueExtra[n]?.season ?? null}
                    episode={continueExtra[n]?.episode ?? null}
                    runtime={continueExtra[n]?.runtime ?? null}
                    locale={locale}
                  />
                ))}
              </Section>
            ) : null,
          week: (
            <div key="week">
              <span id="week" className="block scroll-mt-20" />
              <WeekStrip days={weekDays} entries={weekEntries} locale={locale} />
            </div>
          ),
          towatch:
            toWatchRow.length > 0 ? (
              <Section
                key="towatch"
                title={t.libToWatch}
                icon="bookmark"
                iconColor="var(--brand-3)"
                href="/library"
                seeAll={t.seeAll}
              >
                {toWatchRow.slice(0, cap(toWatchRow.length)).map((x) => (
                  <ToWatchCard
                    key={x.key}
                    tmdbId={x.tmdbId!}
                    mediaType={x.mediaType!}
                    runtime={x.runtime ?? null}
                    locale={locale}
                  >
                    <PosterCard
                      href={x.href}
                      title={x.title}
                      posterPath={x.posterPath}
                      progress={x.progress}
                      badge={x.badge}
                    />
                  </ToWatchCard>
                ))}
              </Section>
            ) : null,
          upcoming:
            upcomingRow.length > 0 ? (
              <Section
                key="upcoming"
                title={t.libUpcoming}
                icon="hourglass"
                iconColor="var(--accent)"
                href="/library"
                seeAll={t.seeAll}
              >
                {upcomingRow.slice(0, cap(upcomingRow.length)).map((x) => (
                  <PosterCard
                    key={x.key}
                    href={x.href}
                    title={x.title}
                    posterPath={x.posterPath}
                    badge={x.badge}
                  />
                ))}
              </Section>
            ) : null,
          shows:
            myShows.length > 0 ? (
              <Section
                key="shows"
                title={t.myShows}
                icon="tv"
                iconColor="var(--accent)"
                href="/library?filter=tv"
                seeAll={t.seeAll}
              >
                {myShows.slice(0, cap(myShows.length)).map((i) => (
                  <PosterCard
                    key={`ms-${i.id}`}
                    href={`/show/${i.id}`}
                    title={i.name}
                    posterPath={i.posterPath}
                    progress={i.progress}
                    count={i.watched > 0 && i.aired > i.watched ? i.aired - i.watched : undefined}
                    badge={
                      i.watched === 0
                        ? t.notStartedBadge
                        : i.aired > 0 && i.watched >= i.aired
                          ? t.watchedBadge
                          : undefined
                    }
                    badgeTone={
                      i.aired > 0 && i.watched >= i.aired && i.watched > 0 ? "watched" : "neutral"
                    }
                  />
                ))}
              </Section>
            ) : null,
          movies:
            myMovies.length > 0 ? (
              <Section
                key="movies"
                title={t.myMovies}
                icon="film"
                iconColor="var(--accent-2)"
                href="/library?filter=movie"
                seeAll={t.seeAll}
              >
                {myMovies.slice(0, cap(myMovies.length)).map((m) => (
                  <PosterCard
                    key={`mm-${m.tmdbId}`}
                    href={`/movie/${m.tmdbId}`}
                    title={m.title}
                    posterPath={m.posterPath}
                    progress={m.progress}
                    badge={m.badge}
                  />
                ))}
              </Section>
            ) : null,
          recap: recap ? (
            <div key="recap">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Icon name="book" size={20} style={{ color: "var(--accent)" }} />
                  {t.recapTitle}
                </h2>
                <Link
                  href="/diary"
                  className="text-xs text-accent hover:brightness-110 transition"
                >
                  {t.seeAll}
                </Link>
              </div>
              <Link
                href="/diary"
                prefetch={false}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-accent/50 active:scale-[0.99] transition"
              >
                <span className="text-[15px] font-bold leading-snug">
                  {recap.line}
                </span>
                <span className="flex shrink-0 -space-x-3 rtl:space-x-reverse">
                  {recap.posters.map((p, i) => {
                    const u = posterUrl(p, "w185");
                    return (
                      <span
                        key={i}
                        className="relative w-9 h-[54px] rounded-md overflow-hidden border-2 border-[color:var(--surface)] bg-surface-2"
                        style={{ zIndex: 3 - i }}
                      >
                        {u && (
                          /* `next/image` لا وسمَ خام: الخام يطلب TMDB
                             مباشرةً وكان لا يظهر عند المستخدم */
                          <Image
                            src={u}
                            alt=""
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        )}
                      </span>
                    );
                  })}
                </span>
              </Link>
            </div>
          ) : null,
          ratings:
            topRated.length > 0 ? (
              <Section
                key="ratings"
                title={t.ratingsListTitle}
                icon="star"
                iconColor="var(--verified)"
                href="/ratings"
                seeAll={t.seeAll}
              >
                {topRated.slice(0, cap(topRated.length)).map((r) => (
                  <PosterCard
                    key={`rt-${r.media_type}-${r.tmdb_id}`}
                    href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`}
                    title={r.title ?? "—"}
                    posterPath={r.poster_path}
                    badge={`★ ${r.rating}/10`}
                    badgeTone="rating"
                  />
                ))}
              </Section>
            ) : null,
          lists:
            myListCards.length > 0 ? (
              <div key="lists">
                <PublicListsRail lists={myListCards} locale={locale} title={t.myLists} />
              </div>
            ) : null,
          /* 🆕 **صفُّ «أعمالُ أصدقائك الآن» + شارةُ «جديد»** (البند ٧).
             **والشارةُ هنا لا في «الرائج»**: الرائجُ يتحرّك كلَّ يومٍ فشارتُه
             مضاءةٌ دائماً **فتُقرأ زينةً ثم لا تُقرأ** (D-134/D-219) —
             **وهذا الصفُّ يتحرّك حين يتحرّك أحدٌ تعرفه**، وهو الخبرُ نفسُه.
             **والبصمةُ من معرّفات البطاقات**: صفٌّ أُعيد جلبُه بنفس محتواه
             ليس «جديداً». */
          friends:
            friendsRows.length > 0 ? (
              <PosterRail
                key="friends"
                title={t.railFriendsNow}
                icon="people"
                href="/people"
                seeAllLabel={t.seeAll}
                action={
                  <RailNewBadge
                    id="friends"
                    sig={friendsRows.map((r) => `${r.media_type}${r.tmdb_id}`).join(",")}
                    locale={locale}
                  />
                }
              >
                {friendsRows.slice(0, cap(12)).map((r) => (
                  <RailItem key={`fw-${r.media_type}-${r.tmdb_id}`}>
                    <PosterCard
                      href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`}
                      title={r.title}
                      posterPath={r.poster_path}
                      /* الخيطُ الرباعيُّ تحت الملصق من مكتبتك أنت (D-322)
                         — **فترى ما عندك منها قبل أن تفتح** */
                      saved={followedKeys.has(`${r.media_type}-${r.tmdb_id}`)}
                      watched={
                        r.media_type === "movie"
                          ? watchedMovieIds.has(r.tmdb_id)
                          : doneShowIds.has(r.tmdb_id)
                      }
                    />
                  </RailItem>
                ))}
              </PosterRail>
            ) : null,
          trending:
            showTrending && trend.length > 0 ? (
              <Section key="trending" title={t.trendingWeek} icon="trending">
                {trend.slice(0, cap(12)).map((r) => {
                  const mt = r.media_type === "tv" ? "tv" : "movie";
                  const seen =
                    mt === "movie"
                      ? watchedMovieIds.has(r.id)
                      : doneShowIds.has(r.id);
                  return (
                    <QuickSaveCard
                      key={`${r.media_type}-${r.id}`}
                      tmdbId={r.id}
                      mediaType={mt}
                      title={titleOf(r)}
                      posterPath={r.poster_path}
                      state={
                        seen
                          ? "watched"
                          : followedKeys.has(`${mt}-${r.id}`)
                            ? "saved"
                            : "none"
                      }
                      locale={locale}
                    >
                      <PosterCard
                        href={`/${mt === "tv" ? "show" : "movie"}/${r.id}`}
                        title={titleOf(r)}
                        posterPath={r.poster_path}
                        year={yearOf(r)}
                        badge={mt === "tv" ? t.typeSeries : t.typeMovie}
                      />
                    </QuickSaveCard>
                  );
                })}
              </Section>
            ) : null,
        };
        return prefs.order.map((k) => sections[k]);
      })()}

      <span id="watching" className="block scroll-mt-20" />

      {favGenres.length === 0 && !empty && (
        <Link
          href="/profile/edit"
          className="block text-center text-sm text-muted hover:text-accent border border-dashed border-border rounded-xl py-4 transition"
        >
          {t.pickGenresHint}
        </Link>
      )}

    </>
  );
}

/**
 * كل الأقسام صفوف أفقية.
 *
 * كانت الأقسام الصغيرة تُرسم شبكةً ببطاقات أكبر — فيختلف حجم البطاقة بين
 * قسم وقسم في الشاشة نفسها، وقسمٌ بعنصر واحد يترك ثلثي الصفّ فارغاً.
 * الصفّ الأفقي يوحّد الإيقاع ويقصّر الصفحة.
 */
function Section({
  title,
  icon,
  iconColor,
  subtitle,
  href,
  seeAll,
  wide = false,
  children,
}: {
  title: string;
  icon?: IconName;
  iconColor?: string;
  subtitle?: string;
  href?: string;
  seeAll?: string;
  /** بطاقات عريضة بصورة المشهد بدل الملصق */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(
    Boolean,
  );
  if (!items.length) return null;
  return (
    <PosterRail
      title={title}
      icon={icon}
      iconColor={iconColor}
      subtitle={subtitle}
      href={href}
      seeAllLabel={seeAll}
    >
      {items.map((child, i) => (
        <RailItem key={i} size={wide ? "backdrop" : "poster"}>
          {child}
        </RailItem>
      ))}
    </PosterRail>
  );
}
