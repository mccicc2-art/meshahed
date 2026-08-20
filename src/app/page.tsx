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
  getSavedListsBrief,
  getMyPlaylistsBrief,
  getMyListedMovieIds,
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
  type SavedListBrief,
  type ListItem,
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
import { ListContinueCard } from "@/components/ListContinueCard";
/* اسمُ قائمةِ لوبز يُترجَم عند العرض لا يُخزَّن (D-328/D-373) */
import { curatedName } from "@/lib/universes";
import { QuickSaveCard } from "@/components/QuickSaveCard";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { RailNewBadge } from "@/components/RailNewBadge";
import { PublicListsRail } from "@/components/PublicListsRail";
import { Icon, type IconName } from "@/components/Icon";
import { posterUrl } from "@/lib/media";
import { getWatchHistory } from "@/lib/data";
import { HomeHeader, type HeaderStat } from "@/components/HomeHeader";
import { CompactMediaRow } from "@/components/CompactMediaRow";
import {
  sanitizeHomePrefs,
  type HomeSection,
  type HeaderStatKey,
  type HomeView,
} from "@/lib/homePrefs";
import { capCards } from "@/lib/cardCount";
import { densityVars } from "@/lib/density";
import { WeekStrip, type WeekEntry } from "@/components/WeekStrip";
import { ShowStatsSync, type ShowStat } from "@/components/ShowStatsSync";
import { FollowMetaSync, MovieStatsSync } from "@/components/MetaSync";
import { LandingHero } from "@/components/LandingHero";
import { LandingContent } from "@/components/LandingContent";
import { JsonLd } from "@/components/JsonLd";
import { siteGraph, faqGraph, seoKeywords } from "@/lib/seo";
import { OneTimeHint } from "@/components/OneTimeHint";

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
  const { locale, t } = await getT();

  /* ===== الموجة الأولى — والتحقّقُ معها لا قبلها (جولة ٢٠ أغسطس) =====
     كان `getUser()` يقف وحده أوّلاً (رحلة تحقّقٍ كاملة إلى خادم Auth)
     ثم تنطلق الاستعلامات الست — رحلتين متسلسلتين في أسخن مسار. القرّاء
     صاروا يأخذون المعرّف من الكوكي مباشرةً (`getUserId` — وRLS هو
     الحارس الحقيقي كما كان)، فالتحقّقُ الكامل ينضمّ إلى الموجة عضواً
     لا حارسَ بوابة: الكلُّ ينطلق معاً ويحكم أبطؤها وحده.
     ملخّص مجمّع: صف لكل مسلسل بدل صف لكل حلقة (آلاف الصفوف سابقاً).
     صفوف الحلقات التفصيلية تُقرأ لاحقاً لمسلسل واحد فقط — صاحب
     «الحلقة التالية». والزائر بلا كوكي لا يدفع استعلاماً واحداً:
     القرّاء يعودون فارغين قبل أي رحلة. */
  const [
    user,
    followRows,
    summary,
    watchedMovies,
    profile,
    movieProgress,
    myRatings,
  ] = await Promise.all([
    getUser(),
    getFollows(),
    getWatchSummary(),
    getWatchedMovies(),
    getProfile(),
    getAllMovieProgress(),
    getMyRatings(),
    /* ⚖️ وعدّادا البريد سقطا من هنا (D-502): الشريطُ العلويّ يعدّهما
       لنفسه — استعلامٌ لا يرسم شيئاً ضريبةٌ تُدفع في كلِّ فتحة. */
  ]);

  /* **بابٌ ثانٍ لتجديد الأخبار** (D-215): كان التجديدُ لا يقع إلا حين
     يُفتح تبويبُ الأخبار — **وهو أقلُّ أسطح التطبيق زيارةً**، فبقيت
     الأخبارُ ساكنةً ساعاتٍ (بلاغُ أحمد). والرئيسيةُ أكثرُها زيارةً،
     **والكلفةُ سؤالٌ منطقيٌّ واحد** على القاعدة، **والعملُ كلُّه بعد
     إرسال الصفحة** (`after`) فلا يبطئ رسمة.
     🆕 **وحتى سؤالُ «هل هي عتيقة؟» صار داخل `after`**: كان `await` يقف
     على رحلةِ قاعدةٍ كاملة قبل موجة الرئيسية الأولى — على أكثر مسارات
     التطبيق زيارةً — ونتيجتُه لا ترسم شيئاً، فلا شيءَ منه يستحقّ الحجب. */
  if (user) {
    after(async () => {
      try {
        if (await getNewsGenStale(10)) await refreshLoopzNews();
      } catch {
        /* تجديدُ الأخبار خدمةٌ خلفية — سقوطُه لا يمسّ الصفحة */
      }
    });
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

  /* ⚖️ 🆕 **أصفرٌ واحدٌ لكلِّ الرموز** (D-437، طلبُ أحمد: «طبّق نفس
     اللون الأصفر في كل الأيقونات»). **ونقضٌ مسجَّل**: كان لكلِّ خانةٍ
     لونُها «فتُعرف قبل أن تُقرأ» — **وثمنُه أن الشاشةَ الواحدة فيها
     خمسةُ ألوانِ تمييزٍ فلا يبقى للأصفر معنى «هنا الفعل».**
     **واللونُ الدلاليُّ باقٍ حيث يقول حالةً** (أخضرُ الاكتمال وأحمرُ
     الإيقاف في خيط الملصق) — **الذي سقط هو التلوينُ التزيينيّ.** */
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
      color: "var(--accent)",
    },
    towatch: {
      key: "towatch",
      icon: "bookmark",
      value: String(toWatchCount),
      label: t.libToWatch,
      href: "/library",
      color: "var(--accent)",
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
      color: "var(--accent)",
    },
    upcoming: {
      key: "upcoming",
      icon: "hourglass",
      value: String(upcomingCount),
      label: t.libUpcoming,
      href: "/library",
      color: "var(--accent)",
    },
    completed: {
      key: "completed",
      icon: "check",
      value: String(finishedShowsCount + finishedMoviesCount),
      label: t.libTabFinished,
      href: "/library",
      color: "var(--accent)",
    },
    dropped: {
      key: "dropped",
      icon: "card",
      value: String(droppedCount),
      label: t.droppedBadge,
      href: "/library",
      color: "var(--accent)",
    },
    // خانة «تقييماتي» في بطاقة الأرقام (طلب أحمد 9 Aug)
    ratings: {
      key: "ratings",
      icon: "star",
      value: String(myRatingsCount),
      label: t.panelRatings,
      href: "/ratings",
      color: "var(--accent)",
    },
  };
  const headerStats: HeaderStat[] = prefs.statsPick.map(
    (k) => allHeaderStats[k],
  );

  /* 🗑️ **وحسابُ المستوى سقط معه** (D-502): كان مدخلَ الهلال حول صورة
     الترحيب وحدَها — **وقد غادرت الصورةُ إلى الشريط العلويّ.** ورقمُه
     رخيصٌ (من عدّادَين مقروءَين أصلاً) **فيعود بسطرٍ متى عادت له
     واجهةٌ تعرضه.** */

  const displayName = profile?.nickname || user.email?.split("@")[0] || "";

  /* ===== D-087: الترويسة فوراً والجسدُ يتدفق =====
     كانت الصفحة تنتظر موجتي جلبٍ كاملتين قبل أول بايت (~1.2s باردةً).
     الآن الترويسة تخرج من الموجة الأولى وحدها، والجسد الثقيل — ترجمة
     المكتبة وتفاصيل TMDB وكل الصفوف — خلف Suspense يصل حين يجهز.
     الهيكل يحجز ارتفاع صفّين (D-046). نمطُ /news نفسه (D-071). */
  return (
    /* **الإيقاعُ ضاق درجتين** (D-437، طلبُ أحمد: «ودّي كل شي في صفحة
       وحدة، ما احتاج انزل، فقط أمرّر يمين»): **الفراغُ بين الأقسام هو
       أرخصُ ما يُشترى به سطرٌ رابع** — **ولا حجمَ نصٍّ نزل ولا قسمٌ
       سقط.** */
    /* 🆕 **الفراغُ بين الأقسام ١٢ لا ٢٠** (D-467) — **والرأسُ اللاصقُ
       يحمل حشوتَه فوق هذا**، فالمسافةُ المرئيّة تبقى مقروءةً ويكسب
       القارئُ قسماً إضافيّاً في الشاشة (حجّةُ D-437 نفسُها: **يُنفَق من
       الفراغ لا من حجم النصّ**). */
    <div className="space-y-3 sm:space-y-6" style={densityVars(prefs.density)}>
      {/* ⚖️ **وسقطت موجاتُ التسخين الأعمى** (جولة ٢٠ أغسطس — نقضُ
          D-483 بطلب أحمد: «لا prefetch لكل الصفحات بشكل أعمى»).
          البديل في الشريطين لا هنا: المكتبةُ — الوجهةُ المرجَّحة —
          `prefetch={true}` على رابطها فتُجلب كاملةً من الرؤية، وبقيّةُ
          الوجهات تُسخَّن لحظةَ النيّة (لمسة/حومان/تركيز عبر
          `usePrefetchOnIntent`) — فلا يدفع أحدٌ كلفةَ صفحةٍ لن يفتحها.
          و`RoutePrewarm` حُذف بحذف آخرِ مستدعيه. */}
      <HomeHeader
        displayName={displayName}
        stats={headerStats}
        showStats={prefs.stats}
        view={prefs.view}
        locale={locale}
      />
      {/* تلميح أول فتح — يظهر مرةً ثم يصمت (سابقة hintDiscover) */}
      <OneTimeHint id="home-customize" text={t.hintHome} closeLabel={t.closeLabel} />
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

/* المسلسل كما تحتاجه هذه الصفحة (اسمُه ومقياسُ تقدّمه من صفّ المتابعة
   المخزّن، لا من TMDB) — على مستوى الملفّ لأن قسم «تابِع المشاهدة» صار
   مكوّناً مستقلاً (جولة ٢٠ أغسطس) ويشاركه النوع */
type Item = {
  id: number;
  name: string;
  posterPath: string | null;
  watched: number;
  aired: number;
  progress: number;
};

/* نوعُ عناصر «للمشاهدة» و«القادم» — على مستوى الملفّ لأن قسم «القادم»
   صار مكوّناً مستقلاً (جولة ٢٠ أغسطس) ويشاركه النوع */
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
  /** سطرُ الوضع المختصر — النوعُ وعددُ الحلقات أو الموعد */
  subtitle?: string;
  /** «الحلقة ٥» — للقادم وحدَه، ويغيب إن لم يعرفه TMDB */
  ep?: string;
};

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
    topRated,
    myListsRaw,
    friendsRows,
    homeArt,
    savedLists,
    myPlaylists,
    listedMovieIds,
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
    /* ⚖️ **و«الرائج» غادر هذه الموجة** (جولة ٢٠ أغسطس): كان أبطأ عضوٍ
       فيها — نداءَ TMDB الوحيد الذي لا يخصّ مكتبتك فلا يكون في الكاش
       غالباً — **فيحكم وحدَه متى تظهر بطاقاتُ «تابِع المشاهدة» كلُّها.**
       صار قسماً مستقلاً (`TrendingSection`) يبثّ حين يجهز، وحارسُ
       D-321 معه حيث ذهب. */
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
    /* أغلفتي المختارة (D-131) — كانت `await` منفرداً بعد الموجة رغم أنها
       لا تعتمد على شيءٍ منها: رحلةُ قاعدةٍ كاملة تُدفع وحدَها على أسخن
       مسارٍ في التطبيق. الاستبدالُ نفسُه بعد الموجة كما كان. */
    getMyTitleArt(),
    /* 🆕 **قوائمُك المحفوظة بعناصرها** (D-496) — **في الموجة المتدفّقة
       لا الأولى**: أوّلُ بايتٍ للرئيسية لا ينتظر قائمة. */
    prefs.order.includes("continue")
      ? getSavedListsBrief().catch(() => [])
      : Promise.resolve([]),
    /* 🆕 **قوائمُ تشغيلك الصريحة** (D-505) — نفسُ شرط «تابِع المشاهدة» */
    prefs.order.includes("continue")
      ? getMyPlaylistsBrief().catch(() => [])
      : Promise.resolve([]),
    /* 🆕 **وأفلامُك الساكنةُ قائمةً — لاستثنائها من طابور «بلا قائمة»**
       (D-505): ما وضعتَه في قائمةٍ قد أعلنتَ سياقَه هناك. */
    prefs.order.includes("continue")
      ? getMyListedMovieIds().catch(() => new Set<number>())
      : Promise.resolve(new Set<number>()),
  ]);

  /* استبدالُ الأغلفة في مصدرٍ واحد بعد الترجمة: بطاقات «أكمل» و«ابدأ»
     و«للمشاهدة» كلّها تُبنى من `follows`، والرئيسية سطحي أنا فلا تسريب
     (ق٨). التقييمات كذلك — بطاقةُ عملٍ قيّمتُه في صفحتي. */
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

  // «الرائج» احتياطٌ لمن لا شيء في يده الآن — شرطُه معروفٌ هنا مسبقاً،
  // وجلبُه في قسمه المستقلّ وحده (TrendingSection) فلا يحبس غيرَه
  const showTrending = empty || continueWatching.length === 0;


  // لزرّ الحفظ السريع على «الرائج»: ما تتابعه، وما أنهيته فعلاً
  const followedKeys = new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`));
  const doneShowIds = new Set(
    items.filter((i) => i.aired > 0 && i.watched >= i.aired).map((i) => i.id),
  );

  /* ===== 🆕 القوائمُ التي تتابعها كما تتابع مسلسلاً (D-496) =====
     **والعلامةُ ليست عموداً جديداً بل ما تقوله بياناتُك أصلاً**:
     **قائمةٌ حفظتَها وأعمالُها في مكتبتك = قائمةٌ أضفتَها لتشاهدها.**
     **و«أضف الكل» تفعل الاثنين معاً** (D-495) فتدخل من أوّل ضغطة.

     **وثلاثةُ حدودٍ تمنعها من أن تصير رفّاً ثانياً:**
     **١ · القصيرةُ وحدَها** (≤٤٠): «أفضل ٢٥٠» ليست شيئاً يُتابَع
     فيلماً فيلماً — **وقائمةٌ بمئتَي عنصرٍ في «تابِع المشاهدة» تُقرأ
     كتالوجاً لا استئنافاً.**
     **٢ · وأكثرُها في مكتبتك** (≥٦٠٪): قائمةٌ تصادف أن عندك ثلاثةً
     منها ليست قائمةً «دخلتَها».
     **٣ · وفيها ما لم يُشاهَد**: المكتملةُ ليست «تابِع المشاهدة».

     ⚠️ **وسقفُ اثنتين**: الصفُّ صفُّ أعمالٍ أوّلاً، **والقوائمُ ضيفٌ
     فيه لا صاحبُ دار.** */
  /* 🆕 ===== D-505: قوائمُ التشغيل الصريحة، وطابورُ «بلا قائمة» =====

     **ثلاثُ عائلاتٍ لبطاقة القائمة في هذا الصفّ، من الأصرح إلى الأحدس:**
     **١ · طابورُ أفلامك التي بلا قائمة** (طلبُ أحمد بنصّه: «ليست اسمها
     تو واتش تدخل فيها كل الأفلام اللي بدون ليست وتنعرض كplay list») —
     يُحسب من مكتبتك ولا يسكن القاعدة: **فيلمٌ يدخل قائمةً يخرج منه
     وحدَه**، بترتيب الإضافة (الأقدمُ وعدُك الأقدم).
     **٢ · قوائمُك برايةِ التشغيل** (هجرة ١٢٢) — **الصريحُ لا يمرّ بحدسِ
     المحفوظ**: لا نسبةَ ٦٠٪ ولا سقفَ ٤٠، من رفع الرايةَ قال أريدها.
     **٣ · المحفوظُ من قوائم الآخرين بحدس D-496** — كما كان. */
  const seenIt = (it: { media_type: "tv" | "movie"; tmdb_id: number }) =>
    it.media_type === "movie"
      ? watchedMovieIds.has(it.tmdb_id)
      : doneShowIds.has(it.tmdb_id);

  const unlistedQueue = movieFollows
    .filter((f) => !listedMovieIds.has(f.tmdb_id))
    .sort((a, b) => a.added_at.localeCompare(b.added_at));
  const unlistedNext = unlistedQueue.find((f) => !watchedMovieIds.has(f.tmdb_id)) ?? null;
  const toWatchCard = unlistedNext
    ? {
        name: t.libToWatch,
        next: {
          tmdb_id: unlistedNext.tmdb_id,
          media_type: "movie" as const,
          title: unlistedNext.title,
          poster_path: unlistedNext.poster_path,
        },
        watched: unlistedQueue.filter((f) => watchedMovieIds.has(f.tmdb_id)).length,
        total: unlistedQueue.length,
      }
    : null;

  const playlistCards = myPlaylists
    .map((l) => ({
      list: l,
      watched: l.items.filter(seenIt).length,
      next: l.items.find((it) => !seenIt(it)) ?? null,
      total: l.items.length,
    }))
    /* المكتملةُ ليست «تابِع المشاهدة» — الرايةُ باقيةٌ والبطاقةُ تغيب */
    .filter((c) => c.next !== null)
    .slice(0, 3);
  const playlistIds = new Set(myPlaylists.map((l) => l.id));

  const listCards = savedLists
    /* قائمةٌ رُفعت عليها الرايةُ لا تدخل من باب الحدس ثانيةً (قاعدة ٦) */
    .filter((l) => !playlistIds.has(l.id))
    .filter((l) => l.items.length > 0 && l.items.length <= 40)
    .map((l) => {
      const seen = (it: (typeof l.items)[number]) =>
        it.media_type === "movie"
          ? watchedMovieIds.has(it.tmdb_id)
          : doneShowIds.has(it.tmdb_id);
      const mine = l.items.filter((it) =>
        followedKeys.has(`${it.media_type}-${it.tmdb_id}`),
      ).length;
      const watched = l.items.filter(seen).length;
      const next = l.items.find((it) => !seen(it)) ?? null;
      return { list: l, mine, watched, next, total: l.items.length };
    })
    .filter((c) => c.next !== null && c.mine / c.total >= 0.6)
    .slice(0, 2);

  /* ⚖️ **ومشهدُ «التالي» لبطاقات القوائم (D-507) غادر إلى قسمه**
     (جولة ٢٠ أغسطس): كان `await` منفرداً هنا بعد الموجة — رحلةَ TMDB
     إضافيةً تقف في وجه كلِّ الأقسام، ونتيجتُها لا يقرؤها إلا صفُّ
     «تابِع المشاهدة». صار داخل `ContinueSection` خلف Suspense خاصّته:
     البطاقاتُ تبثّ حين تجهز صورُها، والرفوفُ لا تنتظرها. */

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
        /* ⚖️ 🆕 **وشارةُ «ما بدأته» سقطت من هذا الصفّ** (D-434، طلبُ
           أحمد بنصّه: «لا تعرض Not started داخل قسم معروف مسبقاً بأنه To
           Watch»). **وهو محقّ: القسمُ كلُّه ما لم يُبدأ**، **وشارةٌ تعيد
           عنوانَ قسمها على كلِّ بطاقةٍ فيه ضجيجٌ لا خبر** — والشارةُ
           باقيةٌ حيث تُفرِّق فعلاً (صفُّ «مسلسلاتي» والمكتبة). */
        subtitle:
          i.aired > 0 ? `${t.typeSeries} · ${t.epsCount(i.aired)}` : t.typeSeries,
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
        /* **والشارةُ تبقى حين تحمل خبراً**: «٤٥ د» موضعُك في الفيلم —
           **وأمّا «فيلم» فنوعُه، ومكانُه السطرُ الثاني في المختصر لا
           رقاقةٌ فوق الملصق.** */
        badge: m.progress === 0 ? undefined : m.badge,
        subtitle: t.typeMovie,
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
      subtitle: t.typeSeries,
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
        subtitle: t.typeMovie,
        date: d!,
      })),
  ]
    .sort((a, b) => (a as { date: string }).date.localeCompare((b as { date: string }).date))
    .slice(0, 16);

  /* ===== رقمُ الحلقة القادمة (D-437، طلبُ أحمد: «وأظهر رقم الحلقة في
     القادم») =====

     **ولا هجرةَ ولا عمود**: صفُّ المتابعة يحمل `next_air_date` وحدَه،
     **والرقمُ في `next_episode_to_air` من TMDB** — **وهو نداءٌ مخبّأٌ
     ساعةً** (`revalidate: 3600`) **لأعمالٍ يتابعها صاحبُ الحساب أصلاً
     فأكثرُها مجلوبٌ في الطلب نفسِه.**

     ⚠️ **والسقفُ عشرة**: القادمُ قد يكون ستّةَ عشر، **ونداءٌ لكلِّ صفٍّ
     بلا سقفٍ هو بالضبط ما أسقط شارةَ تقييم الحلقة** (D-384).
     **والغائبُ يغيب صامتاً** — **ولا يُخمَّن رقم** (D-432). */
  /* ⚖️ **وجلبُ الرقم غادر إلى قسم «القادم» نفسِه** (جولة ٢٠ أغسطس):
     كان `await` هنا يجعل عشرَ رحلات TMDB — زينةَ رقمٍ في صفٍّ واحد —
     تقف في وجه الرفوف كلِّها. `UpcomingSection` أدناه يجلبه خلف
     Suspense خاصّته، وقواعدُ D-437/D-432 معه بحرفها: السقفُ عشرة،
     والغائبُ يغيب صامتاً ولا يُخمَّن رقم. */

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

  /* ===== الأيامُ الأربعةَ عشرَ القادمة — لشريط التقويم إن كان ظاهراً
     🆕 **أسبوعان لا أسبوع** (D-491، طلبُ أحمد: «أحتاج أقدر أكرّره بيدي
     وأشوف الأسبوع اللي بعده»): **الشريطُ صار يُمرَّر**، فسبعةُ أيامٍ
     تُظهر أسبوعاً وتترك الإصبعَ بلا ما يسحبه. **وأربعةَ عشرَ يومٍ سقفٌ
     لا اعتباطاً**: `upcoming` مبنيٌّ أصلاً، **فلا نداءَ جديدٌ ولا صفٌّ
     إضافيٌّ يُجلب** — الفلترةُ وحدَها اتّسعت. ===== */
  const nowTs = new Date();
  const weekDays = Array.from({ length: 14 }, (_, i) => {
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
  const weekEnd = weekDays[weekDays.length - 1].date;
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

        /* **وضعُ العرض يُقرأ مرّةً هنا** (D-434) — **والبياناتُ أعلاه
           واحدةٌ للوضعين**: لا نداءَ ثانٍ ولا فرعَ جلبٍ ثانٍ، **والفرقُ
           في آخر خطوةٍ وحدَها.** */
        const view = prefs.view;

        /* أقسام المحتوى تُرسم بترتيب التفضيلات: قائمة أسماء من التخصيص
           تُترجم إلى قوالب هنا، والغائب عن القائمة لا يُرسم أصلاً */
        const sections: Record<HomeSection, React.ReactNode> = {
          continue:
            continueTop.length > 0 ||
            listCards.length > 0 ||
            playlistCards.length > 0 ||
            toWatchCard ? (
              /* ⚖️ **القسمُ صار يبثّ وحده** (جولة ٢٠ أغسطس): جلبُ مشاهد
                 D-507 كان `await` في جسد الصفحة يقف في وجه الرفوف كلِّها.
                 الشرطُ يبقى هنا (معروفٌ من الموجة) فلا هيكلَ لقسمٍ لن
                 يُرسم — والهيكلُ يظهر لقسمٍ سيأتي يقيناً. */
              <Suspense key="continue" fallback={<RailSkeleton count={4} />}>
                <ContinueSection
                  toWatchCard={toWatchCard}
                  playlistCards={playlistCards}
                  listCards={listCards}
                  continueTop={continueTop}
                  continueExtra={continueExtra}
                  view={view}
                  locale={locale}
                  t={t}
                />
              </Suspense>
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
                iconColor="var(--accent)"
                href="/library"
                seeAll={t.seeAll}
                view={view}
              >
                {toWatchRow.slice(0, cap(toWatchRow.length)).map((x) =>
                  view === "compact" ? (
                    <CompactMediaRow
                      key={x.key}
                      href={x.href}
                      title={x.title}
                      subtitle={x.subtitle}
                      posterPath={x.posterPath}
                      progress={x.progress}
                    />
                  ) : (
                    /* ⚖️ 🆕 **والزرّان العائمان سقطا** (D-434، طلبُ أحمد:
                       «لا تعرض أزراراً عائمة كثيرة فوق البوسترات»).
                       **والفعلان لم يسقطا**: «شاهدته» في قائمة الضغط
                       المطوّل نفسِها (D-376)، **وهي البابُ الموحَّد لأفعال
                       الملصق في كلّ سطح** — **وبابان لفعلٍ واحد كانا
                       يزاحمان الصورةَ ويختلفان في السلوك.**
                       ⚠️ **و«البطاقة الحمراء» ليست في هذه القائمة بعد**
                       — بابُها اليومَ صفحةُ العمل وشبكةُ المكتبة، **وهو
                       دَينٌ مكتوبٌ في `docs/UI_STATUS.md` لا سهوٌ.** */
                    <PosterCard
                      key={x.key}
                      href={x.href}
                      title={x.title}
                      posterPath={x.posterPath}
                      progress={x.progress}
                      badge={x.badge}
                      /* ⚖️ 🆕 **والاسمُ عاد فوق الملصق هنا** (D-437،
                         حكمُ أحمد: «إذا احتجت مساحة في To Watch حط اسم
                         الفلم على البوستر»). **وهو ثمنٌ اختاره بنفسه
                         ليجمع الصفحةَ في شاشة**، **والاسمُ يبقى مرّةً
                         واحدة** فلا يُنقض شرطُه الأوّل. **و`titleBelow`
                         باقٍ في العقد** لأن المكتبةَ والاستكشاف ينتظرانه
                         (D-435). */
                      /* 🆕 **ولا خيطَ «عندك» في صفٍّ كلُّه عندك**
                         (D-437، بلاغُه: «اللون السماوي على الفيلم ما هو
                         فيت»): **الخيطُ يقول ما يقوله عنوانُ القسم** —
                         **وهو نفسُ حكم شارة «ما بدأته»** (D-434).
                         **والتقدّمُ والاكتمالُ والإيقاف تبقى** لأنها
                         تفرّق بين بطاقةٍ وأخرى في الصفّ نفسِه. */
                      savedMark={false}
                      hold={{
                        tmdbId: x.tmdbId!,
                        mediaType: x.mediaType!,
                        added: true,
                        watched: false,
                        progress: x.progress,
                        locale,
                      }}
                    />
                  ),
                )}
              </Section>
            ) : null,
          upcoming:
            upcomingRow.length > 0 ? (
              /* ⚖️ **قسمٌ يبثّ وحده** (جولة ٢٠ أغسطس): رقمُ الحلقة
                 (D-437) عشرُ رحلات TMDB كانت تقف في وجه الصفحة كلِّها —
                 صارت خلف Suspense خاصّته، والصفُّ معروفُ الوجود مسبقاً
                 فلا هيكلَ يظهر ثم ينهار. */
              <Suspense key="upcoming" fallback={<RailSkeleton count={4} />}>
                <UpcomingSection
                  row={upcomingRow}
                  cards={prefs.cards}
                  view={view}
                  t={t}
                />
              </Suspense>
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
                iconColor="var(--accent)"
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
                <h2 className="flex items-center gap-2 text-22 font-bold">
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
                <span className="text-15 font-bold leading-snug">
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
                iconColor="var(--accent)"
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
                <PublicListsRail
                  lists={myListCards}
                  locale={locale}
                  title={t.myLists}
                />
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
            showTrending ? (
              /* ⚖️ **«الرائج» يبثّ وحده** (جولة ٢٠ أغسطس): نداءُ TMDB
                 الوحيد الذي لا يخصّ مكتبتك — كان أبطأَ عضوٍ في الموجة
                 فيحكم في ظهور كلِّ الأقسام. شرطُ الظهور (`showTrending`)
                 معروفٌ مسبقاً؛ وسقوطُ الجلب كلِّه يُسقط القسمَ صامتاً
                 كما كان (`catch` إلى صفوفٍ صفر). */
              <Suspense key="trending" fallback={<RailSkeleton count={6} />}>
                <TrendingSection
                  watchedMovieIds={watchedMovieIds}
                  doneShowIds={doneShowIds}
                  followedKeys={followedKeys}
                  cards={prefs.cards}
                  locale={locale}
                  t={t}
                />
              </Suspense>
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
  view = "visual",
  soloFull = false,
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
  /**
   * 🆕 **وضعُ العرض** (D-434): **الرأسُ واحدٌ في الوضعين** — نفسُ
   * العنوان ونفسُ الرمز ونفسُ «الكلّ» — **والذي يتبدّل هو جسدُه**:
   * صفٌّ أفقيٌّ يُمرَّر، أو عمودٌ من صفوفٍ مضغوطة. **ورأسان مكتوبان
   * مرّتين كانا سيفترقان** (قاعدة ٦).
   */
  view?: HomeView;
  /* ⚖️ 🆕 وسقط «صندوقُ الثلاثة صفوف» (peek/D-439) — نقضٌ بطلب أحمد ١٩
     أغسطس ليلاً بنصّه: «لا تستخدم max-height لتقييد القوائم، لا يوجد
     تمرير رأسي داخلي، الصفحة نفسها هي منطقة التمرير الرأسية الوحيدة» —
     **فمنطقتا تمريرٍ رأسيّتان تجعلان الإصبعَ لا يعرف ماذا يحرّك**،
     وهي نفسُها التي لخبطت السحبَ للتحديث يومَها (D-440). والقوائمُ
     تبقى مقصوصةً بسقف التفضيلات (`capCards`) لا بصندوق. */
  /**
   * ⚖️ 🆕 **هل تأخذ البطاقةُ الوحيدة العرضَ كلَّه؟** (D-444).
   *
   * **كان الحكمُ عامّاً لكلِّ صفٍّ عريض** (D-440)، **فأخذت بطاقةُ «تابِع
   * المشاهدة» الشاشةَ كلَّها فقال أحمد «كذا كبير مرّة».**
   *
   * **والفرقُ الذي غاب عنّي أنّ الصفَّين ليسا شيئاً واحداً**: صفُّ
   * «القادم» **صفٌّ** (`CompactMediaRow`) — **وملءُ العرض شكلُه الطبيعيّ
   * سواءٌ كان واحداً أو عشرة** — **وبطاقةُ «تابِع المشاهدة» بطاقةٌ لها
   * مقاسٌ من نفسها**، **ومدُّها إلى عرض الشاشة يكبّر صورةً لا يملأ
   * فراغاً.**
   *
   * **🔑 والقاعدة**: **الصفُّ يتمدّد والبطاقةُ لا** — **ومن أعطى
   * الاثنين حكماً واحداً لأن كليهما «عريض» خلط الشكلَ بالمقاس.**
   */
  soloFull?: boolean;
  children: React.ReactNode;
}) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(
    Boolean,
  );
  if (!items.length) return null;
  /* 🆕 **البطاقةُ الوحيدة تخرج من مجال التمرير أيضاً** (D-442): مجالُ
     التمرير صفٌّ `flex`، **وابنٌ فيه بلا عرضٍ مكتوب يأخذ عرضَ محتواه** —
     **وبطاقةُ «تابِع المشاهدة» كلُّ محتواها صورةٌ مطلقةُ الموضع
     (`fill`)، فمحتواها صفرٌ فعرضُها صفر.** **فاختفت البطاقةُ وبقي
     عنوانُها.**
     **ولهذا `bare` معها**: بلا مجالِ تمريرٍ أصلاً — **صفٌّ ببطاقةٍ واحدة
     لا يُسحب** — **و`w-full` تكتب العرضَ صراحةً بدل أن تُستنتج.** */
  const solo = view === "visual" && soloFull && items.length === 1;

  return (
    <PosterRail
      title={title}
      icon={icon}
      iconColor={iconColor}
      subtitle={subtitle}
      href={href}
      seeAllLabel={seeAll}
      /* المختصر بلا مجالِ تمرير: **قائمةٌ تُقرأ لا صفٌّ يُسحب** */
      bare={view === "compact" || solo}
    >
      {/* 🆕 **وصفٌّ ببطاقةٍ واحدة ليس صفّاً** (D-440، طلبُ أحمد بدائرةٍ
          حمراء حول بطاقة «أكمل المشاهدة»: «كبّر بوستر أكمل المشاهدة»).
          **والعطلُ في العدد لا في المقاس**: ١٧٦px تُظهر بطاقتين وثُلثاً
          حين تكون البطاقاتُ كثيرة — **وهو ما طُلب** (D-437) — **لكنها
          حين تكون واحدةً تترك ستّين بالمئة من الصفّ فراغاً**، فتُقرأ
          البطاقةُ ضائعةً لا مضغوطة.
          **فالواحدةُ تأخذ العرضَ كلَّه**، **والاثنتان فصاعداً تبقيان
          صفّاً يُمرَّر** — **ولا رقمَ ثالثٌ يُخترع.** */}
      {solo ? (
        <div className="w-full">{items[0]}</div>
      ) : view === "compact" ? (
        /* ⚖️ عمودٌ يجري مع الصفحة — لا `max-height` ولا تمريرَ داخليّاً
           (نقضُ D-439 بطلب أحمد ١٩ أغسطس: «الصفحة نفسها هي منطقة
           التمرير الرأسية الوحيدة») */
        <div className="space-y-2">
          {items.map((child, i) => (
            <div key={i}>{child}</div>
          ))}
        </div>
      ) : (
        items.map((child, i) => (
          <RailItem key={i} size={wide ? "backdrop" : "poster"}>
            {child}
          </RailItem>
        ))
      )}
    </PosterRail>
  );
}

/* ================= أقسامٌ تبثّ وحدها (جولة أداء ٢٠ أغسطس) =================

   كانت الموجة الثانية `Promise.all` واحدةً ضخمة: أبطأُ عضوٍ فيها —
   وغالباً نداءُ TMDB الذي ليس في الكاش — يحكم متى تظهر الأقسامُ كلُّها.
   القاعدة الجديدة: **ما يخصّ قسماً واحداً يُجلب في قسمه خلف Suspense
   خاصّته** — فالرفوف المبنية من صفوف مكتبتك تظهر بسرعة قاعدة البيانات،
   وTMDB يجمّل ما يخصّه حين يصل. وشرطُ ظهور كلِّ قسمٍ يبقى محسوباً في
   الصفحة قبل البثّ، فلا هيكلَ يظهر ثم ينهار إلى لا شيء. */

/** ما يعرفه صفُّ «تابِع المشاهدة» عن بطاقة مسلسلٍ فوق صفّ المتابعة */
type ContinueExtra = {
  id: number;
  backdropPath: string | null;
  episodeLabel: string | null;
  season: number | null;
  episode: number | null;
  runtime: number | null;
};

/** بطاقةُ قائمةٍ في «تابِع المشاهدة» — محفوظةٌ أو قائمةُ تشغيلٍ صريحة */
type BriefListCard = {
  list: SavedListBrief;
  watched: number;
  next: ListItem | null;
  total: number;
};

/** بطاقةُ طابور «بلا قائمة» (D-505) */
type ToWatchQueueCard = {
  name: string;
  next: {
    tmdb_id: number;
    media_type: "movie";
    title: string;
    poster_path: string | null;
  };
  watched: number;
  total: number;
};

/**
 * قسم «تابِع المشاهدة» — يجلب مشاهد «التالي» لبطاقات القوائم بنفسه.
 *
 * 🆕 **مشهدُ «التالي» لبطاقات القوائم** (D-507، حكمُ أحمد: «اعملها
 * غلاف وحجمه يكون مثل المسلسل»): البطاقةُ بهندسة بطاقة الحلقة، وصورتُها
 * مشهدٌ لا ملصق — والمشهدُ لا يسكن صفوفَ القوائم فيُجلب هنا لعنصرٍ
 * واحدٍ من كلِّ بطاقة (سقفُ البطاقات ستٌّ، والنداءاتُ متوازيةٌ ومعظمُها
 * في كاش TMDB أصلاً). والفشلُ يسقط إلى الملصق بلا شاشة خطأ.
 */
async function ContinueSection({
  toWatchCard,
  playlistCards,
  listCards,
  continueTop,
  continueExtra,
  view,
  locale,
  t,
}: {
  toWatchCard: ToWatchQueueCard | null;
  playlistCards: BriefListCard[];
  listCards: BriefListCard[];
  continueTop: Item[];
  continueExtra: ContinueExtra[];
  view: HomeView;
  locale: Locale;
  t: T;
}) {
  const cardNexts = [
    ...(toWatchCard ? [toWatchCard.next] : []),
    ...playlistCards.map((c) => c.next!),
    ...listCards.map((c) => c.next!),
  ];
  const nextBackdrops = new Map(
    await Promise.all(
      cardNexts.map(async (n) => {
        const key = `${n.media_type}-${n.tmdb_id}`;
        try {
          const d =
            n.media_type === "movie" ? await getMovie(n.tmdb_id) : await getTv(n.tmdb_id);
          return [key, d?.backdrop_path ?? null] as const;
        } catch {
          return [key, null] as const;
        }
      }),
    ),
  );
  const backdropOf = (n: { media_type: "tv" | "movie"; tmdb_id: number }) =>
    nextBackdrops.get(`${n.media_type}-${n.tmdb_id}`) ?? null;

  return (
    <Section
      key="continue"
      title={t.continueWatching}
      icon="play"
      iconColor="var(--accent)"
      href="/library"
      seeAll={t.seeAll}
      view={view}
      wide
    >
      {/* 🆕 **والقوائمُ أوّلَ الصفّ** (D-496): **الأقربُ إلى الاستئناف
          أوّلاً هو ترتيبُ هذا الصفّ منذ نشأته**، **وقائمةٌ دخلتَها
          للتوّ هي أحدثُ نيّةٍ أعلنتَها.** */}
      {/* 🆕 **طابورُ «بلا قائمة» أوّلَ الأبواب** (D-505): هو جوابُ
          «الأفلام ما تروح كنتنيو واتش» نفسُه — صحٌّ على الفيلم يقلب
          البطاقةَ إلى الذي بعده. */}
      {toWatchCard && (
        <ListContinueCard
          key="lc-towatch"
          listName={toWatchCard.name}
          next={{
            tmdbId: toWatchCard.next.tmdb_id,
            mediaType: toWatchCard.next.media_type,
            title: toWatchCard.next.title,
            posterPath: toWatchCard.next.poster_path,
            backdropPath: backdropOf(toWatchCard.next),
          }}
          watched={toWatchCard.watched}
          total={toWatchCard.total}
          locale={locale}
        />
      )}
      {/* 🆕 **ثم قوائمُ تشغيلك الصريحة** (D-505) — الرايةُ التي رفعتَها
          بنفسك تسبق حدسَ المحفوظ */}
      {playlistCards.map((c) => (
        <ListContinueCard
          key={`pl-${c.list.id}`}
          listName={curatedName(c.list.sourceSlug, c.list.name, locale)}
          next={{
            tmdbId: c.next!.tmdb_id,
            mediaType: c.next!.media_type,
            title: c.next!.title,
            posterPath: c.next!.poster_path,
            backdropPath: backdropOf(c.next!),
          }}
          watched={c.watched}
          total={c.total}
          locale={locale}
        />
      ))}
      {listCards.map((c) => (
        <ListContinueCard
          key={`lc-${c.list.id}`}
          listName={curatedName(c.list.sourceSlug, c.list.name, locale)}
          next={{
            tmdbId: c.next!.tmdb_id,
            mediaType: c.next!.media_type,
            title: c.next!.title,
            posterPath: c.next!.poster_path,
            backdropPath: backdropOf(c.next!),
          }}
          watched={c.watched}
          total={c.total}
          locale={locale}
        />
      ))}
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
          variant={view === "compact" ? "row" : "card"}
          locale={locale}
        />
      ))}
    </Section>
  );
}

/**
 * قسم «القادم» — يجلب رقم الحلقة القادمة بنفسه.
 *
 * ===== رقمُ الحلقة القادمة (D-437، طلبُ أحمد: «وأظهر رقم الحلقة في
 * القادم») =====
 * **ولا هجرةَ ولا عمود**: صفُّ المتابعة يحمل `next_air_date` وحدَه،
 * **والرقمُ في `next_episode_to_air` من TMDB** — **وهو نداءٌ مخبّأٌ
 * ساعةً** (`revalidate: 3600`) **لأعمالٍ يتابعها صاحبُ الحساب أصلاً
 * فأكثرُها مجلوبٌ في الطلب نفسِه.**
 * ⚠️ **والسقفُ عشرة**: القادمُ قد يكون ستّةَ عشر، **ونداءٌ لكلِّ صفٍّ
 * بلا سقفٍ هو بالضبط ما أسقط شارةَ تقييم الحلقة** (D-384).
 * **والغائبُ يغيب صامتاً** — **ولا يُخمَّن رقم** (D-432).
 */
async function UpcomingSection({
  row,
  cards,
  view,
  t,
}: {
  row: MixedItem[];
  cards: ReturnType<typeof sanitizeHomePrefs>["cards"];
  view: HomeView;
  t: T;
}) {
  const upcomingTvIds = row
    .filter((x) => x.key.startsWith("up-tv-"))
    .map((x) => Number(x.key.slice("up-tv-".length)))
    .filter((n) => Number.isFinite(n))
    .slice(0, 10);
  const epById = new Map<number, number>();
  if (upcomingTvIds.length > 0) {
    const eps = await Promise.all(
      upcomingTvIds.map((id) =>
        getTv(id)
          .then((tv) => tv.next_episode_to_air?.episode_number ?? null)
          .catch(() => null),
      ),
    );
    upcomingTvIds.forEach((id, n) => {
      const e = eps[n];
      if (e != null) epById.set(id, e);
    });
  }
  /* نسخٌ لا تعديلُ خاصيّة: `row` معاملُ مكوّنٍ والمعاملات لا تُمسّ —
     الرقمُ يُركَّب على نسخةٍ محليّة */
  const rows: MixedItem[] = row.map((x) => {
    if (!x.key.startsWith("up-tv-")) return x;
    const e = epById.get(Number(x.key.slice("up-tv-".length)));
    return e != null ? { ...x, ep: t.episodeNo(e) } : x;
  });

  const cap = (n: number) => capCards(n, cards);
  return (
    <Section
      key="upcoming"
      title={t.libUpcoming}
      icon="hourglass"
      iconColor="var(--accent)"
      href="/library"
      seeAll={t.seeAll}
      view={view}
      soloFull
      wide
    >
      {/* **القادمُ موعدٌ قبل أن يكون عملاً** (D-434): الصدرُ في السطر
          الأوّل هو التاريخ، واسمُ العمل تحته — **فالقارئ يسأل «متى» ثم
          «ماذا»، لا العكس.** وفي المختصر يصير التاريخُ رقاقةً في صدر
          الصفّ بدل الملصق. */}
      {rows.slice(0, cap(rows.length)).map((x) =>
        view === "compact" ? (
          <CompactMediaRow
            key={x.key}
            href={x.href}
            chip={x.badge}
            title={x.title}
            subtitle={x.ep ?? x.subtitle}
          />
        ) : (
          <CompactMediaRow
            key={x.key}
            href={x.href}
            title={[x.badge, x.ep].filter(Boolean).join(" · ")}
            subtitle={x.title}
            posterPath={x.posterPath}
          />
        ),
      )}
    </Section>
  );
}

/**
 * قسم «الرائج» — احتياطُ من لا شيء في يده الآن، يجلب صفّه بنفسه.
 *
 * 🆕 **والحارسُ على فم «الرائج» هنا أيضاً** (D-321): هذا الصفُّ كان
 * ينادي `/trending` عارياً منذ أوّل يوم — حارسُ D-194 وُلد في
 * `news/page.tsx` وحدَه. و`anime: "keep"` مقصودة — الرئيسيةُ ليست
 * تبويبَ أفلامٍ ولا مسلسلات، ولم يطلب أحدٌ إخراجَ الأنمي منها.
 * **والمساران صارا مساراً واحداً** بعد أن غادر «الرائج» الموجةَ إلى
 * هذا القسم — نسخةٌ واحدةٌ محروسةٌ لا اثنتان (درسُ D-175).
 */
async function TrendingSection({
  watchedMovieIds,
  doneShowIds,
  followedKeys,
  cards,
  locale,
  t,
}: {
  watchedMovieIds: Set<number>;
  doneShowIds: Set<number>;
  followedKeys: Set<string>;
  cards: ReturnType<typeof sanitizeHomePrefs>["cards"];
  locale: Locale;
  t: T;
}) {
  const trend: SearchResult[] = await trending()
    .then((rows) => railGuard(rows, { anime: "keep" }))
    .catch(() => [] as SearchResult[]);
  if (trend.length === 0) return null;

  const cap = (n: number) => capCards(n, cards);
  return (
    <Section key="trending" title={t.trendingWeek} icon="trending">
      {trend.slice(0, cap(12)).map((r) => {
        const mt = r.media_type === "tv" ? "tv" : "movie";
        const seen =
          mt === "movie" ? watchedMovieIds.has(r.id) : doneShowIds.has(r.id);
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
  );
}
