import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getMyListNames,
  getUser,
  getPublicListsFeed,
  getForYouLists,
  getTopSavedLists,
  getMySavedListIds,
  getListCardsByIds,
  getCuratedListIds,
  getListCardStats,
} from "@/lib/data";
import { getLibState } from "@/lib/libState";
import { cookies } from "next/headers";
import { parseMyRows, MY_ROWS_COOKIE, type MyRow } from "@/lib/myRows";
import { BROWSE_GENRES, BROWSE_TAGS, browseGenreName, browseTagName } from "@/lib/browse";
import { LOOPZ_PERSON } from "@/lib/loopz";
import { Avatar } from "@/components/Avatar";
import { PublicListsRail } from "@/components/PublicListsRail";
import { ListsFilters } from "@/components/ListsFilters";
import { AddWorksToList } from "@/components/AddWorksToList";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { FRANCHISES, franchiseName, universeName, type Universe } from "@/lib/universes";
import { awardBySlug, awardBody, awardWins } from "@/lib/awards";
import { Icon } from "@/components/Icon";
import Image from "next/image";
import {
  topTenAnimeThisWeek,
  topTenAnimeMoviesThisWeek,
  keywordId,
  companyId,
  ANIME_KEYWORD,
  topByFilter,
  topRatedRows,
  awardWinners,
  upcomingByFilter,
  nowPlayingMovies,
  listWatchProviders,
  moviesByIds,
  resolveSetIds,
  titleOf,
  yearOf,
  posterUrl,
  type SearchResult,
  type DiscoverFilter,
} from "@/lib/tmdb";
import { ScrollMemory } from "@/components/ScrollMemory";
import { animeMovieRail, topChartRail, looksAnime, railGuard } from "@/lib/topChart";
import { buildSection, sectionHref } from "@/lib/sections";
import { attachImdbRatings, withImdbRatings } from "@/lib/omdb";
import { getT, getWatchRegion, getTabPrefs } from "@/lib/locale";
import { defaultTab } from "@/lib/tabPrefs";
import { regionName } from "@/lib/region";
import { num, type Locale } from "@/lib/i18n";
import {
  parseBrowse,
  parseDiscoverTab,
  parseRailWin,
  browseKey,
  eraRange,
  seasonRange,
  browseHref,
  type BrowseQuery,
  type RailWin,
} from "@/lib/browse";
import { RankedRail } from "@/components/RankedRail";
import { OneTimeHint } from "@/components/OneTimeHint";
import { RailWindowChips } from "@/components/RailWindowChips";
import { CountdownRail, type CountdownItem } from "@/components/CountdownRail";
import { PickedForYou } from "@/components/PickedForYou";
import { RailSkeleton } from "@/components/Skeletons";
import { DiscoverFilters } from "@/components/DiscoverFilters";
import { getSuggestions } from "@/lib/suggest";

type T = Awaited<ReturnType<typeof getT>>["t"];

/** اسم الجائزة بلغة الواجهة — لعنوان صفّ الفائزين */
function universeAwardTitle(a: { ar: string; en: string }, locale: Locale) {
  return locale === "en" ? a.en : a.ar;
}

function dateOf(r: SearchResult) {
  return r.release_date ?? r.first_air_date ?? "";
}

/**
 * اكتشف.
 *
 * شكلٌ واحد لا شكلان: صفوفٌ منسّقة تُقرأ بالتمرير — في السينما، وأفضل
 * عشرة، والقادم بعدّ تنازلي. واختيار جهةٍ أو نوعٍ درامي لا يستبدل الصفوف
 * بشبكة نتائج كما كان، بل يُبقيها ويقصرها على ما اختاره: من يختار
 * «دراما» يريد أفضل الدراما وقادمها، لا جداراً من كل عملٍ درامي مرتّباً
 * بالشعبية. ولذلك سقط صفُّ الترتيب — لكل صفٍّ ترتيبه بحكم معناه.
 *
 * الفلاتر ترسم فوراً، والصفوف خلف Suspense تجلب بياناتها بنفسها — فلا
 * تنتظر الصفحة كلّها أبطأ طلب TMDB.
 */
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    src?: string;
    type?: string;
    win?: string;
    wm?: string;
    ws?: string;
    wa?: string;
    /** نافذة صفّ «أفضل ١٠ أفلام أنمي» (D-169) */
    wam?: string;
    g?: string;
    sort?: string;
    lang?: string;
    co?: string;
    p?: string;
    era?: string;
    rate?: string;
    /** وسمُ الموضوع — زومبي، سرقات، سفرٌ عبر الزمن… (طلب أحمد ١١ أغسطس) */
    tag?: string;
    award?: string;
    fr?: string;
    lsrc?: string;
  }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const sp = await searchParams;
  /* ثلاثة تبويبات (طلب أحمد 9 Aug): أفلام · مسلسلات · القوائم — الجهة
     صعدت من ورقة الفلاتر إلى الرأس، فتُفرض هنا على التصفح من التبويب
     (وروابط ?type القديمة يهديها parseDiscoverTab لتبويبها) */
  const tabPrefs = await getTabPrefs("discover");
  /* 🆕 صفوفُك الخاصة (D-337) — كوكيزٌ كتفضيلات التبويبات */
  const myRows = parseMyRows((await cookies()).get(MY_ROWS_COOKIE)?.value);
  /* الرابط الأعزل يعني «افتح على تبويبي الأوّل» لا «افتح على الأفلام»
     (D-179): الافتراضُ صار يخصّ صاحبه، فيُقرأ من الكوكي لا من الشيفرة */
  const tab =
    sp.tab || sp.type
      ? parseDiscoverTab(sp.tab, sp.type)
      : parseDiscoverTab(defaultTab(tabPrefs, "shows"));
  /* **وجهةُ الأنمي «الكلّ» لا «فيلم»** (طلب أحمد ١١ أغسطس: «الأنمي في
     ديسكفري لازم يكون له فلتر»): تبويبُه يحمل صفَّي أفلامٍ وصفَّي
     مسلسلات معاً، فلو قُيّد بجهةٍ واحدة لسقط من قائمة الأنواع ما لا
     مقابل له فيها — «رعب» يغيب عن نصفٍ يعرضه فعلاً. */
  const browse = parseBrowse({
    ...sp,
    type: tab === "shows" ? "tv" : tab === "anime" ? "all" : "movie",
  });
  /* نوافذ صفوف «أفضل ١٠» — لكل صفٍّ نافذته (D-099): أفلام/مسلسلات/أنمي */
  const rails = {
    m: parseRailWin(sp.wm),
    s: parseRailWin(sp.ws),
    a: parseRailWin(sp.wa),
    am: parseRailWin(sp.wam),
  };
  /* قائمة المنصّات تُجلب على الخادم وتُمرَّر للورقة: طلبٌ واحد مخبَّأ ساعةً
     في طبقة fetch، ورأس الصفحة يبقى يرسم فوراً لأن الصفوف وحدها خلف
     Suspense. وفشلُ الجلب يُخفي المحور بدل أن يعرض خانةً فارغة.
     وتبويب «القوائم» لا يطلبها أصلاً — ورقة الفلاتر لا تُفتح فيه */
  const [providers, region] = await Promise.all([
    /* والأنمي صار يطلبها معهما: صار له فلترُه بأربعة محاور، والمنصّة
       أحدُها — «وش متاح على اشتراكي؟» سؤالٌ يُسأل عن الأنمي كما يُسأل عن
       غيره. تبويبُ القوائم وحده لا يطلبها (ورقة فلاتره أخرى تماماً) */
    tab !== "lists"
      ? listWatchProviders(browse.type === "tv" ? "tv" : "movie")
      : Promise.resolve([] as { id: number; name: string }[]),
    getWatchRegion(),
  ]);

  return (
    /* **الإيقاعُ الرأسيّ ضُيّق (D-200، لقطةُ أحمد بخطوطٍ زرقاء على الفراغ):**
       الجذرُ كان `space-y-8` — **اثنان وثلاثون بكسلاً بين الرأس اللاصق
       وأوّل صفّ**، والرأسُ نفسُه ينتهي بـ`pb-2`. أي **أربعون بكسلاً لا
       تفصل شيئاً عن شيء**: فوقها خطُّ الرأس وتحتها عنوانٌ عريض.

       **وثمنُها يُقاس بما لا يراه العميل:** على شاشة ٣٦٠×٨٠٠ كانت الشاشةُ
       الأولى تنتهي عند بطاقات «مقترح لك» وحدها؛ وباستعادة هذه البكسلات
       ومثلِها من كل فجوة يظهر عنوانُ الصفّ الثاني **قبل التمرير** — وهو
       ما يجعله يمرّر أصلاً. **الفراغُ الذي لا يفصل معنيين ليس تنفّساً بل
       تأجيلٌ للمحتوى.**

       والاثنا عشر هنا لا صفر: **العناوينُ عريضة، وصفرٌ يجعل أوّلَ عنوانٍ
       يلتصق بخطّ الرأس** فيُقرأ جزءاً منه. */
    <div className="space-y-3">
      {/* ذاكرة موضع التمرير — العائد من عملٍ يهبط حيث كان (تدقيق 8 Aug م٢) */}
      <ScrollMemory />
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة */}
      <h1 className="sr-only">{t.newsTitle}</h1>

      <DiscoverFilters
        locale={locale}
        tab={tab}
        tabPrefs={tabPrefs}
        myRows={myRows}
        type={browse.type}
        genre={browse.genre?.slug ?? null}
        lang={browse.lang?.code ?? null}
        country={browse.country?.code ?? null}
        provider={browse.provider}
        providers={providers}
        region={region}
        era={browse.era?.slug ?? null}
        rate={browse.rate}
        tag={browse.tag?.slug ?? null}
        award={browse.award}
        status={browse.status?.slug ?? null}
        season={browse.season?.slug ?? null}
        studio={browse.studio?.slug ?? null}
        listsFilters={
          tab === "lists"
            ? listsFiltersProps(
                FRANCHISES.some((f) => f.slug === sp.fr) ? sp.fr! : null,
                /* `friends` لم يُدرَج (D-195): الرابطُ القديم يقرأ «الكل» */
                ["curated", "community"].includes(sp.lsrc ?? "")
                  ? (sp.lsrc as "curated" | "community")
                  : "all",
                locale === "en" ? "en" : "ar",
                t,
              )
            : undefined
        }
      />

      {/* تلميح لمرة واحدة (م٣): القوة المدفونة خلف زر Filters ورقائق
          النوافذ تُقال مرةً ثم تصمت للأبد */}
      {tab !== "lists" && (
        <OneTimeHint id="discover-power" text={t.hintDiscover} closeLabel={t.closeLabel} />
      )}


      {tab === "anime" ? (
        /* ===== تبويب الأنمي (D-169، ثم الفلتر بطلب أحمد ١١ أغسطس) =====
            ستّة صفوف بمعانٍ ثابتة: الشخصيّ ← ما يُعرض الآن ← الأفضل
            عشراً (فيلماً ومسلسلاً) ← الأفضل خمسين (فيلماً ومسلسلاً).
            **وصار عليه فلتر** بعد أن كان «ستّة أسئلة محسومة»: أربعة
            محاور — النوع والحقبة والتقييم والمنصّة. وما لا يستطيع أن
            يطيعه **يختفي ما دام الفلتر مفعّلاً** (اختيار أحمد) لا
            يبقى يعرض ما لم يُطلب: الشخصيُّ وما يُعرض الآن وذيلا
            «أفضل ٥٠» — الأخيران من `imdb_chart` لا من `/discover`،
            فلا مكان فيهما لنوعٍ ولا لحقبة. **وصفٌّ يتجاهل ما اخترتَه
            يكذب عليك** (D-075). */
        <Suspense
          key={browseKey(browse)}
          fallback={
            <div className="space-y-6" aria-hidden>
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
            </div>
          }
        >
          <AnimeRails locale={locale} t={t} rails={rails} browse={browse} region={region} myRows={myRows} />
        </Suspense>
      ) : tab === "lists" ? (
        /* ===== تبويب «القوائم» — صفوفٌ كصفوف الأعمال (D-084) =====
            سقط البحث والرقائق (طلب المالك: «نفس التقسيم والتناسق»):
            التبويب صفوفٌ تُقرأ بالتمرير كتبويب الأعمال تماماً — عالمٌ
            فعالم، ثم من تتابعهم، ثم المجتمع. لا حالة في الرابط فلا مفتاح */
        <Suspense
          key={`${sp.fr ?? ""}|${sp.lsrc ?? ""}`}
          fallback={
            <div className="space-y-6" aria-hidden>
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
            </div>
          }
        >
          <ListsDiscovery
            locale={locale}
            t={t}
            fr={FRANCHISES.some((f) => f.slug === sp.fr) ? sp.fr! : null}
            lsrc={
              ["curated", "community"].includes(sp.lsrc ?? "")
                ? (sp.lsrc as "curated" | "community")
                : "all"
            }
          />
        </Suspense>
      ) : (
        /* المفتاح يتغيّر بتغيّر الفلتر: React يُظهر الهيكل فوراً بدل أن
            يُبقي صفوف الفلتر السابق معلّقة حتى تصل الجديدة.
            نوافذ الصفوف (wm/ws/wa) ليست في المفتاح عمداً (سؤال أحمد
            «ليش كامل الصفحة تتحدث؟»): رقاقةٌ واحدة يجب ألا تعيد تركيب
            الصفوف كلّها هيكلاً — التبديل transition في مكانه، والرقائق
            تعتم قليلاً ريثما يصل الصف الجديد */
        <Suspense
          key={browseKey(browse)}
          fallback={
            <div className="space-y-6" aria-hidden>
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
            </div>
          }
        >
          <CuratedRails locale={locale} t={t} browse={browse} rails={rails} region={region} myRows={myRows} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * ديسكفري القوائم (D-082 ثم D-084): صفوفٌ كصفوف الأعمال، بلا بحثٍ ولا
 * رقائق مصدر — «نفس التقسيم والتناسق» (طلب المالك).
 *
 * كل عالمٍ صفٌّ باسمه: بطاقته الأولى القائمة الكاملة مرتّبةً، وبعدها
 * الفرعيات (سبايدر-مان، آيرون مان…) — ثم صفّا من تتابعهم والمجتمع.
 */

/** خصائص فلاتر القوائم — يبنيها الخادم مرةً للزرّ (في سطر التبويبات) والرقائق */
function listsFiltersProps(
  fr: string | null,
  lsrc: "all" | "curated" | "community",
  loc: "ar" | "en",
  t: T,
) {
  return {
    fr,
    lsrc,
    franchises: FRANCHISES.map((f) => ({ slug: f.slug, label: franchiseName(f, loc) })),
    labels: {
      button: t.browseFilters,
      title: t.browseFiltersTitle,
      world: t.listsFilterWorld,
      source: t.listsFilterSource,
      all: t.browseAll,
      curated: t.listsCurated,
      community: t.publicListsRail,
      apply: t.browseApply,
      close: t.closeLabel,
    },
  };
}

async function ListsDiscovery({
  locale,
  t,
  fr,
  lsrc,
}: {
  locale: Locale;
  t: T;
  /** فلتر العالم من الرابط (?fr=slug) — دفعة أحمد الثالثة */
  fr: string | null;
  /** فلتر المصدر (?lsrc=) */
  lsrc: "all" | "curated" | "community";
}) {
  /* **صفُّ «من أتابعهم» حُذف (D-195، مواصفةُ أحمد بنصّها: «From People You
     Follow is not included. Community content remains in the separate
     Community section»).**

     **والسببُ الذي يجعله صحيحاً لا مجرَّد طلبٍ يُنفَّذ:** اكتشفُ سؤالُ
     «ماذا أشاهد؟»، **ومن أتابعهم بابُهم قسمُ المجتمع** — وقائمةٌ واحدة في
     بابين نسختان لمعنًى واحد (D-145).

     **وسقط معه نداءٌ كامل:** `getFollowedPublicLists` كان يُقرأ **لغرض
     الاستبعاد وحده** (كي لا تظهر قائمةُ صديقٍ في الصفّين). ولمّا ذهب صفُّه
     صارت قوائمُهم تُعرض في خطّ المجتمع **كسائر الناس** — فلا تكرار،
     ولا استبعاد، **ولا نداء**. */
  const community = (await getPublicListsFeed(25).catch(() => [])).slice(0, 15);
  /* 🆕 **صفّان جديدان فوق المنسّقة** (D-324، طلبُ أحمد: «هل بالإمكان
     تحسين اللستات بحيث يكون فيها for you والأكثر شعبية؟»).

     **والأوّلُ وحدَه احتاج هجرة**: «الأكثر حفظاً» تقرأ `top_saved_lists`
     المبنيّةَ منذ D-289 — **كانت تعمل في لوحة الأعضاء ولا تُقرأ هنا**،
     **وأرخصُ ميزةٍ هي التي بُنيت ولم تُوصَل** (D-262).

     ⚠️ **وكلاهما يُخفي نفسَه فارغاً** (D-181): بحسابٍ بلا مكتبة لا
     «تناسبك»، وبقاعدةٍ فيها حفظان لا «الأكثر حفظاً» — **وصندوقٌ فارغٌ
     تحت عنوانٍ يَعِد أسوأ من غيابه.** */
  const [forYouRows, savedRows, savedIds, me, curated] = await Promise.all([
    getForYouLists(12).catch(() => []),
    getTopSavedLists(30, 12).catch(() => []),
    getMySavedListIds().catch(() => new Set<string>()),
    getUser().catch(() => null),
    /* **خريطةُ المجموعات المولَّدة** (D-328) — نداءٌ واحدٌ لاثنتين وأربعين
       بطاقة (D-205)، **والغائبُ يُفتح معاينةً كما كان**. **وصعدت إلى هنا
       في D-331** لأن الترشيحَ تحتها صار يحتاجها. */
    getCuratedListIds().catch(() => new Map<string, string>()),
  ]);
  /* 🔴 **وقوائمُ لوبز المنسّقة لا تُقترح في صفٍّ فوق صفوفها** (D-331).
     يومَ وُلِّدت الاثنتان والأربعون (D-330) صارت صفوفاً **حقيقيّةً** في
     `user_lists` — **فالتقطها «تناسبك» و«الأكثر حفظاً» فوراً**، وظهرت
     «توي ستوري» في صدر الصفحة **وهي مرسومةٌ بعينها بعد ثلاثة صفوف**.
     **وهو حرفاً عطلُ D-326** الذي أبلغ عنه أحمد («المفروض ماتظهر
     وتتكرّر») بمصدرٍ ثانٍ — **وصفٌّ يعرض ما يعرضه جارُه أسفله تكرارٌ
     يُقرأ عطلاً** (D-299).
     ⚠️ **والترشيحُ في الصفحة لا في الدالّة**: `for_you_lists` و
     `top_saved_lists` صحيحتان حيث تُقرآن من سطحٍ لا صفوفَ منسّقةً فيه
     (نفسُ حجّة D-152 حرفاً). */
  const isCurated = new Set(curated.values());
  /* 🔴 **ما حفظتَه لا يُقترح عليك، ولا يظهر مرّتين** (D-326، بلاغُ أحمد:
     «هذي أنا حافظها عندي، المفروض ما تظهر وتتكرّر»).

     **وهما حكمان لا حكم:**
     ١) **المحفوظُ صار عندك** — بابُه «قوائمي» في المكتبة، **واقتراحُ ما
        تملكه ليس اكتشافاً** (نفسُ حجّة إخراج قوائمك من `for_you_lists`).
        **ويشمل «الأكثر حفظاً»**: هو سطحُ اكتشافٍ هنا لا لوحةَ إحصاء —
        **ولذلك رُشِّح في الصفحة لا في الدالّة**، فلوحةُ الأعضاء تقرأ
        `top_saved_lists` نفسَها ولا تتغيّر (D-152).
     ٢) **وصفٌّ يعرض ما عرضه جارُه فوقه تكرارٌ يُقرأ عطلاً** (D-257/D-299)
        — **والشخصيُّ يسبق العامّ** فيحتفظ بالبطاقة، والعامُّ يتنازل. */
  const forYouIds = forYouRows
    .map((r) => r.listId)
    .filter((id) => !savedIds.has(id) && !isCurated.has(id));
  const shown = new Set(forYouIds);
  const savedRailIds = savedRows
    .filter(
      (r) =>
        !savedIds.has(r.listId) &&
        !shown.has(r.listId) &&
        !isCurated.has(r.listId) &&
        r.ownerId !== me?.id,
    )
    .map((r) => r.listId);
  /* **والبطاقاتُ من `shapeListCards` لا من محوّلٍ محليّ** (D-326): العدُّ
     الحقيقيُّ والملصقاتُ وسطرُ الصاحب من المصدر الذي تقرأ منه أخواتُها
     الثلاث — **وهو ما أنهى «Empty» فوق ثلاثة ملصقات.** */
  const [forYou, mostSaved] = await Promise.all([
    getListCardsByIds(forYouIds),
    getListCardsByIds(savedRailIds),
  ]);
  /* **قراءةٌ واحدة لعلامات الحفظ** (D-206): بطاقاتُ المجموعات عشراتٌ في هذا
     التبويب، **ولو سألت كلُّ بطاقةٍ عن نفسها لصارت الصفحةُ عشرين استعلاماً**.
     و`getMyListNames` مغلَّفةٌ بـ`cache` فالنداءُ واحدٌ للطلب كلِّه. */
  const savedNames = await getMyListNames();
  /* 🆕 **أرقامُ بطاقات لوبز** (D-335): نداءُ `list_card_stats` واحدٌ
     للاثنتين والأربعين (D-205) — بعد خريطة `curated` لأنه يحتاج
     معرّفاتِها. */
  const curatedStats = await getListCardStats([...curated.values()]);

  const loc = locale === "en" ? ("en" as const) : ("ar" as const);
  const rows = fr ? FRANCHISES.filter((f) => f.slug === fr) : FRANCHISES;

  return (
    <div className="space-y-6">
      {/* الزرّ صعد إلى سطر التبويبات (داخل DiscoverFilters) — هنا
          رقائق المختار وحدها، كصفّ رقائق تبويب الأعمال (طلب أحمد) */}
      <ListsFilters variant="chips" {...listsFiltersProps(fr, lsrc, loc, t)} />

      {/* **الشخصيُّ يسبق العامّ** — نفسُ ترتيب تبويب الأعمال حرفاً
          («مقترح لك» ثم «من فنّانيك» ثم الرفوف العامّة). **ولا يظهران مع
          فلتر عالَمٍ مختار**: من ضغط «مارفل» يريد مارفل لا اقتراحاً. */}
      {!fr && lsrc !== "curated" && forYou.length > 0 && (
        <PublicListsRail lists={forYou} locale={locale} title={t.listsForYou} />
      )}
      {!fr && lsrc !== "curated" && mostSaved.length > 0 && (
        <PublicListsRail lists={mostSaved} locale={locale} title={t.listsMostSaved} />
      )}

      {(lsrc === "all" || lsrc === "curated") &&
        rows.map((f) => (
          <PosterRail
            key={f.slug}
            title={franchiseName(f, loc)}
            icon="sparkle-star"
            /* اسم العالم بابه: ضغطة «مارفل» تعرض عالمه وحده (فلتر fr) */
            href={`/news?tab=lists&fr=${f.slug}`}
          >
            {/* 🆕 **البطاقةُ بابُ الصفحة وحدَها — وسقطت المعاينةُ** (D-334،
                طلبُ أحمد على لقطة الورقة: «وهذي المنبثقة إلغيها»).
                يومَ وُلدت الورقةُ كانت المنسّقةُ بلا صفحةٍ أصلاً، **وصار
                لكلِّ مجموعةٍ صفحةٌ حقيقية منذ D-330** — فبابان لمحتوًى
                واحدٍ عطلٌ (D-068)، **والورقةُ تعطي أقلَّ ممّا تعطيه
                الصفحة** (لا تقييمَ ولا مشاركةَ ولا تبويبات D-333).
                ⚠️ **ومجموعةٌ لم تُولَّد بعدُ لا تُرسم**: بطاقةٌ لا تفتح
                شيئاً أسوأ من غيابها (D-181) — ونداءُ `‎/api/curated`
                واحدٌ يُظهرها. */}
            {f.sets
              .filter((u) => curated.get(u.slug))
              .map((u) => (
                /* wide لا الافتراضي: بطاقة القائمة أعرض من بطاقة الملصق،
                   وخانةٌ ضيّقة كانت تجعل البطاقات تتراكب (لقطة المالك) */
                <RailItem key={u.slug} wide>
                  <Link href={`/lists/${curated.get(u.slug)}`} className="block">
                    <CuratedCard
                      u={u}
                      locale={locale}
                      t={t}
                      savedNames={savedNames}
                      stats={curatedStats.get(curated.get(u.slug) ?? "") ?? null}
                      className="w-full"
                    />
                  </Link>
                </RailItem>
            ))}
          </PosterRail>
        ))}

      {(lsrc === "all" || lsrc === "community") && !fr && community.length > 0 && (
        <PublicListsRail lists={community} locale={locale} />
      )}
    </div>
  );
}

/**
 * بطاقة قائمةٍ منسّقة — هندسة `CommunityListCard` نفسها مع فارقين:
 * لا رابط (القائمة تولد عند الضغط لا قبله — محرّك D-052/D-074)، والسطر
 * الثاني وعدُ الترتيب: «بترتيب الأحداث» للعوالم وحدها (storyOrder).
 * الملصقات الأربعة من `moviesByIds` — أربعة طلباتٍ مخبّأة ساعةً لكل
 * مجموعة، داخل Suspense فلا ترهن الرأس.
 */
/**
 * 🆕 **صفوفُك الخاصة** (D-337، طلبُ أحمد: «genre إجباريّ وثيم اختياريّ،
 * فيطلع عنوان مثل Drama zombies — نفّذها»).
 *
 * **بمفردات البيت كلِّها ولا جديدَ فيها**: النوعُ من `BROWSE_GENRES`
 * بمعرّفاتِ جهةِ التبويب، والموضوعُ يُحلّ بـ`keywordId` عند الطلب لا
 * برقمٍ مخمَّن (D-144)، والجلبُ `topByFilter` نفسُه، والحارسُ `railGuard`
 * (D-321)، والحالةُ `getLibState` (D-322). **والاسمُ يُركَّب بلغة القارئ
 * عند العرض** — «دراما · زومبي» / «Drama · Zombie» (D-147).
 *
 * ⚠️ **وتبويبُ الأنمي يبقى أنمي**: مفتاحُ الأنمي يُضاف شرطاً بـ«و»
 * (حجّةُ `DiscoverFilter.keywords` حرفاً)، **ونوعٌ لا معرّفَ له في جهةٍ
 * يسقط صفُّه فيها صامتاً** — لا صفَّ فارغاً تحت عنوانٍ يَعِد (D-181).
 */
async function MyRowsRails({
  rows,
  tab,
  locale,
}: {
  rows: MyRow[];
  tab: string;
  locale: Locale;
}) {
  const media = tab === "movies" ? ("movie" as const) : ("tv" as const);
  const lang = locale === "en" ? ("en" as const) : ("ar" as const);
  const anime = tab === "anime";
  const lib = { locale, state: await getLibState() };

  const built = await Promise.all(
    rows.map(async (r) => {
      const g = BROWSE_GENRES.find((x) => x.slug === r.genre);
      const ids = g ? (media === "movie" ? g.movie : g.tv) : [];
      if (!g || !ids.length) return null;
      const tagDef = r.tag ? BROWSE_TAGS.find((x) => x.slug === r.tag) : null;
      const tagId = tagDef ? await keywordId(tagDef.q).catch(() => null) : null;
      const keywords = [
        ...(anime ? [ANIME_KEYWORD] : []),
        ...(tagId ? [tagId] : []),
      ];
      const items = await topByFilter(
        media,
        { genreIds: ids, ...(keywords.length ? { keywords } : {}) },
        18,
        "popularity.desc",
      ).catch(() => []);
      /* الأنمي «فقط» في تبويبه و«يسقط» خارجه — نصُّ D-321 */
      /* 🆕 **وتقييمُ IMDb على الملصق** (D-338، طلبُ أحمد) — `withImdbRatings`
         نفسُها التي تخدم «الأكثر شهرةً»، مخبّأةً في مخزن OMDb المتدرّج */
      const guarded = railGuard(items, { anime: anime ? "only" : "drop" }).slice(0, 12);
      const rows2 = await withImdbRatings(guarded).catch(() => guarded);
      if (rows2.length < 4) return null;
      const title =
        browseGenreName(g, lang) + (tagDef ? ` · ${browseTagName(tagDef, lang)}` : "");
      return { key: r.genre + (r.tag ?? ""), title, items: rows2 };
    }),
  );

  const live = built.filter(Boolean) as { key: string; title: string; items: SearchResult[] }[];
  if (!live.length) return null;
  return (
    <div className="space-y-6">
      {live.map((b) => (
        <RankedRail key={b.key} title={b.title} icon="sparkle-star" items={b.items} ranked={false} lib={lib} />
      ))}
    </div>
  );
}

async function CuratedCard({
  u,
  locale,
  t,
  savedNames,
  stats,
  className = "w-full",
}: {
  u: Universe;
  locale: Locale;
  t: T;
  /** أسماءُ قوائمي — تُقرأ مرّةً في الصفحة لا لكل بطاقة (D-206) */
  savedNames?: Set<string>;
  /** 🆕 أرقامُ قائمة لوبز المولَّدة (D-335) — غيابُها يعني قائمةً بلا
      رقمٍ بعد، **والصفرُ لا يُطبع** (D-219) */
  stats?: { saves: number; rating: number | null } | null;
  className?: string;
}) {
  const loc = locale === "en" ? ("en" as const) : ("ar" as const);
  /* **الاسمان معاً** (D-206): الحفظُ يسمّي القائمةَ بلغة الواجهة وقتَها
     (D-130)، فمن حفظ بالعربية ثم قرأ بالإنجليزية يجب أن يرى علامتَه. */
  const names = [universeName(u, "ar"), universeName(u, "en")];
  const saved = names.some((n) => savedNames?.has(n.trim()));
  /* مجموعات TOP 250: العدد ثابتٌ معلوم والملصقات من صفحة top_rated
     الأولى وحدها — جلبُ ٢٥٠ عملاً لبطاقةٍ تعرض أربعة ملصقات إسراف.
     وسائر المجموعات كما كانت: تُحلّ معرّفاتها ثم أربعة ملصقات */
  const award = u.award ? awardBySlug(u.award) : null;
  /* بطاقة الجائزة: العدّ من القاموس بلا شبكة، والملصقات من أحدث أربعة
     فائزين وحدهم — تثبيت الخمسة والثلاثين يقع عند الفتح لا هنا */
  const awardFour = u.award ? await awardWinners(u.award, 4).catch(() => []) : null;
  const topRows = u.top ? await topRatedRows(u.top, 8).catch(() => []) : null;
  const ids = topRows || awardFour ? [] : await resolveSetIds(u).catch(() => [] as number[]);
  const four = awardFour ?? (topRows ? topRows.slice(0, 4) : await moviesByIds(ids.slice(0, 4)).catch(() => []));
  const count = award ? awardWins(award).length : topRows ? (u.topLimit ?? 250) : ids.length;
  const posters = four
    .map((m) => posterUrl(m.poster_path, "w185"))
    .filter(Boolean) as string[];

  /* **وصورةٌ واحدة للسلسلة؟ جُرّبت وسقطت — ويُقال بدل أن يُمحى** (D-206).
     كان الشرطُ `!award && !u.top` يعطي «عالم مارفل» و«حرب النجوم» غلافاً
     أفقياً واحداً. **وقرارُ أحمد بعد أن رآه: «الصورة الوحدة طلعت سيئة،
     خلّها كلها ٣ بوسترات».**

     **والسببُ الذي جعلها سيئةً مرئيٌّ في لقطته:** الغلافُ ١٦:٩ يُقصّ من
     ملصقٍ ٢:٣ **فيقع القصُّ على الوجه أو على الاسم** — «كابتن أمريكا»
     ظهر مقطوعَ العنوان، و«الرينغز ساغا» وجهاً مكبَّراً بلا سياق.
     **وملصقٌ صُمّم رأسياً لا يصير غلافاً بقصّه.** (والغلافُ الصحيح
     `backdrop_path` — وهو ما لا تحمله بطاقةُ المجموعة.)

     **فالإيقاعُ واحدٌ لكل البطاقات الآن**: ثلاثةُ ملصقاتٍ — وهو أيضاً ما
     يجعل صفَّ «القوائم» يُقرأ صفّاً واحداً لا صفَّين بإيقاعين. */

  return (
    <div className={`rounded-2xl border border-border bg-surface p-2.5 ${className}`}>
      <span className="flex items-center gap-1.5 text-[14px] font-bold">
        <Icon
          name={award ? "star" : "sparkle-star"}
          size={14}
          className="text-accent shrink-0"
        />
        <span className="min-w-0 flex-1 truncate">{universeName(u, loc)}</span>
        {/* **رمزُ الحفظ في الزاوية** (D-204): كان زرّاً بعرض البطاقة يقول
            «احفظها في قوائمي» — **فيُقرأ الفعلَ الأوّل وهو ليس كذلك**:
            الأوّلُ فتحُها. والرمزُ عُرفٌ يُقرأ بلا كلمة، ويترك مساحةَ
            الصورة للصورة. */}
        <AddWorksToList
          source="universe"
          id={u.slug}
          locale={locale}
          label={t.curatedSaveBtn}
          iconOnly
          names={names}
          saved={saved}
        />
      </span>

      {/* 🆕 **وجهُ لوبز والأرقامُ سطراً ثانياً بعرض البطاقة** (D-335→D-336،
          طلبُ أحمد على اللقطة: «السطر الثاني تحطه تحت وينكتب من بداية
          السطر بحيث الأيقونة تكون موازية للنجمة»): كان السطرُ محشوراً
          داخل عمود العنوان **فتَبدأ الدائرةُ بعد مسافةِ النجمة** — وصار
          صفّاً مستقلّاً يبدأ من بداية البطاقة، **فالدائرةُ تحت النجمة
          حرفاً**. الارتفاعُ كما هو: سطران قبلُ وسطران بعد.
          **والعدُّ يتنازل عند الضيق لا الأرقامُ** (D-219). */}
      <span className="mt-1 flex items-center gap-1 text-[12px] font-normal text-muted min-w-0">
        <Avatar
          src={LOOPZ_PERSON.avatar_url}
          name={LOOPZ_PERSON.nickname}
          size={14}
          className="shrink-0"
        />
        <span className="shrink-0">{LOOPZ_PERSON.nickname}</span>
        {(stats?.rating ?? null) !== null && (
          <span
            className="flex items-center gap-0.5 shrink-0 font-bold text-foreground tabular-nums"
            dir="ltr"
          >
            <Icon name="star" size={11} className="text-accent" />
            {num(stats!.rating as number, locale)}
          </span>
        )}
        {(stats?.saves ?? 0) > 0 && (
          <span className="flex items-center gap-0.5 shrink-0 tabular-nums" dir="ltr">
            <Icon name="heart-filled" size={11} className="fill-current" />
            {num(stats!.saves, locale)}
          </span>
        )}
        <span aria-hidden>·</span>
        <span className="truncate">
          {t.listCount(count)}
          {award ? ` · ${awardBody(award, loc)}` : u.storyOrder ? ` · ${t.listsStoryOrder}` : ""}
        </span>
      </span>

      {posters.length === 0 ? (
        <span className="mt-2 grid place-items-center w-14 aspect-[2/3] rounded-lg border border-dashed border-border text-muted">
          <Icon name="list" size={16} />
        </span>
      ) : (
        <span className="mt-2 flex gap-1.5">
          {posters.slice(0, 3).map((url, i) => (
            <span
              key={i}
              className="relative w-[calc(33.333%-4px)] aspect-[2/3] rounded-lg overflow-hidden bg-surface-2 border border-[color:var(--background)]"
            >
              <Image src={url} alt="" fill sizes="80px" className="object-cover" />
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/**
 * صفوف اكتشف — مقصورةً على الفلتر إن وُجد.
 *
 * الطلبات تُبنى على قدر الفلتر: جهة «أفلام» لا تطلب المسلسلات أصلاً،
 * والتصنيف يحوّل كل صفٍّ إلى نظيره المُصفّى. وصفّ الأنمي وصفّ «مقترح لك»
 * يظهران في السكون وحده: الأول تصنيفٌ قائم بذاته لا يُقصّ بتصنيفٍ آخر،
 * والثاني بُني على ذوق المستخدم لا على اختياره اللحظي.
 *
 * ومصدرُ الصفوف يتبدّل بحسب عمق الفلتر — وهذا جوهر التصميم هنا:
 *  - **بلا لغةٍ ولا حقبةٍ ولا تقييم** يبقى المصدر `/trending` الأسبوعي: هو
 *    الأصدق تحريرياً، يعرف ما يشاهده الناس هذا الأسبوع لا ما جمع أعلى
 *    متوسّطٍ منذ ١٩٩٤.
 *  - **مع أيٍّ منها** ننتقل إلى `/discover`: القوائم الجاهزة لا تقبل هذه
 *    المعاملات أصلاً، وتصفيتُها عندنا تُخرج صفّاً من عملين لأن الرائج
 *    عشرون عملاً لا أكثر. نخسر جِدّة الترتيب ونكسب أن يصل من طلب «تركي
 *    ٢٠٢٠ فأعلى» إلى تركيٍّ ٢٠٢٠ فأعلى — وهو ما طلبه.
 */
/**
 * سلسلةُ الفلتر الحاليّة — تُحمل إلى صفحة القسم كي لا تُلغى تصفيةُ القارئ.
 *
 * **وتُبنى من `browseHref` لا بيدنا** (D-174: بانٍ واحد للرابط): محورٌ
 * جديد غداً يصل من نفسه، **ولو عُدّدت المحاور هنا لصار موضعاً رابعاً
 * يُنسى تحديثُه**.
 */
function filterQs(b: BrowseQuery): string {
  const href = browseHref({
    g: b.genre?.slug ?? null,
    lang: b.lang?.code ?? null,
    co: b.country?.code ?? null,
    p: b.provider,
    era: b.era?.slug ?? null,
    rate: b.rate,
    tag: b.tag?.slug ?? null,
    award: b.award,
    st: b.status?.slug ?? null,
    se: b.season?.slug ?? null,
    std: b.studio?.slug ?? null,
  });
  const i = href.indexOf("?");
  return i === -1 ? "" : href.slice(i + 1);
}

/**
 * **هل يطابق هذا الصفُّ الفلتر — بحقول الصفّ وحدها، بلا نداء؟** (D-197،
 * قرارُ أحمد: «يطيعان الفلتر، وإن فرغا يُخفيان».)
 *
 * **ولماذا محلّياً لا بـ`/discover`:** الصفّان الشخصيّان لا يُبنيان من
 * استعلام — بِركةُ «مقترح لك» ثلاثمئة عملٍ مشتقّةٍ من مكتبتك، و«من
 * فنّانيك» أعمالُ من تتابعه. **فلا استعلامَ نُمرّر إليه المحاور**، والحكمُ
 * يقع على الصفوف التي بين يديك.
 *
 * **وثلاثةُ محاورٍ لا يستطيعها الصفُّ ولا نتظاهر بها:** الموضوع (كلمةٌ
 * مفتاحية لا تأتي في نتائج القوائم) والجائزة والاستوديو والموسم والحالة.
 * **فمتى اختير أحدها غاب الصفّان كما كانا يغيبان** — وعرضُ صفٍّ «مُصفّى
 * بالموضوع» وهو غيرُ مصفّى **كذبٌ أسوأ من الغياب** (D-141).
 */
function localAxesOnly(b: BrowseQuery): boolean {
  return !b.tag && !b.award && !b.status && !b.season && !b.studio;
}

function matchesBrowse(r: SearchResult, b: BrowseQuery, ids?: number[]): boolean {
  if (b.genre && ids?.length && !(r.genre_ids ?? []).some((g) => ids.includes(g))) return false;
  if (b.lang && r.original_language !== b.lang.code) return false;
  if (b.country && !(r.origin_country ?? []).includes(b.country.code)) return false;
  if (b.rate && (r.vote_average ?? 0) < b.rate) return false;
  const d = r.release_date || r.first_air_date || "";
  const era = eraRange(b.era);
  if (era.from && (!d || d < era.from)) return false;
  if (era.to && (!d || d > era.to)) return false;
  return true;
}

/* **حارسُ الرفوف انتقل إلى `topChart.ts`** (D-194): `looksAnime` كانت
   تسكن هنا، **ونظيرتُها للغة لم تكن موجودةً هنا إطلاقاً** — فكان الكوريّ
   والهنديّ يعبران كلَّ رفٍّ جاهزٍ في هذه الصفحة. صارا `railGuard` واحداً
   إلى جانب `RAIL_MUTED_LANGS` و`filterRail`: **ملفٌّ واحد يعرف ما يغادر
   رفّاً.** (والدرسُ درسُ D-175 نفسه، مرّةً ثانية.) */

async function CuratedRails({
  locale,
  t,
  browse,
  rails,
  region,
  myRows = [],
}: {
  locale: Locale;
  t: T;
  browse: BrowseQuery;
  /** نوافذ صفوف «أفضل ١٠» — أسبوع/شهر/سنة لكل صفٍّ (D-099) */
  rails: { m: RailWin; s: RailWin; a: RailWin; am: RailWin };
  /** بلد المشاهدة — يُقاس عليه فلتر المنصّات */
  region: string;
  /** 🆕 صفوفُك الخاصة (D-338) — تمرّ إلى `PersonalRails` */
  myRows?: MyRow[];
}) {
  const { type, genre, lang, country, provider, era, rate, tag, status, active } = browse;
  /* ===== فلتر الجائزة (طلب أحمد 9 Aug) =====
     اختيار جائزةٍ سؤالٌ مغلق لا تصفّح: «من فاز بالسعفة؟» — فالصفحة تصير
     صفّاً واحداً بالفائزين، الأحدث أولاً، بلا أرقام (الترتيب زمنيّ لا
     تفضيليّ). وبقية الصفوف تصمت: خلطُ الفائزين برائج الأسبوع يُفقد
     الجواب معناه. */
  if (browse.award) {
    const award = awardBySlug(browse.award);
    const rows = award ? await awardWinners(browse.award).catch(() => []) : [];
    return (
      <div className="space-y-6">
        {rows.length > 0 ? (
          <RankedRail
            title={award ? universeAwardTitle(award, locale) : ""}
            icon="star"
            items={rows}
            ranked={false}
            /* الوصف من البيانات لا من ثابتٍ مكتوب: القائمة تمتدّ فيتبعها */
            note={t.awardRailNote(
              String(rows.length),
              String(Math.min(...rows.map((r) => r.awarded))),
            )}
          />
        ) : (
          <p className="text-center text-muted py-20">{t.browseEmpty}</p>
        )}
      </div>
    );
  }

  const wantMovies = type !== "tv";
  const wantSeries = type !== "movie";

  /**
   * **ما يتابعه القارئ — قراءةٌ واحدة لكل الرفوف** (D-205).
   *
   * زرُّ «+» على كل ملصقٍ يحتاج أن يعرف حالتَه، **ولو سأل كلُّ ملصقٍ عن
   * نفسه لصارت رسمةُ اكتشف مئةَ استعلام**. و`getFollows` مغلَّفةٌ بـ`cache`
   * فالنداءُ واحدٌ للطلب كلِّه ولو استُدعي من ثلاثة رفوف.
   * **وسقوطُها لا يُسقط الزرّ**: مجموعةٌ فارغة تعني «لم يُضَف بعد»،
   * وأوّلُ لمسٍ يُصلح الحقيقة (`upsert` لا `insert`).
   */
  /* ⚖️ **`following` وحدَها لم تعد تكفي** (D-322): كانت تجيب سؤالاً
     واحداً («هل هو عندك؟») لأن الزرَّ لم يكن يسأل غيرَه — **والخيطُ يسأل
     أربعة**: عندك · انتهيتَ · أين أنت منه · أموقوفٌ هو. **فصار المصدرُ
     `getLibState` واحداً للأسئلة الأربعة** (D-145: أربعُ مجموعاتٍ تُمرَّر
     جنباً إلى جنبٍ هي كيف يفترق اثنان منها يوماً). */
  const lib = { locale, state: await getLibState() };
  /* **`needsDiscover` غادر هذه الصفحة إلى `sections.ts` (D-199):** هو
     السؤالُ «هل يتجاوز الفلترُ ما تقدر عليه قوائمُ TMDB الجاهزة؟»، وقد
     صار جوابُه داخلَ بناءِ القسم حيث يُستعمل — **لا هنا حيث كان يُحسب
     ثم يُمرَّر إلى فرعٍ يقرّر**. والدالّةُ باقيةٌ في `browse.ts` لأنها
     تُقرأ هناك، ولا مستدعيَ لها في هذا الملفّ بعد اليوم. */

  /* «القادم» نمطٌ لا مدى: ما لم يصدر لا أصوات له، فصفّا «أفضل ١٠»
     يكذبان أو يفرغان — يسقطان، ويحمل صفُّ العدّ التنازلي وحده النتيجة
     مرتّبةً بتاريخ الصدور وبلا عتبة تقييم (upcomingByFilter يفعل ذلك
     أصلاً). ونافذة الترتيب تفقد معناها في المستقبل فتُتجاهل بصمت. */
  const upcoming = era?.upcoming === true;
  /* مدى الحقبة محسوباً: «القادم» = اليوم حتى بعد ستة أشهر، يتحرّك مع اليوم */
  const eraR = eraRange(era);

  /* الوسمُ كلمةٌ إنجليزية تُحلّ إلى معرّفها عند الطلب لا رقمٌ مكتوب
     (انظر `BROWSE_TAGS`) — وما تعذّر حلُّه يسقط وحده بدل أن يُفرغ الصفحة */
  const tagId = tag ? await keywordId(tag.q) : null;

  /* الفلتر بلا تصنيف — لكل جهةٍ معرّفاتها فيُضاف عند الطلب */
  const base: DiscoverFilter = {
    lang: lang?.code ?? null,
    country: country?.code ?? null,
    provider,
    watchRegion: region,
    from: eraR.from,
    to: eraR.to,
    minRate: rate,
    keywords: tagId ? [tagId] : undefined,
    /* الحالةُ محورُ المسلسلات (D-196) — و`discoverParams` يُسقطها في
       الأفلام من نفسه، فلا شرطَ هنا ولا تعريفان للقاعدة */
    status: status?.code ?? null,
  };

  /* أعلى ١٠ حسب نافذة الصفّ (D-099): أسبوع = الرائج (أو discover
     المُصفّى)، شهر = آخر ثلاثين يوماً (لا الشهر التقويمي — أوّلُه
     بِركةٌ من أيامٍ معدودة)، سنة = هذه السنة التقويمية — كلاهما
     discover بالشعبية. و«كل الأوقات» القديمة يمثّلها ذيل Top 50. */
  const y = new Date().getUTCFullYear();
  const todayStr = new Date().toISOString().slice(0, 10);
  const back30 = new Date();
  back30.setUTCDate(back30.getUTCDate() - 30);
  const monthFrom = back30.toISOString().slice(0, 10);
  /**
   * **صار غلافاً على السجلّ (D-199)** — ثلاثةُ فروعٍ للنوافذ كانت مكتوبةً
   * هنا **وثلاثةٌ مثلها في `sections.ts`**. والمدى وحده يُحسب هنا لأنه
   * تاريخٌ يخصّ هذه الصفحة، **والقرارُ الذي يليه ملكُ السجلّ**.
   *
   * **ولماذا يهمّ العميل:** رقائقُ «أسبوع/شهر/سنة» تعِد بأنّ الضغط على
   * العنوان يفتح **نفسَ النافذة** موسَّعةً — فلو اختلف الفرعُ بين الملفّين
   * لرأى شهراً في الصفحة وأسبوعاً في الصفّ، **وهو لا يعرف أنه رأى شيئين**.
   */
  const winRangeOf = (w: RailWin) =>
    w === "year"
      ? { from: `${y}-01-01`, to: `${y}-12-31` }
      : w === "month"
        ? { from: monthFrom, to: todayStr }
        : null;
  const topFor = (mt: "movie" | "tv", genreIds: number[] | undefined, w: RailWin) =>
    buildSection(
      "top-ten",
      { media: mt, base, genreIds, active, win: w, winRange: winRangeOf(w) },
      10,
    );

  /* **ولا صفَّ أنمي هنا بعد اليوم (D-169):** صار له تبويبه بستّة صفوف،
     فبقاؤه هنا يعني الصفَّ نفسه في بابين — ونسخةٌ ثانية من معنًى واحد
     هي بالضبط ما تمنعه D-145. وتبويب المسلسلات يوفّر معها نداءَين. */
  /* **«خلّها تظهر إذا شخص حدّد جنسيتهم فقط» — طلب أحمد بنصّه** (D-194).
     فالكتمُ يسقط لحظةَ يختار لغةً أو بلداً، ويعود إن أزالهما. **والنوعُ
     والحقبةُ لا يفكّانه**: من طلب «جريمة ٢٠٢٠» لم يطلب دراما كورية. */
  const unmute = !!browse.lang || !!browse.country;
  /** يُحمل إلى صفحات الأقسام مع عناوينها (D-198) */
  const qs = filterQs(browse);

  const [
    topMovies,
    topSeries,
    popular,
    cinemas,
    soonMovies,
    soonSeries,
    top50Movies,
    top50Series,
  ] = await Promise.all([
      /* الصفوف المرتّبة كلّها تُعاد بترتيب IMDb وتحمل تقييمه (قرار أحمد:
         «الترتيب بأعلى تقييم حسب IMDb والتقييم فقط من IMDb») — TMDB يبقى
         مصدر التجميع (من يدخل الصفّ)، وIMDb مصدر الترتيب والرقم */
      /* **والأنمي يغادر رفَّي «أفضل ١٠» كليهما — بحارسٍ واحد (D-170 ثم
         D-175، طلب أحمد):** «الأنمي يغادر تبويب الأفلام والمسلسلات
         كليهما». كان رفُّ الأفلام يُصفّى هنا ورفُّ المسلسلات يُصفّى
         **داخل `topTenThisWeek`** — أي **في مسارٍ واحدٍ من ثلاثة**، فيعود
         الأنمي بمجرّد اختيار نوعٍ أو نافذةِ شهر. `topFor` هو الفم الذي
         تصبّ فيه المسارات الثلاثة، فالحارسُ عليه لا داخل أحدها.
         و`looksAnime` تشترط **اللغة اليابانية** مع نوع الرسوم — فيبقى
         «ريك آند مورتي» كما طلب أحمد. */
      wantMovies && !upcoming
        ? topFor("movie", genre?.movie, rails.m)
            .then((rows) => railGuard(rows, { unmute }))
            .then(withImdbRatings)
            .catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      wantSeries && !upcoming
        ? topFor("tv", genre?.tv, rails.s)
            .then((rows) => railGuard(rows, { unmute }))
            .then(withImdbRatings)
            .catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      /* **«الأكثر شعبية» — صفٌّ جديد (D-195، مواصفةُ أحمد).**

         **ولماذا ليس تكراراً لـ«أفضل ١٠ هذا الأسبوع»:** ذاك `/trending`
         — **حركةُ الأسبوع**، تتغيّر كل يوم وتُرتَّب عندنا بتقييم IMDb.
         وهذا `/popular` — **مخزونُ شعبيةٍ تراكميّ** يتغيّر ببطء ويحتفظ
         بترتيب TMDB نفسه. **الأوّل يسأل «ما الجديد؟» والثاني «ما الذي
         يعرفه الناس؟»**، فالجواران يفيدان.

         **والفلترُ يطاع هنا كما في أخيه** (مواصفة أحمد: الفلتر عامٌّ داخل
         التبويب): مع الفلتر يصير المصدر `/discover` بـ`popularity.desc`
         — نفس المعنى بمصدرٍ يقبل المحاور. **ولا ترتيبَ بتقييم IMDb:**
         الصفُّ عنوانُه الشعبية، وترتيبُه بالجودة كان سيكذّب اسمه.

         ⚠️ **والحارسُ عليه كسائر الرفوف** (D-194) — وإلا صار البابَ
         الجديد الذي يعود منه ما أُخرج من الأبواب الأخرى. */
      /* **ومنها إلى `buildSection` لا استعلامٌ هنا (D-198):** الصفُّ
         والصفحةُ الكاملة يناديان **نفسَ الدالّة** بحدَّين مختلفين — فلا
         مصدرٌ ثانٍ لقسمٍ واحد، وهو العطلُ الذي كلّفنا D-135/D-164/D-183. */
      buildSection(
        "most-popular",
        {
          media: wantMovies ? "movie" : "tv",
          base,
          genreIds: wantMovies ? genre?.movie : genre?.tv,
          active,
          /* **قرعةٌ للصفّ لا للصفحة** (D-202، طلب أحمد: «عشوائية مثل بيكد
             فور يو»): الصفُّ عشرون من بِركةٍ أوسع، فلا يتجمّد على نفس
             الوجوه. **والصفحةُ الكاملة لا تُقرع** — من فتحها يريد الجردَ
             مرتَّباً، وقرعةٌ فيها تجعل التمرير يكرّر ويُسقط. */
          sample: true,
          /* لغةُ القارئ لمصدر الكلاسيكيّات — يترجم صفوفَ القائمة (D-147) */
          locale,
        },
        20,
      )
        /* 🔴 **`attachImdbRatings` لا `withImdbRatings` — وهذا عطلٌ قِيس على
           الإنتاج قبل أن يُصلَح:** الثانيةُ **تُعيد ترتيب الصفّ بتقييم
           IMDb تنازلياً**، فكانت تمحو ترتيبَ الشعبية **وتمحو القرعةَ
           نفسها**: عضويةُ الصفّ تتغيّر كل زيارة (فالقرعةُ تعمل) **وترتيبُه
           ثابتٌ أبداً** — شاوشانك ٩٫٣ ثم الأب الروحي ٩٫٢ ثم فارس الظلام
           ٩٫٠… فيُقرأ الصفُّ «أفضل تقييماً» تحت عنوانٍ يقول «الأكثر شعبية».

           **والدالّةُ الصحيحة موجودةٌ منذ D-132 ومكتوبٌ في رأسها هذا
           المعنى حرفياً:** «يُلحق التقييم **بلا إعادة ترتيب** — لصفٍّ
           ترتيبُه هو معناه». **فالعطلُ كان في اختيار الدالّة لا في
           غيابها.** */
        .then(attachImdbRatings),
      /* «في السينما» بتقييم IMDb كسائر الصفوف (طلب أحمد 9 Aug مساءً:
         «أعمال السينما تكون مقيَّمة من IMDb»). كان الصفّ الوحيد الذي
         يعرض ملصقاتٍ بلا رقم — والفيلم الذي تفكّر في حجز تذكرةٍ له هو
         **أحوج** ما يكون إلى تقييم، لا أقلّها. الترتيب يبقى ترتيب دور
         العرض: «ما يُعرض الآن» سؤالُ توقيتٍ لا سؤال جودة. */
      /* **والأنمي يغادر هذا الصفَّ أيضاً (طلب أحمد ١٢ أغسطس):** «الأنمي
         ما زال في الأفلام والمسلسلات، المفروض فقط في الأنمي». والتصفية
         هنا لا في `fitsCinema`: تلك تُطبَّق **حين يكون الفلتر مفعّلاً
         وحده** (انظر `inCinemas` أدناه)، فحارسٌ فيها يترك الصفَّ الافتراضيّ
         — وهو ما يراه أكثرُ الناس — بلا حراسة. */
      /* **ومنها إلى `buildSection` (D-199):** الصفوفُ من السجلّ، **والمنطقةُ
         وحدها تبقى هنا** — لأن اسمَ البلد يُطبع في سطرٍ تحت العنوان
         (D-150: من يقرأ سعراً يجب أن يعرف لأيّ سوق). فالسجلُّ يملك
         «ما يُعرض»، والصفحةُ تملك «أين». */
      wantMovies
        ? Promise.all([
            buildSection("in-cinemas", { media: "movie", base, genreIds: genre?.movie, active }, 20),
            nowPlayingMovies().catch(() => null),
          ])
            .then(async ([results, c]) =>
              results.length && c
                ? { region: c.region, results: await attachImdbRatings(results) }
                : null,
            )
            .catch(() => null)
        : Promise.resolve(null),
      /* «القادم» يفتح صفّ العدّ التنازلي في كل النوافذ — هو النتيجة كلّها
         هناك. **ومصدرُه صار السجلَّ (D-199):** كان يُبنى هنا بثلاثة فروع
         (فلتر · نوع · قائمةٌ جاهزة) **وفي `sections.ts` بثلاثةٍ مثلها** —
         ففرعٌ يتغيّر في أحدهما يجعل الصفحةَ تعرض غيرَ ما وعد الصفّ.
         **والعميلُ هو من يدفع ذلك الفرق**: يضغط «القادم قريباً» فيرى
         قائمةً أخرى، فيقرؤها عطلاً لا اختلافَ نطاق. */
      wantMovies
        ? buildSection("upcoming", { media: "movie", base, genreIds: genre?.movie, active }, 20)
        : Promise.resolve([] as SearchResult[]),
      wantSeries
        ? buildSection("upcoming", { media: "tv", base, genreIds: genre?.tv, active }, 20)
        : Promise.resolve([] as SearchResult[]),
      /* ذيول «أفضل ٥٠» — **من نفس بِركة «أفضل ٢٥٠» لا من بِركةٍ ثانية**
         (D-164، بلاغ أحمد ١١ أغسطس).

         كانت تُبنى من `/discover` مرتَّبةً بـ`vote_count.desc` — أي
         **الأكثر تصويتاً لا الأفضل**. فسقط «الأب الروحي ٢» و«اثنا عشر
         رجلاً غاضباً» و«الأخوة في السلاح» و«ذا واير» و«الأسرة» — كلُّها
         أعلى تقييماً وأقلُّ أصواتاً من كتلة الجماهير — **بينما قائمة
         الـ٢٥٠ تحملها كلَّها**، لأنها تُبنى في القاعدة بالصيغة البايزيّة
         من ملفّات IMDb (D-135).

         **وقائمتان لنفس السؤال تفترقان، وهذا نصّ قاعدة D-135 نفسها**:
         «مصدرٌ واحد لمكانين» — وقد كان هنا مكانٌ ثالث نُسي.

         **وتفريقُ الأنمي يأتي مجاناً:** الدالّة في القاعدة تصنّف
         `movie | anime | tv` بـ`is_anime` (رسومٌ متحرّكة بلغةٍ أصلية
         يابانية)، فصفُّ المسلسلات يخلو من الأنمي **بلا سطرِ ترشيحٍ
         واحد** — وهو طلب أحمد حرفياً، ويُبقي «ريك ومورتي» في مكانه لأنه
         ليس يابانياً.

         **وثمنُها أرخص لا أغلى:** ثلاثة صفوفٍ كانت تكلّف ٢٤٠ نداء OMDb
         (٨٠ لكلٍّ) فصارت **ثلاث قراءاتٍ من القاعدة**، والتقييم يصل مع
         الصفّ نفسه. */
      /* 🔴 **ورجعا إلى قائمة IMDb — للمرّة الثانية وبقرارٍ ثالث (D-189).**
         التاريخُ كلُّه يُقال لأن من يقرأ سطراً واحداً لا يفهم لماذا:
         D-164 نقلتهما من `/discover` إلى `imdb_chart` (فعادت الأسماء
         الساقطة) · **D-183 أرجعتهما إلى TMDB** لأن القائمة حملت ١٤ عملاً
         هندياً من ٥٠ · ثم قِيس رفُّ TMDB فحمل **١٠ أعمالٍ كورية** (D-188).
         فتبيّن أن **المشكلة لم تكن المصدر بل غيابَ الترشيح**.

         **وقرار أحمد الأخير حسمها بجملة: «TOP 50 وTOP 250 أبغاها مثل IMDb
         بالضبط»، ثم اختار «قائمة IMDb مع الفلترين»** — فصار المصدر قائمةَ
         IMDb وترتيبَها (وهو ما لا يُنازع فيه أحد)، **والتصفيةُ ثلاثيّة في
         `filterRail`**: وثائقيّ · أنمي · لغةٌ مكتومة.
         **والمكسبُ الذي يعود معها:** ترتيبُ IMDb الحقيقيّ لا ترتيبُ جمهور
         TMDB — فتعود Band of Brothers وThe Wire وThe Sopranos إلى مواضعها،
         **وتُملأ الخمسون من التالين لا تنقص** (هامش `DOC_MARGIN`). */
      !active && wantMovies
        ? topChartRail("movie", 50, locale).catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      !active && wantSeries
        ? topChartRail("tv", 50, locale).catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
    ]);

  const today = new Date().toISOString().slice(0, 10);

  /* «في السينما» لا يقبل من TMDB تصنيفاً ولا لغةً ولا تقييماً — يقبل
     المنطقة وحدها. فيُصفّى هنا على النتائج نفسها: أرخص من طلبٍ ثانٍ،
     والصفّ خمسة عشر عملاً لا أكثر. والحقبة تُطبَّق أيضاً وإن كانت تُفرغه
     غالباً — من اختار التسعينات لا ينتظر أن يجدها في دور العرض اليوم،
     وصفٌّ فارغ أصدق من صفٍّ يتجاهل ما اختاره. */
  const fitsCinema = (r: SearchResult) => {
    if (genre && !(r.genre_ids ?? []).some((id) => genre.movie.includes(id))) return false;
    if (lang && r.original_language !== lang.code) return false;
    if (country && !(r.origin_country ?? []).includes(country.code)) return false;
    if (rate && r.vote_average < rate) return false;
    if (era) {
      const d = dateOf(r);
      // المدى المحسوب لا الخام: «القادم» يُفرغ صفّ دور العرض بحقّ —
      // ما يُعرض اليوم ليس قادماً
      if (d && eraR.from && d < eraR.from) return false;
      if (d && eraR.to && d > eraR.to) return false;
    }
    return true;
  };

  /* «في السينما» يسقط كلّه عند اختيار منصّة: الصفّ عن دور العرض، والسؤال
     «ما المتاح على اشتراكي» نقيضه — وصفٌّ لا يمكن تصفيته بما اختير يكذب
     على الفلتر */
  /* **والوسمُ يُسقطه أيضاً:** كلماتُ TMDB المفتاحية لا تأتي في نتيجة
     `/now_playing`، فلا سبيل لتصفيته بها هنا — وصفٌّ لا يُصفّى بما اختير
     يكذب على الفلتر تماماً كصفّ المنصّة */
  const inCinemas = provider || tag
    ? null
    : cinemas && active
      ? { region: cinemas.region, results: cinemas.results.filter(fitsCinema) }
      : cinemas;

  // القادم فقط في صفّ العدّ التنازلي — ما صدر أمس ليس «قادماً»
  /* **والأنمي يغادر «القادم قريباً» كذلك** (نفس طلب ١٢ أغسطس): صفُّ
     العدّ التنازليّ كان آخرَ بابٍ يدخل منه إلى تبويبَي الأعمال، وهو
     أظهرُها لأنه يفتح كلَّ النوافذ. **وحارسٌ واحد على الفم المشترك**
     (`soon`) لا على المسارين قبله — نفسُ درسِ D-175: الترشيح في موضع
     النداء لا في أحد فروعه. */
  const soon: CountdownItem[] = railGuard([...soonMovies, ...soonSeries], { unmute })
    .filter((r) => r.media_type === "tv" || r.media_type === "movie")
    .filter((r) => dateOf(r) >= today)
    .sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
    .slice(0, 20)
    .map((r) => ({
      key: `${r.media_type}-${r.id}`,
      href: `/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`,
      title: titleOf(r),
      poster: posterUrl(r.poster_path, "w342"),
      date: dateOf(r),
      badge: r.media_type === "tv" ? t.typeSeries : t.typeMovie,
    }));

  const empty =
    topMovies.length === 0 &&
    topSeries.length === 0 &&
    soon.length === 0 &&
    top50Movies.length === 0 &&
    top50Series.length === 0 &&
    popular.length === 0 &&
    !inCinemas?.results.length;

  return (
    <div className="space-y-6">
      {/* ===== الصفّان الشخصيّان — Suspense مستقلّ (م٧/D-071) =====
          المقترحات وحدها ~٤٠ طلب TMDB في أول تحميل، وكانت داخل
          Promise.all الصفوف كلّها فيرهن أبطأُ طلبٍ رسمَ الصفحة بأكملها.
          فصلُهما يجعل «أفضل ١٠» ودور العرض تظهر فور جاهزيتها، ويلحق
          الشخصيّ حين يكتمل — والهيكل يحجز ارتفاعه (D-046) */}
      {/* **صار يظهر مع الفلتر أيضاً — بشرطين** (D-197، قرارُ أحمد
          «يطيعان الفلتر»): أن تكون المحاورُ المختارة ممّا يستطيعه الصفّ
          (`localAxesOnly`)، وأن يبقى فيه شيءٌ بعد التصفية (يُخفي نفسه). */}
      {(!active || localAxesOnly(browse)) && (
        <Suspense fallback={<RailSkeleton count={6} />}>
          {/* الجهة تُمرَّر: التبويب وعدٌ، والصفّ الذي لا يعرف تبويبه يخلفه */}
          <PersonalRails locale={locale} t={t} type={type} browse={active ? browse : undefined} myRows={myRows} tab={type === "tv" ? "shows" : "movies"} />
        </Suspense>
      )}

      {/* فواصل الأقسام المسمّاة (م١/D-103) أُزيلت — «ما عجبتني» (قرار
          أحمد 9 Aug): الصفوف تتوالى بلا عناوين قسمية كما كانت */}
      {inCinemas && inCinemas.results.length > 0 && (
        <RankedRail
          title={t.inCinemas}
          lib={lib}
          icon="film"
          items={inCinemas.results}
          href={sectionHref("in-cinemas", "movie", qs)}
          seeAllLabel={t.seeAll}
          /* اسم البلد من `region.ts` لا من خريطةٍ محلية: صفّ السينما
             صار يبدأ من بلد المستخدم، وخريطةٌ من أربعة بلدان كانت
             ستطبع «MA» لمن اختار المغرب */
          note={t.inCinemasRegion(regionName(inCinemas.region, locale === "en" ? "en" : "ar"))}
          ranked={false}
        />
      )}

      {/* «الأكثر شعبية» بعد دور العرض وقبل «أفضل ١٠» (ترتيبُ مواصفة
          أحمد): الشخصيُّ أوّلاً، ثم ما يُعرض اليوم، ثم الشعبيّ، ثم
          المرتَّب بالجودة، ثم القادم — من الآنِ إلى الغد. */}
      {popular.length > 0 && (
        <RankedRail
          title={wantMovies ? t.mostPopularMovies : t.mostPopularSeries}
          lib={lib}
          icon="trending"
          items={popular}
          href={sectionHref("most-popular", wantMovies ? "movie" : "tv", qs)}
          seeAllLabel={t.seeAll}
          /* غيرُ مرقَّم: الترتيبُ ترتيبُ TMDB للشعبية لا حكمٌ بالجودة،
             ورقمٌ أمام الملصق يُقرأ «الأفضل» فيكذب العنوان */
          ranked={false}
        />
      )}

      {/* رقائق النافذة (D-099): الصفّ لا يختفي في نافذةٍ فارغة —
          رسالةٌ مكانه وإلا ضاع طريق العودة لنافذةٍ فيها نتائج */}
      {(topMovies.length > 0 || rails.m !== "week") && (
        <RankedRail
          title={t.top10Movies}
          lib={lib}
          icon="film"
          items={topMovies}
          href={sectionHref("top-ten", "movie", `${qs}${qs ? "&" : ""}w=${rails.m}`)}
          control={<RailWindowChips param="wm" value={rails.m} locale={locale} />}
          emptyText={t.railWinEmpty}
        />
      )}
      {(topSeries.length > 0 || rails.s !== "week") && (
        <RankedRail
          title={t.top10Series}
          lib={lib}
          icon="tv"
          items={topSeries}
          href={sectionHref("top-ten", "tv", `${qs}${qs ? "&" : ""}w=${rails.s}`)}
          control={<RailWindowChips param="ws" value={rails.s} locale={locale} />}
          emptyText={t.railWinEmpty}
        />
      )}
      {soon.length > 0 && (
        <CountdownRail
          title={t.comingSoon}
          icon="calendar"
          items={soon}
          locale={locale}
          href={sectionHref("upcoming", wantMovies ? "movie" : "tv", qs)}
          seeAllLabel={t.seeAll}
        />
      )}

      {/* ذيل «أعلى ٢٥ على الإطلاق» — مرجعٌ ثابت في الحالة غير المُصفّاة */}
      {top50Movies.length > 0 && (
        <RankedRail
          title={t.top50Movies}
          icon="film"
          items={top50Movies}
          lib={lib}
        />
      )}
      {top50Series.length > 0 && (
        <RankedRail
          title={t.top50Series}
          icon="tv"
          items={top50Series}
          lib={lib}
        />
      )}

      {empty && (
        <p className="text-center text-muted py-20">
          {active ? t.browseEmpty : t.newsEmpty}
        </p>
      )}
    </div>
  );
}

/**
 * الصفّان الشخصيّان — «مقترح لك» و«من فنّانيك» (م٧/D-071).
 *
 * مكوّن خادمٍ مستقلٌّ خلف Suspense خاصّ: هذان أثقل ما في اكتشف (بِركة
 * الثلاثمئة D-064 + with_people) وأكثره خصوصيةً فأقلّه استفادةً من خبيئة
 * fetch المشتركة — ففُصلا عن المسار الحرج بدل أن يرهنا رسم الصفحة كلّها.
 */
/**
 * تبويب الأنمي — ستّة صفوف (D-169، طلب أحمد).
 *
 * **الجديد فيه ليس التبويب بل جهةُ الأفلام:** «أفضل ١٠ أنمي» و«أفضل ٥٠
 * أنمي» كانا موجودَين منذ D-099/D-164 لكنّهما **مسلسلاتٌ حصراً** — لا
 * لأنه قرار، بل لأن `is_anime` في `imdb_pool` يشترط `media_type='tv'`.
 * فـ«روح الربيع» و«اسمك» و«أكيرا» لم يكن لها صفٌّ في التطبيق كلّه.
 *
 * **وصفُّ الأفلام يُقال ضعفُه:** بِركته من `/discover` بكلمة الأنمي لا من
 * ملفّات IMDb (انظر `animeMovieRail`). أضعفُ لا مكسور، والحلُّ النهائيّ
 * دَينٌ مُعلَن.
 */
async function AnimeRails({
  locale,
  t,
  rails,
  browse,
  region,
  myRows = [],
}: {
  locale: Locale;
  t: T;
  rails: { m: RailWin; s: RailWin; a: RailWin; am: RailWin };
  /** فلترُ الأنمي الأربعة — النوع والحقبة والتقييم والمنصّة (طلب أحمد) */
  browse: BrowseQuery;
  region: string;
  myRows?: MyRow[];
}) {
  const { genre, lang, country, provider, era, rate, tag, season, studio, active } = browse;
  const y = new Date().getUTCFullYear();
  const todayStr = new Date().toISOString().slice(0, 10);
  const back30 = new Date();
  back30.setUTCDate(back30.getUTCDate() - 30);
  const monthFrom = back30.toISOString().slice(0, 10);
  const winRange = (w: RailWin) =>
    w === "week"
      ? undefined
      : { from: w === "month" ? monthFrom : `${y}-01-01`, to: todayStr };

  /* مفتاحُ الأنمي شرطٌ لا خيار، ووسمُ الموضوع يُضاف إليه بـ«و» — انظر
     تعليق `keywords` في `tmdb.ts`. والوسمُ الذي تعذّر حلُّه يسقط وحده */
  const tagId = tag ? await keywordId(tag.q) : null;
  const animeKeywords = [ANIME_KEYWORD, ...(tagId ? [tagId] : [])];

  const eraR = eraRange(era);
  /* نفسُ حالة المكتبة — ونداءاتُها مغلَّفةٌ بـ`cache` فلا نداءَ ثانٍ ولو
     استُدعيت من تبويبين (D-205) */
  const lib = { locale, state: await getLibState() };
  /* **معرّفُ الاستوديو يُسأل عنه TMDB ولا يُكتب** — نفسُ نمط الوسم أعلاه،
     ونفسُ سبب D-144. وما تعذّر حلُّه يسقط وحده بلا إفراغِ الصفحة. */
  const studioId = studio ? await companyId(studio.name) : null;
  /* **والموسمُ يعلو على الحقبة حين يُختاران معاً** (`seasonRange`): من
     اختار «خريف» يقصد ثلاثة أشهرٍ بعينها، والحقبةُ عشرُ سنين — فتضييقُ
     الأضيق هو المقصود. **وسنتُه آخرُ سنةٍ في الحقبة** (أحدثُ ما يطابق)
     أو السنةُ الحالية إن لم تُختر حقبة. */
  const seasonR = season
    ? seasonRange(season, eraR.to ? Number(eraR.to.slice(0, 4)) : y)
    : null;
  const qs = filterQs(browse);
  const base: DiscoverFilter = {
    /* **اللغةُ والجنسيةُ صارتا هنا أيضاً (D-196)** — ومحورٌ يُعرض في
       الورقة ولا يصل إلى الاستعلام **كذبٌ في الواجهة**: المستخدم يختار
       «صينيّ» فيرى نفسَ الصفوف ويظنّ أن الفلتر معطوب. **فالعرضُ والطاعةُ
       يُشحنان معاً أو لا يُشحن أحدهما.** */
    lang: lang?.code ?? null,
    country: country?.code ?? null,
    provider,
    watchRegion: region,
    from: seasonR?.from ?? eraR.from,
    to: seasonR?.to ?? eraR.to,
    minRate: rate,
    keywords: animeKeywords,
    companies: studioId ? [studioId] : undefined,
  };

  /* الصفّان اللذان **يستطيعان** الطاعة: مسارهما `/discover` أصلاً، فيكفي
     أن تُمرَّر إليه المحاور. والنافذة تظلّ فوق الحقبة كما في تبويبَي
     الأعمال: من اختار «هذه السنة» يقصد السنة لا الحقبة المحفوظة */
  const animeTop = (mt: "movie" | "tv", genreIds: number[] | undefined, w: RailWin) => {
    if (!active) {
      const r = winRange(w);
      return mt === "movie"
        ? topTenAnimeMoviesThisWeek(10, r)
        : topTenAnimeThisWeek(10, r);
    }
    const win =
      w === "year"
        ? { from: `${y}-01-01`, to: `${y}-12-31` }
        : w === "month"
          ? { from: monthFrom, to: todayStr }
          : null;
    return topByFilter(
      mt,
      { ...base, ...(win ?? {}), genreIds },
      10,
      w === "week" ? "vote_average.desc" : "popularity.desc",
    );
  };

  const [topMovies, topSeries, popular, airing, soon, cinemas, top50Movies, top50Series] =
    await Promise.all([
    animeTop("movie", genre?.movie, rails.am)
      /* **ورفوفُ الأنمي تُصفّى بـ`anime:"only"`** (D-194): بِركتُها من
         `with_keywords` عند TMDB، **وكلمةُ «أنمي» يحملها عملٌ غيرُ يابانيّ
         أحياناً** — فالحارسُ يجعل الرفَّ يطابق عنوانه. ولا كتمَ لغةٍ فيه. */
      .then((rows) => railGuard(rows, { anime: "only" }))
      .then(withImdbRatings)
      .catch(() => [] as SearchResult[]),
    animeTop("tv", genre?.tv, rails.a)
      .then((rows) => railGuard(rows, { anime: "only" }))
      .then(withImdbRatings)
      .catch(() => [] as SearchResult[]),
    /* **ثلاثةُ صفوفٍ جديدة في تبويب الأنمي (D-195، مواصفةُ أحمد):**
       «الأكثر شعبية» · «يُعرض الآن» · «أنميٌ قادم».

       **وكلُّها من `/discover` بمفتاح الأنمي** (`base`) لا من قوائم TMDB
       الجاهزة — **و`‎/tv/popular` لا يقبل مفتاحاً**، فتصفيتُه بالأنمي
       تعطي صفّاً من ثلاثة. فالفرق عن تبويبَي الأعمال مقصود: هناك المصدرُ
       قائمةٌ جاهزةٌ حين لا فلتر، **وهنا `/discover` دائماً** لأن «أنمي»
       نفسُه شرطٌ لا يقبله غيرُه.
       **وثمنُه أن ترتيب الشعبية عندنا لا عند TMDB** — وهو نفسُ الرقم
       (`popularity.desc`) بمصدرٍ يقبل الشرط. */
    /* **والجهتان معاً في صفٍّ واحد هنا، بخلاف «أفضل ١٠»** — تبويبُ
       «أنمي» نفسُه هو الوعد، وفيلمُ أنميٍ في صفّ أنميٍ ليس في غير بابه
       (قيدُ D-141 كان صفّاً يعِد بجهةٍ ويعرض غيرها). و`buildSection`
       تجمعهما وترتّبهما بالشعبية — **ونفسُها من تبني الصفحة الكاملة**. */
    /* بلا إعادة ترتيبٍ بالتقييم — انظر تعليقَ نظيره في تبويبَي الأعمال */
    buildSection("most-popular", { media: "anime", base, active, sample: true }, 20).then(
      attachImdbRatings,
    ),
    /* **«يُعرض الآن» = أنميُ الموسم الحاليّ — لا `‎/tv/on_the_air`.**

       ⚠️ **وقد جُرّبت تلك الطريقُ أوّلاً وسقطت، ويُقال بدل أن يُمحى:**
       `‎/tv/on_the_air` قائمةٌ عالميّة من عشرين مسلسلاً **لا تقبل مفتاحاً
       ولا نوعاً**، فتصفيتُها بالأنمي أعادت **صفراً** — رفٌّ اختفى بلا
       سبب مرئيّ. (مُقاسٌ على الإنتاج، لا مفترض.)

       **والمصدرُ الصحيح `/discover` بمفتاح الأنمي ومدى الموسم**: الأنمي
       يُبثّ **بمواسمَ ربعيّة** (يناير · أبريل · يوليو · أكتوبر) — وهي
       الوحدةُ التي يتكلّم بها متابعُه فعلاً. **فـ«يُعرض الآن» = ما بدأ
       بثُّه في هذا الربع**، وهو أدقُّ ممّا يعطيه `on_the_air` أصلاً.
       **وهذا نفسُه أساسُ محور «Season» في الفلتر** حين يُبنى.

       **ويطيع الفلتر كاملاً** (مواصفة أحمد: الفلتر عامٌّ داخل التبويب) —
       فلا يغيب حين يُفعَّل، بخلاف صفّ السينما الذي لا يقبل محاوره. */
    buildSection(
      "airing-now",
      { media: "anime", base, genreIds: genre?.tv, active },
      20,
    ).then(withImdbRatings),
    /* «أنميٌ قادم» — `upcomingByFilter` يقبل المفتاح فيطيع الفلتر كاملاً */
    upcomingByFilter("tv", { ...base, genreIds: genre?.tv })
      .then((rows) => railGuard(rows, { anime: "only" }))
      .catch(() => [] as SearchResult[]),
    /* «في السينما» يعود بالمنطقة كاملةً ثم يُصفّى هنا: TMDB لا يقبل
       تصنيفاً ولا لغةً على `/now_playing`، والصفّ عشرون عملاً لا أكثر —
       فالتصفية على النتائج أرخص من طلبٍ ثانٍ (نفس منطق `fitsCinema`).
       **ولا يُطلب أصلاً وقتَ الفلتر:** لا يقبل شيئاً ممّا اختير */
    active
      ? Promise.resolve(null)
      : nowPlayingMovies()
          .then(async (c) => {
            if (!c) return null;
            /* `railGuard` بـ`anime:"only"` لا `filter(looksAnime)` —
               **بابٌ واحد لكل تصفيةِ رفّ** حتى لا يتفرّق التعريف (D-194) */
            const only = railGuard(c.results, { anime: "only" });
            return only.length
              ? { region: c.region, results: await attachImdbRatings(only) }
              : null;
          })
          .catch(() => null),
    /* ذيلا «أفضل ٥٠» من `imdb_chart` لا من `/discover` — لا نوعَ فيهما
       ولا حقبةَ ولا منصّة. فيغيبان ما دام الفلتر مفعّلاً (اختيار أحمد)
       بدل أن يعرضا ما لم يُطلب تحت رأسٍ يقول إن الفلتر مُطبَّق */
    /* **رفُّ أفلام الأنمي: القائمةُ الحقيقية أوّلاً، وذيلُ D-132 احتياطاً.**
       صنفُ `anime` صار يحمل أفلاماً ومسلسلاتٍ معاً بعد الهجرة ٦٠، فالرفّ
       يقرأ منه جهةَ الأفلام. **وإن عاد فارغاً فالبِركةُ لم تُملأ بعد** —
       فيرجع إلى بِركة `/discover` كما كان، بلا رفٍّ فارغٍ في الطريق
       (D-169: «أضعفُ لا مكسور» — واليوم صار «صحيحٌ متى أمكن»). */
    active
      ? Promise.resolve([] as SearchResult[])
      : topChartRail("anime", 50, locale, "movie")
          .then((r) => (r.length > 0 ? r : animeMovieRail(50, locale)))
          .catch(() => [] as SearchResult[]),
    /* ورفُّ المسلسلات صار يطلب جهته صراحةً: كان صنفُ الأنمي مسلسلاتٍ
       حصراً فاستغنى عن ذلك، ولو بقي بلا جهةٍ بعد الهجرة لاختلط الرفّان. */
    active
      ? Promise.resolve([] as SearchResult[])
      : topChartRail("anime", 50, locale, "tv").catch(() => [] as SearchResult[]),
  ]);

  return (
    <div className="space-y-6">
      {/* الشخصيّ أوّلاً كما في تبويبَي الأعمال، وخلف Suspense خاصّته
          (D-071): بِركة المقترحات أبطأ طلبٍ في الصفحة، فلا تُرهن به
          الصفوف الخمسة الباقية. ويغيب مع الفلتر كما يغيب هناك */}
      {(!active || localAxesOnly(browse)) && (
        <Suspense fallback={<RailSkeleton count={6} />}>
          <PersonalRails
            locale={locale}
            t={t}
            type="movie"
            anime
            browse={active ? browse : undefined}
            myRows={myRows}
            tab="anime"
          />
        </Suspense>
      )}

      {cinemas && cinemas.results.length > 0 && (
        <RankedRail
          title={t.animeInCinemas}
          lib={lib}
          icon="film"
          items={cinemas.results}
          note={t.inCinemasRegion(regionName(cinemas.region, locale === "en" ? "en" : "ar"))}
          ranked={false}
        />
      )}

      {/* «يُعرض الآن» ثم «الأكثر شعبية» قبل رفوف «أفضل ١٠» — نفسُ ترتيب
          مواصفة أحمد في التبويبين الآخرين: الآنَ أوّلاً ثم الشعبيّ ثم
          المرتَّب بالجودة ثم القادم. */}
      {airing.length > 0 && (
        <RankedRail
          title={t.airingNowAnime}
          lib={lib}
          icon="tv"
          items={airing}
          ranked={false}
          href={sectionHref("airing-now", "anime", qs)}
          seeAllLabel={t.seeAll}
        />
      )}

      {popular.length > 0 && (
        <RankedRail
          title={t.mostPopularAnime}
          lib={lib}
          icon="trending"
          items={popular}
          ranked={false}
          href={sectionHref("most-popular", "anime", qs)}
          seeAllLabel={t.seeAll}
        />
      )}

      {(topMovies.length > 0 || rails.am !== "week") && (
        <RankedRail
          title={t.top10AnimeMovies}
          lib={lib}
          icon="film"
          items={topMovies}
          control={<RailWindowChips param="wam" value={rails.am} locale={locale} />}
          emptyText={t.railWinEmpty}
        />
      )}
      {(topSeries.length > 0 || rails.a !== "week") && (
        <RankedRail
          title={t.top10AnimeSeries}
          lib={lib}
          icon="sparkle-star"
          items={topSeries}
          control={<RailWindowChips param="wa" value={rails.a} locale={locale} />}
          emptyText={t.railWinEmpty}
        />
      )}

      {/* «أنميٌ قادم» — بعد المرتَّب بالجودة وقبل مراجع «أفضل ٥٠»:
          القادمُ آخرُ الحاضر، والخمسون مرجعٌ ثابتٌ لا حاضر. */}
      {soon.length > 0 && (
        <RankedRail
          title={t.upcomingAnime}
          lib={lib}
          icon="calendar"
          items={soon}
          ranked={false}
          href={sectionHref("upcoming", "anime", qs)}
          seeAllLabel={t.seeAll}
        />
      )}

      {top50Movies.length > 0 && (
        <RankedRail title={t.top50AnimeMovies} icon="film" items={top50Movies} />
      )}
      {top50Series.length > 0 && (
        <RankedRail title={t.top50AnimeSeries} icon="sparkle-star" items={top50Series} />
      )}

      {/* **صفحةٌ خالية تقول لماذا:** بعد أن صار للتبويب فلتر، صار ممكناً
          أن يُفرغه اختيارٌ ضيّق («غربي · التسعينات · ٩ فأعلى») — وشاشةٌ
          بيضاء بلا سطرٍ تُقرأ عطلاً لا نتيجة */}
      {active &&
        topMovies.length === 0 &&
        topSeries.length === 0 &&
        popular.length === 0 &&
        soon.length === 0 && (
        <p className="text-center text-muted py-20">{t.browseEmpty}</p>
      )}
    </div>
  );
}

async function PersonalRails({
  locale,
  t,
  type,
  anime = false,
  browse,
  myRows = [],
  tab = "",
}: {
  locale: Locale;
  t: T;
  /** جهة التبويب — أفلام أو مسلسلات (D-141) */
  type: BrowseQuery["type"];
  /** تبويب الأنمي (D-169): الفلترة بالأنمي لا بالجهة، وبلا صفّ فنّانين */
  anime?: boolean;
  /**
   * الفلترُ المفعَّل — **الصفّان يطيعانه بقدر ما تسمح حقولُ الصفّ** (D-197،
   * قرارُ أحمد). **واختياريّ لسببٍ تشغيليّ:** رفعةُ `components`/`app`
   * تُبنى كلٌّ وحدها، وغيابُه = «لا فلتر» — وهو السلوكُ القائم حرفاً بحرف.
   */
  browse?: BrowseQuery;
  /** 🆕 صفوفُك الخاصة (D-337→D-338، تصحيحُ أحمد: «تكون بعد picked for you») */
  myRows?: MyRow[];
  tab?: string;
}) {
  const wantMovies = type !== "tv";
  /* 🆕 **وحالةُ المكتبة تُقرأ هنا لا تُمرَّر** (D-322): نداءاتُها مغلَّفةٌ
     بـ`cache` **فهي مجّانيّةٌ بعد قراءة الصفحة**، وتمريرُها معاملاً عبر
     `Suspense` كان سيربط رسمَ هذا الصفّ برسمِ الصفحة فيُفقده استقلالَه. */
  const [pool, artistWorks, libState] = await Promise.all([
    getSuggestions(300, locale).catch(() => []),
    /* «من فنّانيك» أفلامٌ فقط — TMDB لا يدعم `with_people` في
       `/discover/tv`. فصفٌّ من الأفلام تحت تبويب «مسلسلات» هو الخطأ
       نفسه مقلوباً، والصمتُ أصدق من صفٍّ في غير بابه */
    /* ولا «من فنّانيك» في تبويب الأنمي: الصفّ أفلامٌ لممثّلين تتابعهم
       (D-062)، ووضعُه تحت عنوان أنمي وعدٌ يُخلَف (D-141) */
    /* **ومنه إلى السجلّ (D-199)** — فما يفتحه ضغطُ العنوان هو نفسُ ما
       يعرضه الصفّ. **وهذا القسمُ لا يُكتم** (انظر تعليقه في `sections.ts`). */
    wantMovies && !anime
      ? buildSection("from-artists", { media: "movie", base: {}, active: false }, 20)
      : Promise.resolve([] as SearchResult[]),
    getLibState(),
  ]);
  const lib = { locale, state: libState };

  /* قرعةُ خادمٍ عند كل طلب (D-073): البِركة مخبّأة ساعةً فكانت العشرة
     الأولى تتجمّد معها — فتح «اكتشف» مرتين يعرض الوجوه نفسها. الخلطُ هنا
     يجعل كل فتحٍ عيّنةً مختلفة، وزرّ التحديث يبقى للسحب داخل الزيارة */
  /* التبويب فلترٌ لا زينة (بلاغ أحمد ١٠ أغسطس: «بيكد فور يو فالافلام
     قاعد يقترح مسلسلات»). البِركة ثلاثمئة مختلطة، والصفّ يعرض عشراً —
     فالتصفية هنا لا تُفقره، والعشرُ الباقيات تحت العنوان الذي وعد بها. */
  /* **والجهةُ وحدها لا تكفي (طلب أحمد ١٢ أغسطس):** بِركةُ المقترحات
     تُبنى من أعمالك، ومن يتابع أنمي تأتيه مقترحاتُ أنميٍ — فكانت تظهر
     في تبويب المسلسلات نفسها. فالشرطُ صار شرطين: الجهة **وألّا يكون
     أنمي** — وله تبويبُه حيث يقترحه هذا الصفّ نفسه. */
  /* **والفلترُ يُطبَّق فوق شرط التبويب لا بدلاً منه** (D-197): من اختار
     «جريمة» في تبويب المسلسلات يريد مقترحاتِ مسلسلاتٍ جريمة — لا كلَّ ما
     هو جريمة. والمحاورُ التي لا يستطيعها الصفّ أسقطته أصلاً في الصفحة. */
  const ids = browse?.genre ? (wantMovies ? browse.genre.movie : browse.genre.tv) : undefined;
  const suggested = pool.filter(
    (s) =>
      (anime
        ? looksAnime(s.result)
        : (wantMovies ? s.result.media_type === "movie" : s.result.media_type === "tv") &&
          !looksAnime(s.result)) && (!browse || matchesBrowse(s.result, browse, ids)),
  );
  const artistRows = browse
    ? artistWorks.filter((r) => matchesBrowse(r, browse, browse.genre?.movie))
    : artistWorks;
  for (let i = suggested.length - 1; i > 0; i--) {
    // العشوائية مقصودة: قرعةٌ لكل طلبٍ في مكوّن خادمٍ لا-متزامن يُنفَّذ مرةً واحدة
    // eslint-disable-next-line react-hooks/purity -- ليست دالة عرضٍ تُعاد
    const j = Math.floor(Math.random() * (i + 1));
    [suggested[i], suggested[j]] = [suggested[j], suggested[i]];
  }

  /* **الفراغُ يُخفي ولا يُعلن** (قرارُ أحمد): صندوقٌ فارغٌ تحت عنوانٍ
     شخصيّ يُقرأ «لا أحد يعرفك» لا «لا نتيجةَ لهذا الفلتر». */
  const showMyRows = myRows.length > 0 && !browse;
  if (suggested.length === 0 && artistRows.length === 0 && !showMyRows) return null;

  return (
    <div className="space-y-6">
      {suggested.length > 0 && (
        /* السبب يُحسب هنا (يحتاج القاموس) والبطاقات تُسلسَل خفيفةً للعميل */
        <PickedForYou
          title={t.suggestedForYou}
          locale={locale}
          items={suggested.map((s) => ({
            tmdbId: s.result.id,
            mediaType: s.result.media_type === "movie" ? ("movie" as const) : ("tv" as const),
            title: titleOf(s.result),
            posterPath: s.result.poster_path,
            year: yearOf(s.result),
            /* 🆕 **الحالةُ تُحسب هنا وتُسلسَل مع البطاقة** (D-322): المكوّنُ
               عميلٌ فلا يقرأ القاعدة، **والقراءةُ واحدةٌ للصفّ كلِّه** */
            ...libState.of(s.result.id, s.result.media_type === "movie" ? "movie" : "tv"),
            note:
              s.source === "rated" && s.seedTitle
                ? t.recoBecauseRated(s.seedTitle)
                : s.source === "follows" && s.seedTitle
                  ? t.recoBecauseFollow(s.seedTitle)
                  : s.source === "recent" && s.seedTitle
                    ? t.recoBecauseWatched(s.seedTitle)
                    : t.recoBecauseGenre,
          }))}
        />
      )}

      {/* 🆕 **صفوفُك الخاصة بعد «مختار لك» مباشرةً** (D-338، تصحيحُ أحمد
          على D-337): كلاهما شخصيٌّ، **والمقترَحُ المحسوبُ لك يسبق
          المُعرَّفَ منك** — وتغيب مع فلترٍ مفعّل (D-075). */}
      {showMyRows && (
        <Suspense fallback={<RailSkeleton count={6} />}>
          <MyRowsRails rows={myRows} tab={tab} locale={locale} />
        </Suspense>
      )}

      {/* «من فنّانيك» بعد المقترحات مباشرة: كلاهما صفٌّ شخصيّ، والشخصيّ
          يسبق العامّ. غير مرقّم — هذه أحدث أعمال فنّانيك لا ترتيبها */}
      {artistRows.length > 0 && (
        <RankedRail
          title={t.artistsRail}
          icon="people"
          items={artistRows}
          ranked={false}
          lib={lib}
          href={sectionHref("from-artists", "movie")}
          seeAllLabel={t.seeAll}
        />
      )}
    </div>
  );
}
