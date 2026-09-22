import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getDict, type Locale } from "@/core/i18n";
import { isPlus } from "@/core/plan";
import { WidgetSync } from "@/components/WidgetSync";
import { RailSkeleton } from "@/components/Skeletons";
import {
  getUser,
  getFollows,
  getWatchSummary,
  getWatchedMovies,
  getProfile,
  getAllMovieProgress,
  getMyRatings,
  getUnreadSignals,
  getUnreadShares,
  getFollowStats,
} from "@/lib/data";
import {
  titleOf,
  yearOf,
} from "@/lib/tmdb";
/* حارسُ الرفوف — نفسُ الملفّ الذي يحرس اكتشف، **لا نسخةٌ ثانية** (D-321) */
import {
  getNewsGenStale,
  refreshLoopzNews,
} from "@/lib/data";
import { getT, getLocale } from "@/lib/locale";
import { PosterCard } from "@/components/PosterCard";
import { ContinueCard } from "@/components/ContinueCard";
import { ListContinueCard } from "@/components/ListContinueCard";
import { ToWatchListCard } from "@/components/ToWatchListCard";
/* اسمُ قائمةِ لوبز يُترجَم عند العرض لا يُخزَّن (D-328/D-373) */
import { curatedName } from "@/core/universes";
import { PosterRail, RailItem, seeAllClass } from "@/components/PosterRail";
import { PosterGrid } from "@/components/PosterGrid";
import { ProfileStatSheet } from "@/components/ProfileStatSheet";
import { RailNewBadge } from "@/components/RailNewBadge";
import { PublicListsRail } from "@/components/PublicListsRail";
import { Icon, type IconName } from "@/components/Icon";
import { posterUrl } from "@/core/media";
import { HomeHeader } from "@/components/HomeHeader";
/* **الشكلان يُرسمان معاً والعميلُ يختار** — لا رحلةَ خادمٍ لتبديل شكل */
import { ByHomeView, HomeViewProvider } from "@/components/HomeViewProvider";
import { CompactMediaRow } from "@/components/CompactMediaRow";
import {
  sanitizeHomePrefs,
  applyQueueOrder,
  type HomeSection,
  type HomeView,
} from "@/core/homePrefs";
import { capCards } from "@/core/cardCount";
import { densityVars } from "@/core/density";
import { WeekStrip } from "@/components/WeekStrip";
import {
  HomeOrderButton,
  HomeOrderSheetHost,
} from "@/components/HomeSectionsOrder";
import {
  QueueOrderButton,
  HomeQueueSheetHost,
} from "@/components/HomeQueueOrder";
import { ShowStatsSync } from "@/components/ShowStatsSync";
import { FollowMetaSync, MovieStatsSync } from "@/components/MetaSync";
import { LandingHero } from "@/components/LandingHero";
import { LandingShowcase } from "@/components/LandingShowcase";
import { LandingContent } from "@/components/LandingContent";
import { JsonLd } from "@/components/JsonLd";
import { siteGraph, faqGraph, seoKeywords } from "@/lib/seo";
import { OneTimeHint } from "@/components/OneTimeHint";
/* 🆕 D-1066: نواةُ الرئيسية — الحسابُ هناك، الرسمُ هنا */
import {
  buildHomeHeader,
  buildHomeBody,
  continueBackdrops,
  upcomingWithEpisodes,
  trendingRail,
  type T,
  type Item,
  type MixedItem,
  type ContinueExtra,
  type BriefListCard,
  type ToWatchQueueCard,
} from "@/lib/homeCore";

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
  /* ⚖️ 🆕 **وموضعُ الأفلام غادر الموجةَ الحاجبة — لا نداءَه** (جولة ٢٢
     أغسطس): **`movie_progress` كان العضوَ الوحيدَ في هذه الموجة الذي
     لا تقرأه القشرةُ أصلاً** — لا عدّادَ رأسٍ ولا اسمَ ولا بوّابةَ
     تحويل، **وقارئُه الوحيدُ `HomeBody` خلف Suspense**. فالنداءُ
     يُطلَق هنا في اللحظة نفسِها — **فلا رحلةَ تتأخّر ولا تُكرَّر** —
     ثمّ يُمرَّر وعداً يُنتظر حيث يُقرأ.
     🔑 **وهو آمنٌ بلا `catch` هنا لأن الدالّة لا ترفض أصلاً**:
     `getAllMovieProgress` تلفّ جسمَها بـ`try/catch` وتعيد `[]` —
     فوعدٌ غيرُ مُنتظَرٍ لحظةَ `redirect` أو صفحةِ الزائر لا يُخلّف
     رفضاً معلّقاً. **ولو صارت ترمي يوماً، هذا السطرُ هو ما ينكسر.** */
  const movieProgressPromise = getAllMovieProgress();

  const [user, followRows, summary, watchedMovies, profile, myRatings] =
    await Promise.all([
      getUser(),
      getFollows(),
      getWatchSummary(),
      getWatchedMovies(),
      getProfile(),
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
        {/* 🆕 **والوردمارك يُرسم هنا كما يُرسم في `/login`** (D-843):
            **كان مطفأً «لأن التذييل العام يظهر في آخر الصفحة» — ولا
            تذييلَ عامَّ في الشجرة** (صفرُ `<footer>` في `src/`).
            **وفي التطبيق المثبَّت هو السطرُ الوحيدُ الباقي تحت الزرّ**
            بعد سقوط الذيل. */}
        <LandingHero variant="flow" />
        {/* 🆕 **الشاشاتُ بين البطل والذيل** (D-844): **خارجَ
            `data-landing-seo` عمداً** — **ذاك الذيلُ لمحرّك البحث ويسقط
            في التطبيق المثبَّت** (D-843)، **وهذه هي بالضبط ما يُفترض أن
            يراه من حمّل التطبيق ولم يسجّل بعد.** */}
        <LandingShowcase locale={locale} />
        <LandingContent locale={locale} />
      </>
    );
  }

  // مستخدم بلا مكتبة يذهب لشاشة الانضمام — قبل أي رسمٍ أو جلبٍ آخر
  if (followRows.length === 0) redirect("/welcome");

  /* 🆕 D-1066: أرقامُ الترويسة وخرائطُ الموجة الأولى تُحسب في
     `lib/homeCore.ts` — **الحسابُ نفسُه** الذي يقرؤه `GET /api/v1/me/home`. */
  const {
    watchedMovieIds,
    prefs,
    today,
    watchedByShow,
    lastWatchedOrder,
    rewatchSinceMap,
    headerStats,
  } = await buildHomeHeader({ followRows, summary, watchedMovies, profile, myRatings, t });

  /* ⚖️ 🆕 **وحسابُ المستوى عاد بسطرين** (D-536) — **كما وُعد في D-502
     حرفاً**: «رقمُه رخيصٌ من عدّادَين مقروءَين أصلاً، فيعود متى عادت له
     واجهةٌ تعرضه». **والواجهةُ عادت** (الهلالُ حول صورة الترحيب).
     **ولا نداءَ جديد**: الحلقاتُ من `summary` والأفلامُ من
     `watchedMovies` — **كلاهما في يد الصفحة قبل هذا السطر.**
     ⚠️ **ومصدرُ الأرقام هنا غيرُ مصدرِها في الملفّ العامّ**
     (`watch_summary` مقابل `user_watch_overview`) — **والجدولان
     واحد**، **فإن اختلف الرقمان يوماً فالعطلُ في أحد المصدرين لا في
     الرسم** (D-219: رقمان لشيءٍ واحد). */
  /* **والعدّادان يُقرآن هنا أيضاً بلا ثمن**: كلاهما مغلَّفٌ بـ`cache()`
     (D-470) **والشريطُ العلويُّ قرأهما في الطلب نفسِه** — فالنداءُ
     محفوظٌ لا مُكرَّر. */
  const [unreadSignals, unreadShares, followStats] = await Promise.all([
    getUnreadSignals(),
    getUnreadShares(),
    /* 🆕 **عدّادا المتابعة في الترويسة** (D-572) — **في الموجة القائمة
       لا في موجةٍ ثالثة**: **رقمان يُرسمان فوق الطيّة**، **وعدّان
       بـ`head: true` لا يجلبان صفّاً واحداً.** **والفشلُ يعني صفرين لا
       صفحةً مكسورة.** */
    getFollowStats(user.id).catch(() => ({ followers: 0, following: 0 })),
  ]);

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
      {/* **مزوّدُ وضع العرض** — يحمل الاختيارَ في العميل فيقرأه المبدّلُ
          والأقسامُ معاً، **فتبديلُ الشكل إعادةُ رسمٍ محليّة لا رحلةُ خادم.**
          والقيمةُ الابتدائيّة من `profiles.home_prefs` كما كانت. */}
      <HomeViewProvider initial={prefs.view}>
        {/* ⚖️ **وسقطت موجاتُ التسخين الأعمى** (جولة ٢٠ أغسطس — نقضُ
            D-483 بطلب أحمد: «لا prefetch لكل الصفحات بشكل أعمى»).
            البديل في الشريطين لا هنا: المكتبةُ — الوجهةُ المرجَّحة —
            `prefetch={true}` على رابطها فتُجلب كاملةً من الرؤية، وبقيّةُ
            الوجهات تُسخَّن لحظةَ النيّة (لمسة/حومان/تركيز عبر
            `usePrefetchOnIntent`) — فلا يدفع أحدٌ كلفةَ صفحةٍ لن يفتحها.
            و`RoutePrewarm` حُذف بحذف آخرِ مستدعيه. */}
        <HomeHeader
          displayName={displayName}
          /* 🆕 سطرُ «@ahmed» تحت الاسم (D-618) — من صفِّ الملفّ المقروء أصلاً */
          username={profile?.username ?? null}
          /* 🆕 شارةُ Loopz+ (D-633) — والقراءةُ من نداء البروفايل القائم */
          plan={profile?.plan ?? null}
          founder={profile?.founder ?? false}
          plusUntil={profile?.plus_until ?? null}
          verifiedAt={profile?.verified_at ?? null}
          /* ⚖️ 🆕 **الصورةُ والهلالُ والعدّادان عادوا** (D-536): كانت
             الثلاثةُ معاملاتٍ تُقبل ولا تُقرأ منذ D-502 — **وقد سقطت
             من المستدعي في D-503** — **فتعود من بابها الأوّل.**
             **والأرقامُ كلُّها من جلبِ الصفحة نفسِه** (D-470): لا نداءَ
             خامسٌ لأجل ترويسة. */
          avatarUrl={profile?.avatar_url ?? null}
          avatarPos={profile?.avatar_pos ?? null}
          /* 🆕 **والغلافُ من الصفِّ نفسِه** (D-540) — لا نداءَ خامس */
          coverUrl={profile?.cover_url ?? null}
          coverPos={profile?.cover_pos ?? null}
          unreadSignals={unreadSignals}
          unreadShares={unreadShares}
          userId={user.id}
          followers={followStats.followers}
          following={followStats.following}
          hideFollowLists={!!profile?.hide_follow_lists}
          stats={headerStats}
          showStats={prefs.stats}
          locale={locale}
        />
        {/* تلميح أول فتح — يظهر مرةً ثم يصمت (سابقة hintDiscover) */}
        <OneTimeHint
          id="home-customize"
          text={t.hintHome}
          closeLabel={t.closeLabel}
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
            movieProgress={movieProgressPromise}
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
      </HomeViewProvider>
    </div>
  );
}

/* `T` · `Item` · `MixedItem` صارت في `lib/homeCore.ts` (D-1066) — تُستورد أعلاه */
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
  /** وعدٌ لا مصفوفة: أُطلق في `HomePage` وانتُظر هنا (جولة ٢٢ أغسطس) */
  movieProgress: ReturnType<typeof getAllMovieProgress>;
  prefs: ReturnType<typeof sanitizeHomePrefs>;
  watchedByShow: Map<number, number>;
  lastWatchedOrder: number[];
  rewatchSinceMap: Map<number, string>;
  myRatings: Awaited<ReturnType<typeof getMyRatings>>;
  locale: Locale;
  t: T;
  today: string;
}) {
  /* 🆕 D-1066: الحسابُ كلُّه في `lib/homeCore.ts` — **الأسماءُ نفسُها**
     تُفكّ هنا فيبقى الرسمُ أدناه بحرفه، ويقرأ `me/home` النتيجةَ نفسَها. */
  const {
    statsToCache,
    metaToCache,
    movieDatesToCache,
    continueQueueItems,
    toWatchQueueItems,
    listsQueueItems,
    toWatchListItems,
    empty,
    widgetItems,
    toWatchCard,
    playlistCards,
    listCards,
    continueTop,
    continueExtra,
    weekDays,
    weekEntries,
    toWatchRow,
    toWatchOrdered,
    upcomingRow,
    myShows,
    myMovies,
    recap,
    topRated,
    homeListCards,
    toWatchQueueCard,
    listsRowCards,
    toWatchListAt,
    friendsRows,
    followedKeys,
    doneShowIds,
    favGenres,
  } = await buildHomeBody({
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
  });

  return (
    <>
      <ShowStatsSync stats={statsToCache} />
      <HomeOrderSheetHost locale={locale} order={prefs.order} />

      <FollowMetaSync rows={metaToCache} />
      <MovieStatsSync rows={movieDatesToCache} />
      {/* 🆕 **ورقةُ ترتيب الأقسام — تُركَّب مرّةً وتناديها المقابضُ
          بحدث نافذة** (D-595؛ نمطُ قلمِ D-538): عشرةُ أقسامٍ تبثّ كلٌّ
          في `Suspense` خاصّته، وتمريرُ الترتيب لكلِّ واحدٍ خيطٌ يُجرّ
          عبر عشرة مكوّنات — والحدثُ يقطعه. */}
      {/* 🆕 مضيفُ أولويّة الصفوف (D-605، وثالثُها «قوائمي» بـD-615) —
          واحدٌ للأزرار الثلاثة */}
      <HomeQueueSheetHost
        locale={locale}
        cont={continueQueueItems}
        towatch={toWatchQueueItems}
        lists={listsQueueItems}
        towatchList={toWatchListItems}
        /* 🆕 D-918: تبويبُ «عرض» في ورقة «الكل» — بابُ ترتيب الأقسام للمشترك */
        plus={isPlus(profile)}
      />

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

        /* 🔴 🆕 ===== D-868: «الكل» تفتح ورقةً لا تنقل إلى المكتبة =====

           **حكمُ أحمد** (الشقُّ الثاني من طلب D-863، بلقطةٍ محوَّطة):
           «وخيار all لا يوديني المكتبة، يفتحها منبثقة هنا».

           🔑 **والمفردةُ مسنونةٌ عندنا قبل اليوم** (D-624/D-217):
           **«الكل ←» بسهمٍ وعدُ انتقال، و«الكل» بلا سهمٍ وعدُ ورقة** —
           **فالتنفيذُ إسقاطُ السهم لا اختراعُ لغة.**

           ⚠️ **والمكتبةُ لم تُهجر**: **العنوانُ بابُها كما هو** (D-378)
           — **ورقةٌ تُضاف ووجهةٌ تبقى، لا استبدال.**

           ⚠️ **والورقةُ تُرسم مع الصفحة لا عند فتحها** (سابقةُ D-644:
           `ProfileStatSheet` تأخذ محتواها مرسوماً من الخادم فتبقى
           الملصقاتُ مكوّناتِ خادم) — **ولذلك سقفٌ يُقصّ**: مكتبةٌ من
           خمسمئة عملٍ تعني خمسَمئةِ بطاقةٍ في حمولة كلِّ فتحةٍ للرئيسية
           (`LOOPZ-AUD-0036`/`0038`). **والسقفُ ٥٠ — سقفُ D-733 نفسُه**،
           **ويُقال ولا يُخفى**: العددُ الحقيقيُّ في رأس الورقة، **ورابطُ
           المكتبة بسهمه في ذيلها حين يُقصّ** (D-030: لا وعدَ بلا باب). */
        const ALL_SHEET_CAP = 50;
        const allSheetDoor = (
          label: string,
          total: number,
          href: string,
          cards: React.ReactNode[],
        ) =>
          total > 0 ? (
            <ProfileStatSheet
              title={`${label} · ${t.listCount(total)}`}
              closeLabel={t.closeLabel}
              className={seeAllClass}
              content={
                <>
                  <PosterGrid>{cards}</PosterGrid>
                  {total > ALL_SHEET_CAP && (
                    <Link
                      href={href}
                      prefetch={false}
                      className="mt-4 block text-center text-12 font-medium text-accent"
                    >
                      {t.seeAll}
                    </Link>
                  )}
                </>
              }
            >
              {t.allWord}
            </ProfileStatSheet>
          ) : undefined;

        /* **وضعُ العرض يُقرأ مرّةً هنا** (D-434) — **والبياناتُ أعلاه
           واحدةٌ للوضعين**: لا نداءَ ثانٍ ولا فرعَ جلبٍ ثانٍ، **والفرقُ
           في آخر خطوةٍ وحدَها.**

           ⚖️ 🆕 **والخطوةُ الأخيرةُ صارت تُرسم مرّتين** (جولة ٢٢
           أغسطس): **الشكلان يخرجان من الجلب نفسِه**، و`ByHomeView`
           يركّب المختار في العميل — **فالتبديلُ لا يمسّ الخادم.**
           **والفرعُ غيرُ المختار لا يدخل الـDOM** فلا ملصقَ يُجلب له.
           📏 **وثمنُه نصٌّ في الحمولة** مقابل **صفرِ رحلاتٍ** بدل
           رحلتين (٥٥ ك.ب × ٢) في كلِّ ضغطة. */

        /* **«للمشاهدة» هو القسمُ الوحيد الذي يتبدّل عنصرُه لا
           غلافُه**: ملصقٌ في البصريّ وصفٌّ في المختصر — **فيُرسم
           بدالّةٍ واحدةٍ تأخذ الوضع**، لا بنسختين تفترقان عند أوّل
           تعديل (القاعدة ٦). */
        /* ⚖️ 🆕 **زرٌّ واحدٌ في الرأس — أولويّةُ العناصر لا الأقسام**
           (D-605، حكمُه: «خلها زرّ واحد، ما أبغاه يودّيني المكتبة أو
           أرتّب عناوين الهوم») — مقبضُ D-595 و«الكلّ» سقطا من هذا
           الرأس، **والعنوانُ بابُ المكتبة كما هو** (D-378) فما سقط
           إلا التكرار. **وصفٌّ بعنصرٍ واحدٍ لا يُرتَّب** (D-217). */
        const toWatchSection = (view: HomeView) => (
          <Section
            key="towatch"
            title={t.libToWatch}
            icon="bookmark"
            iconColor="var(--accent)"
            href="/library"
            action={
              toWatchOrdered.length > 1 ? (
                <QueueOrderButton
                  row="towatch"
                  label={t.listReorder}
                  word={t.allWord}
                />
              ) : undefined
            }
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
        );

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
                <WidgetSync items={widgetItems} />
                <ContinueSection
                  toWatchCard={toWatchCard}
                  playlistCards={playlistCards}
                  listCards={listCards}
                  continueTop={continueTop}
                  continueExtra={continueExtra}
                  order={prefs.continueOrder}
                  canReorder={continueQueueItems.length > 1}
                  locale={locale}
                  t={t}
                />
              </Suspense>
            ) : null,
          week: (
            <div key="week">
              <span id="week" className="block scroll-mt-20" />
              <WeekStrip
                days={weekDays}
                entries={weekEntries}
                locale={locale}
                /* 🆕 **والعنوانُ بابُ التقويم** (D-828/D-198): **كلُّ صفٍّ
                   يُعرض له بابٌ يُفتح على صفحةٍ كاملة** — **والشريطُ كان
                   الصفَّ الوحيدَ بلا باب.** */
                href="/calendar"
              />
            </div>
          ),
          towatch:
            toWatchRow.length > 0 ? (
              <ByHomeView
                key="towatch"
                visual={toWatchSection("visual")}
                compact={toWatchSection("compact")}
              />
            ) : null,
          upcoming:
            upcomingRow.length > 0 ? (
              /* ⚖️ **قسمٌ يبثّ وحده** (جولة ٢٠ أغسطس): رقمُ الحلقة
                 (D-437) عشرُ رحلات TMDB كانت تقف في وجه الصفحة كلِّها —
                 صارت خلف Suspense خاصّته، والصفُّ معروفُ الوجود مسبقاً
                 فلا هيكلَ يظهر ثم ينهار. */
              <Suspense key="upcoming" fallback={<RailSkeleton count={4} />}>
                <UpcomingSection row={upcomingRow} cards={prefs.cards} t={t} />
              </Suspense>
            ) : null,
          shows:
            myShows.length > 0 ? (
                /* 🗑️ ⚖️ **وسقط زرُّ الترتيب من رؤوس الأقسام** (D-863،
                   حكمُ أحمد: «ليه فيه اثنين all · احذف الإعدادات أقدر
                   أوصل لها من الإعدادات · ويكون فيه all واحد فقط») —
                   **نقضٌ صريحٌ لـD-595** الذي جمع الأداةَ و«الكلّ» في
                   رأسٍ واحد. 🔴 **والعلّةُ أن الاثنين كتبا الكلمةَ
                   نفسَها**: زرُّ الترتيب يلبس `allWord` وبابُ الصفّ
                   يقول «الكل ←» — **فرأسٌ فيه «All» و«All ←» يقرؤهما
                   القارئُ خياراً واحداً مكرَّراً لا فعلين.**
                   ✅ **والبابُ الآخرُ مثبَتٌ لا مفترَض**: الإعدادات ←
                   «الرئيسية والملفّ» فيها صفُّ ترتيبِ الأقسام نفسُه
                   (`HomeCustomize` ← `ReorderSheet` على `prefs.order`) —
                   **فُحص قبل الحذف، ولم تُحذف ميزةٌ بلا باب** (D-030). */
              <Section
                key="shows"
                action={<HomeOrderButton label={t.custArrange} />}
                title={t.myShows}
                icon="tv"
                iconColor="var(--accent)"
                href="/library?filter=tv"
                seeAllDoor={allSheetDoor(
                  t.myShows,
                  myShows.length,
                  "/library?filter=tv",
                  myShows.slice(0, ALL_SHEET_CAP).map((i) => (
                    <PosterCard
                      key={`as-${i.id}`}
                      href={`/show/${i.id}`}
                      title={i.name}
                      posterPath={i.posterPath}
                      progress={i.progress}
                    />
                  )),
                )}
              >
                {myShows.slice(0, cap(myShows.length)).map((i) => (
                  <PosterCard
                    key={`ms-${i.id}`}
                    href={`/show/${i.id}`}
                    title={i.name}
                    posterPath={i.posterPath}
                    progress={i.progress}
                    count={
                      i.watched > 0 && i.aired > i.watched
                        ? i.aired - i.watched
                        : undefined
                    }
                    badge={
                      i.watched === 0
                        ? t.notStartedBadge
                        : i.aired > 0 && i.watched >= i.aired
                          ? t.watchedBadge
                          : undefined
                    }
                    badgeTone={
                      i.aired > 0 && i.watched >= i.aired && i.watched > 0
                        ? "watched"
                        : "neutral"
                    }
                  />
                ))}
              </Section>
            ) : null,
          movies:
            myMovies.length > 0 ? (
              <Section
                key="movies"
                action={<HomeOrderButton label={t.custArrange} />}
                title={t.myMovies}
                icon="film"
                iconColor="var(--accent)"
                href="/library?filter=movie"
                seeAllDoor={allSheetDoor(
                  t.myMovies,
                  myMovies.length,
                  "/library?filter=movie",
                  myMovies.slice(0, ALL_SHEET_CAP).map((m) => (
                    <PosterCard
                      key={`am-${m.tmdbId}`}
                      href={`/movie/${m.tmdbId}`}
                      title={m.title}
                      posterPath={m.posterPath}
                      progress={m.progress}
                    />
                  )),
                )}
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
                  <Icon
                    name="book"
                    size={20}
                    style={{ color: "var(--accent)" }}
                  />
                  {t.recapTitle}
                </h2>
                {/* 🆕 مقبضُ الترتيب بجوار «الكلّ» — كسائر الأقسام (D-595) */}
                <span className="shrink-0 flex items-center gap-2.5">
                  <Link
                    href="/activity"
                    className="text-xs text-accent hover:brightness-110 transition"
                  >
                    {t.seeAll}
                  </Link>
                </span>
              </div>
              <Link
                href="/activity"
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
                action={<HomeOrderButton label={t.custArrange} />}
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
            homeListCards.length > 0 || toWatchQueueCard ? (
              <div key="lists">
                <PublicListsRail
                  lists={listsRowCards}
                  locale={locale}
                  /* ⚖️ 🆕 D-703 (حكمُه: «غيّر اسمها من My list إلى List»):
                   **اسمُ الصفِّ اسمُ وجهته** (`/lists` — D-030)،
                   **ولا اسمانِ لشيءٍ واحدٍ في التطبيق** (D-145). */
                  title={t.listsTitle}
                  /* 🆕 D-703: «كذلك لازم to watch تكون موجودة فيها» —
                     البطاقةُ نفسُها التي في المكتبة (D-559)، أوّلَ الصفّ */
                  leading={
                    toWatchQueueCard ? (
                      <ToWatchListCard
                        locale={locale}
                        initialOn={toWatchQueueCard.on}
                        count={toWatchQueueCard.count}
                        posters={toWatchQueueCard.posters}
                      />
                    ) : undefined
                  }
                  /* 🆕 **وموضعُها موضعٌ يُرتَّب لا صدارةٌ مفروضة**
                     (D-866) — الحسبةُ في `listsRowSeq` أعلاه */
                  leadingIndex={toWatchListAt}
                  /* 🆕 مقبضُ الصفِّ يرتّب **بطاقاتِه** (D-615) لا الأقسام —
                     نقضُ D-595 المحصورُ نفسُه الذي مضى في الصفَّين (D-605)،
                     وبطاقةٌ واحدةٌ لا تُرتَّب فلا زرَّ لها (D-217) */
                  action={
                    /* 🆕 **والعدُّ عدُّ ما يُرتَّب** (D-866): قائمةٌ
                       واحدةٌ مع «للمشاهدة» صفَّان يُرتَّبان */
                    listsQueueItems.length > 1 ? (
                      <QueueOrderButton
                        row="lists"
                        label={t.listReorder}
                        word={t.allWord}
                      />
                    ) : undefined
                  }
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
                  <>
                    <RailNewBadge
                      id="friends"
                      sig={friendsRows
                        .map((r) => `${r.media_type}${r.tmdb_id}`)
                        .join(",")}
                      locale={locale}
                    />
                  </>
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
          trending: prefs.order.includes("trending") ? (
            /* ⚖️ **«الرائج» يبثّ وحده** (جولة ٢٠ أغسطس): نداءُ TMDB
                 الوحيد الذي لا يخصّ مكتبتك — كان أبطأَ عضوٍ في الموجة
                 فيحكم في ظهور كلِّ الأقسام. **وشرطُ الظهور صار التفضيلَ
                 وحدَه (D-599)**؛ وسقوطُ الجلب كلِّه يُسقط القسمَ صامتاً
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
  seeAllDoor,
  action,
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
  /** 🆕 **بابُ الورقة بدل رابط الانتقال** (D-868) — يُمرَّر كما هو */
  seeAllDoor?: React.ReactNode;
  /** 🆕 مقبضُ ترتيب الأقسام (D-595) — يجلس بجوار «الكلّ» لا مكانه */
  action?: React.ReactNode;
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
      seeAllDoor={seeAllDoor}
      action={action}
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

/* الأنواعُ الثلاثة (`ContinueExtra` · `BriefListCard` · `ToWatchQueueCard`) صارت في `lib/homeCore.ts` (D-1066) */
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
  order,
  canReorder,
  locale,
  t,
}: {
  toWatchCard: ToWatchQueueCard | null;
  playlistCards: BriefListCard[];
  listCards: BriefListCard[];
  continueTop: Item[];
  continueExtra: ContinueExtra[];
  /** 🆕 أولويّةُ صاحب الصفّ (D-605) — تُطبَّق على بطاقاته كلِّها */
  order: string[];
  /** وصفٌّ بعنصرٍ واحدٍ لا يُرتَّب (D-217) */
  canReorder: boolean;
  locale: Locale;
  t: T;
}) {
  const { backdropOf } = await continueBackdrops({ toWatchCard, playlistCards, listCards });
  /* **الرسمان من الجلب نفسِه** (جولة ٢٢ أغسطس): مشاهدُ «التالي» فوقُ
     تُجلب مرّةً واحدة، **والذي يتبدّل بالوضع غلافُ القسم وشكلُ بطاقة
     «تابِع المشاهدة» وحدَهما** — فيُرسمان معاً ويختار العميل. */
  /* ⚖️ 🆕 **بطاقاتُ الصفِّ عناصرُ مفاتيحَ تُفرز بأولويّة صاحبها**
     (D-605): كانت المجموعاتُ تُرسم بترتيبٍ مقفول (طابورٌ فقوائمُ
     فأعمال) — **وصارت قائمةً واحدةً يفرزها `applyQueueOrder`
     بالمفاتيح نفسِها التي تعرضها ورقةُ الترتيب**، فما يسحبه فيها
     هو ما يتقدّم هنا، عبر الأنواع لا داخل كلِّ نوع. */
  const rail = (view: HomeView) => {
    const nodes: { key: string; node: React.ReactNode }[] = [];
    return (
      <Section
        key="continue"
        title={t.continueWatching}
        icon="play"
        iconColor="var(--accent)"
        href="/library"
        action={
          canReorder ? (
            <QueueOrderButton
              row="continue"
              label={t.listReorder}
              word={t.allWord}
            />
          ) : undefined
        }
        view={view}
        wide
      >
        {/* الترتيبُ الافتراضيُّ ترتيبُ D-496/D-505 كما كان (طابورٌ
            فقوائمُ فأعمال — الأقربُ إلى الاستئناف أوّلاً)، **وأولويّةُ
            صاحبها فوقه** (D-605). */}
        {(() => {
          if (toWatchCard) {
            nodes.push({
              key: "lc-towatch",
              node: (
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
                  /* 🆕 **وبطاقةُ القائمة تتبع الوضعَ كأختها** (D-552) —
                     صفٌّ واحدٌ لا يملك هندستين. */
                  variant={view === "compact" ? "row" : "card"}
                  locale={locale}
                />
              ),
            });
          }
          for (const c of playlistCards) {
            nodes.push({
              key: `pl-${c.list.id}`,
              node: (
                <ListContinueCard
                  key={`pl-${c.list.id}`}
                  listName={curatedName(c.list.sourceSlug, c.list.name, locale)}
                  next={{
                    tmdbId: c.next!.tmdb_id,
                    mediaType: c.next!.media_type,
                    title: c.next!.title,
                    posterPath: c.next!.poster_path,
                    backdropPath: backdropOf(c.next!),
                    followed: c.nextFollowed,
                  }}
                  watched={c.watched}
                  total={c.total}
                  variant={view === "compact" ? "row" : "card"}
                  locale={locale}
                />
              ),
            });
          }
          for (const c of listCards) {
            nodes.push({
              key: `lc-${c.list.id}`,
              node: (
                <ListContinueCard
                  key={`lc-${c.list.id}`}
                  listName={curatedName(c.list.sourceSlug, c.list.name, locale)}
                  next={{
                    tmdbId: c.next!.tmdb_id,
                    mediaType: c.next!.media_type,
                    title: c.next!.title,
                    posterPath: c.next!.poster_path,
                    backdropPath: backdropOf(c.next!),
                    followed: c.nextFollowed,
                  }}
                  watched={c.watched}
                  total={c.total}
                  variant={view === "compact" ? "row" : "card"}
                  locale={locale}
                />
              ),
            });
          }
          continueTop.forEach((i, n) => {
            nodes.push({
              key: `c-${i.id}`,
              node: (
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
              ),
            });
          });
          return applyQueueOrder(nodes, (x) => x.key, order).map((x) => x.node);
        })()}
      </Section>
    );
  };

  return <ByHomeView visual={rail("visual")} compact={rail("compact")} />;
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
  t,
}: {
  row: MixedItem[];
  cards: ReturnType<typeof sanitizeHomePrefs>["cards"];
  t: T;
}) {
  const rows = await upcomingWithEpisodes(row, t);

  const cap = (n: number) => capCards(n, cards);
  /* **الرسمان من الجلب نفسِه**: أرقامُ الحلقات فوقُ تُجلب مرّةً،
   **والذي يتبدّل صدرُ الصفّ وغلافُ القسم** — لا نداءَ ثانٍ. */
  const rail = (view: HomeView) => (
    <Section
      key="upcoming"
      action={<HomeOrderButton label={t.custArrange} />}
      title={t.libUpcoming}
      icon="hourglass"
      iconColor="var(--accent)"
      href="/library"
      /* 🆕 **و«القادم» ثالثةُ الأقسام التي كانت تنقل إلى المكتبة**
         (D-868) — **والقاعدةُ لا تُطبَّق في اثنين من ثلاثة** (D-863).
         **وجسدُ الورقة صفوفُ الصفِّ نفسُها** (`CompactMediaRow`) لا
         شبكةَ ملصقاتٍ: **القادمُ موعدٌ قبل أن يكون عملاً** (D-434)،
         **وشكلٌ ثانٍ للشيء نفسِه في ورقته يُقرأ قسماً ثانياً.** */
      seeAllDoor={
        <ProfileStatSheet
          title={`${t.libUpcoming} · ${t.listCount(rows.length)}`}
          closeLabel={t.closeLabel}
          className={seeAllClass}
          content={
            <>
              <div className="flex flex-col">
                {rows.slice(0, 50).map((x) => (
                  <CompactMediaRow
                    key={`ua-${x.key}`}
                    href={x.href}
                    chip={x.badge}
                    title={x.title}
                    subtitle={x.ep ?? x.subtitle}
                  />
                ))}
              </div>
              {rows.length > 50 && (
                <Link
                  href="/library"
                  prefetch={false}
                  className="mt-4 block text-center text-12 font-medium text-accent"
                >
                  {t.seeAll}
                </Link>
              )}
            </>
          }
        >
          {t.allWord}
        </ProfileStatSheet>
      }
      view={view}
      soloFull
      wide
    >
      {/* **القادمُ موعدٌ قبل أن يكون عملاً** (D-434): الصدرُ في السطر
            الأوّل هو التاريخ، واسمُ العمل تحته — **فالقارئ يسأل «متى» ثم
            «ماذا»، لا العكس.** وفي المختصر يصير التاريخُ رقاقةً في صدر
            الصفّ بدل الملصق. */}
      {rows
        .slice(0, cap(rows.length))
        .map((x) =>
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

  return <ByHomeView visual={rail("visual")} compact={rail("compact")} />;
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
  const trend = await trendingRail();
  if (trend.length === 0) return null;

  const cap = (n: number) => capCards(n, cards);
  return (
    <Section
      key="trending"
      action={<HomeOrderButton label={t.custArrange} />}
      title={t.trendingWeek}
      icon="trending"
    >
      {trend.slice(0, cap(12)).map((r) => {
        const mt = r.media_type === "tv" ? "tv" : "movie";
        const seen =
          mt === "movie" ? watchedMovieIds.has(r.id) : doneShowIds.has(r.id);
        /* ⚖️ 🆕 **بطاقةُ «الرائج» صارت كسائر البطاقات** (D-609، حكمُ
           أحمد بلقطة: «شيل علامة البوكمارك والصح وخلّها مثل الباقي —
           أسوّي عليها هولد ويكون تحتها خطّ أخضر/أزرق حسب حالتها»):
           زرُّ الحفظ السريع وصحُّه العائمان سقطا — **وهما بقيّةُ ما
           منعته D-434 («لا أزرار عائمة فوق البوسترات») في صفٍّ واحدٍ
           شذّ** — والحالةُ في خيط `StatusThread` (أخضرُ مُشاهَدٌ ·
           سماويٌّ محفوظ) والأفعالُ في قائمة الضغط المطوّل (D-229:
           بابٌ واحدٌ لأفعال الملصق في كلِّ سطح). */
        return (
          <PosterCard
            key={`${r.media_type}-${r.id}`}
            href={`/${mt === "tv" ? "show" : "movie"}/${r.id}`}
            title={titleOf(r)}
            posterPath={r.poster_path}
            year={yearOf(r)}
            badge={mt === "tv" ? t.typeSeries : t.typeMovie}
            hold={{
              tmdbId: r.id,
              mediaType: mt,
              added: followedKeys.has(`${mt}-${r.id}`),
              watched: seen,
              progress: seen ? 100 : 0,
              locale,
            }}
          />
        );
      })}
    </Section>
  );
}
