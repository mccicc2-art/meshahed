import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollowedArtists,
  getPublicListsFeed,
  getFollowedPublicLists,
  searchPublicLists,
} from "@/lib/data";
import { PublicListsRail, CommunityListCard } from "@/components/PublicListsRail";
import { ListsSearchField } from "@/components/ListsSearchField";
import { ListsSourceChips, type ListsSource } from "@/components/ListsSourceChips";
import { AddWorksToList } from "@/components/AddWorksToList";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { allCuratedSets, universeName, type Universe } from "@/lib/universes";
import { Icon } from "@/components/Icon";
import Image from "next/image";
import {
  upcomingMovies,
  airingTv,
  topTenThisWeek,
  topTenAnimeThisWeek,
  topTenGenreThisWeek,
  upcomingByGenre,
  topByFilter,
  top50,
  worksByPeople,
  upcomingByFilter,
  nowPlayingMovies,
  listWatchProviders,
  moviesByIds,
  titleOf,
  yearOf,
  posterUrl,
  type SearchResult,
  type DiscoverFilter,
} from "@/lib/tmdb";
import { getT, getWatchRegion } from "@/lib/locale";
import { regionName } from "@/lib/region";
import { type Locale } from "@/lib/i18n";
import {
  parseBrowse,
  parseDiscoverTab,
  browseKey,
  browseCount,
  needsDiscover,
  eraRange,
  type BrowseQuery,
} from "@/lib/browse";
import { RankedRail } from "@/components/RankedRail";
import { CountdownRail, type CountdownItem } from "@/components/CountdownRail";
import { PickedForYou } from "@/components/PickedForYou";
import { RailSkeleton } from "@/components/Skeletons";
import { DiscoverFilters } from "@/components/DiscoverFilters";
import { getSuggestions } from "@/lib/suggest";

type T = Awaited<ReturnType<typeof getT>>["t"];

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
    g?: string;
    sort?: string;
    lang?: string;
    co?: string;
    p?: string;
    era?: string;
    rate?: string;
  }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const sp = await searchParams;
  const browse = parseBrowse(sp);
  const tab = parseDiscoverTab(sp.tab);
  /* نصّ البحث يُقصّ هنا أيضاً لا في `searchPublicLists` وحدها: القيمة
     تُرَدّ إلى حقل البحث كما هي، ورابطٌ بألف حرفٍ لا يرسم حقلاً بألف حرف */
  const listsQ = (sp.q ?? "").slice(0, 60);
  /* مصدر القوائم — كل قيمةٍ غير معروفة تسقط إلى «الكل» (عقيدة parseBrowse) */
  const listsSrc: ListsSource =
    sp.src === "curated" || sp.src === "friends" || sp.src === "community"
      ? sp.src
      : "all";

  /* قائمة المنصّات تُجلب على الخادم وتُمرَّر للورقة: طلبٌ واحد مخبَّأ ساعةً
     في طبقة fetch، ورأس الصفحة يبقى يرسم فوراً لأن الصفوف وحدها خلف
     Suspense. وفشلُ الجلب يُخفي المحور بدل أن يعرض خانةً فارغة.
     وتبويب «القوائم» لا يطلبها أصلاً — ورقة الفلاتر لا تُفتح فيه */
  const [providers, region] = await Promise.all([
    tab === "titles"
      ? listWatchProviders(browse.type === "tv" ? "tv" : "movie")
      : Promise.resolve([] as { id: number; name: string }[]),
    getWatchRegion(),
  ]);

  return (
    <div className="space-y-8">
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة */}
      <h1 className="sr-only">{t.newsTitle}</h1>

      <DiscoverFilters
        locale={locale}
        tab={tab}
        type={browse.type}
        win={browse.win}
        genre={browse.genre?.slug ?? null}
        lang={browse.lang?.code ?? null}
        country={browse.country?.code ?? null}
        provider={browse.provider}
        providers={providers}
        region={region}
        era={browse.era?.slug ?? null}
        rate={browse.rate}
        count={browseCount(browse)}
      />

      {tab === "lists" ? (
        /* ===== تبويب «القوائم» — ديسكفري قوائم كامل (D-075 ثم D-082) =====
            الحقل والرقائق خارج Suspense فيرسمان فوراً ويحفظ الحقل تركيزه؛
            والأقسام وحدها تتبدّل — مفتاحها البحث والمصدر معاً */
        <div className="space-y-4">
          <ListsSearchField locale={locale} initial={listsQ} />
          <ListsSourceChips locale={locale} src={listsSrc} />
          <Suspense
            key={`${listsQ}:${listsSrc}`}
            fallback={
              <div className="space-y-8" aria-hidden>
                <RailSkeleton count={6} />
                <RailSkeleton count={6} />
              </div>
            }
          >
            <ListsDiscovery locale={locale} t={t} q={listsQ} src={listsSrc} />
          </Suspense>
        </div>
      ) : (
        /* المفتاح يتغيّر بتغيّر الفلتر: React يُظهر الهيكل فوراً بدل أن
            يُبقي صفوف الفلتر السابق معلّقة حتى تصل الجديدة */
        <Suspense
          key={browseKey(browse)}
          fallback={
            <div className="space-y-8" aria-hidden>
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
            </div>
          }
        >
          <CuratedRails locale={locale} t={t} browse={browse} region={region} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * ديسكفري القوائم (D-082، طلب المالك): «يشبه الأفلام والمسلسلات».
 *
 * ثلاثة مصادر بصفوفٍ مسمّاة كصفوف تبويب الأعمال — المنسّقة (قوائمنا:
 * العوالم + ديزني)، فمن تتابعهم، فالمجتمع — والرقاقة تفرد مصدراً واحداً
 * شبكةً كاملة. البحث يبحث في قوائم المجتمع كلّها ويتجاهل المصدر: من يكتب
 * اسماً يريد النتيجة أينما كانت.
 */
async function ListsDiscovery({
  locale,
  t,
  q,
  src,
}: {
  locale: Locale;
  t: T;
  q: string;
  src: ListsSource;
}) {
  /* ===== البحث — فوق كل المصادر ===== */
  if (q.trim()) {
    const cards = await searchPublicLists(q, 40);
    if (cards.length === 0)
      return <p className="text-center text-muted py-20">{t.listsSearchEmpty}</p>;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((l) => (
          <CommunityListCard key={l.id} list={l} locale={locale} />
        ))}
      </div>
    );
  }

  /* ===== مصدرٌ مُفرَد — شبكة ===== */
  if (src === "curated") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {allCuratedSets().map((u) => (
          <CuratedCard key={u.slug} u={u} locale={locale} t={t} />
        ))}
      </div>
    );
  }
  if (src === "friends") {
    const cards = await getFollowedPublicLists(40);
    if (cards.length === 0)
      return <p className="text-center text-muted py-20">{t.listsFriendsEmpty}</p>;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((l) => (
          <CommunityListCard key={l.id} list={l} locale={locale} />
        ))}
      </div>
    );
  }
  if (src === "community") {
    const cards = await getPublicListsFeed(40).catch(() => []);
    if (cards.length === 0)
      return <p className="text-center text-muted py-20">{t.listsBrowseEmpty}</p>;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((l) => (
          <CommunityListCard key={l.id} list={l} locale={locale} />
        ))}
      </div>
    );
  }

  /* ===== «الكل» — صفوفٌ كصفوف الأعمال ===== */
  const [friends, community] = await Promise.all([
    getFollowedPublicLists(15),
    getPublicListsFeed(15).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <PosterRail title={t.listsCurated} icon="sparkle-star">
        {allCuratedSets().map((u) => (
          <RailItem key={u.slug}>
            <CuratedCard u={u} locale={locale} t={t} className="w-64" />
          </RailItem>
        ))}
      </PosterRail>

      {friends.length > 0 && (
        <PublicListsRail lists={friends} locale={locale} title={t.listsFriendsRail} />
      )}

      <PublicListsRail lists={community} locale={locale} />

      {friends.length === 0 && community.length === 0 && (
        <p className="text-center text-muted py-10">{t.listsBrowseEmpty}</p>
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
async function CuratedCard({
  u,
  locale,
  t,
  className = "w-full",
}: {
  u: Universe;
  locale: Locale;
  t: T;
  className?: string;
}) {
  const loc = locale === "en" ? ("en" as const) : ("ar" as const);
  const four = await moviesByIds(u.movieIds.slice(0, 4)).catch(() => []);
  const posters = four
    .map((m) => posterUrl(m.poster_path, "w185"))
    .filter(Boolean) as string[];

  return (
    <div className={`rounded-2xl border border-border bg-surface p-2.5 ${className}`}>
      <span className="flex items-center gap-1.5 text-[14px] font-bold truncate">
        <Icon name="sparkle-star" size={14} className="text-accent shrink-0" />
        <span className="truncate">{universeName(u, loc)}</span>
      </span>
      <span className="block text-[12px] text-muted truncate mt-0.5">
        {t.listCount(u.movieIds.length)}
        {u.storyOrder ? ` · ${t.listsStoryOrder}` : ""}
      </span>
      <span className="mt-2 flex gap-1.5">
        {posters.length > 0 ? (
          posters.map((url, i) => (
            <span
              key={i}
              className="relative w-[calc(25%-4.5px)] aspect-[2/3] rounded-lg overflow-hidden bg-surface-2 border border-[color:var(--background)]"
            >
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
            </span>
          ))
        ) : (
          <span className="grid place-items-center w-14 aspect-[2/3] rounded-lg border border-dashed border-border text-muted">
            <Icon name="list" size={16} />
          </span>
        )}
      </span>
      <AddWorksToList
        source="universe"
        id={u.slug}
        locale={locale}
        label={t.curatedSaveBtn}
        className="mt-2.5 w-full justify-center"
      />
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
async function CuratedRails({
  locale,
  t,
  browse,
  region,
}: {
  locale: Locale;
  t: T;
  browse: BrowseQuery;
  /** بلد المشاهدة — يُقاس عليه فلتر المنصّات */
  region: string;
}) {
  const { type, win, genre, lang, country, provider, era, rate, active } = browse;
  const wantMovies = type !== "tv";
  const wantSeries = type !== "movie";
  const deep = needsDiscover(browse);
  const isWeek = win === "week";

  /* «القادم» نمطٌ لا مدى: ما لم يصدر لا أصوات له، فصفّا «أفضل ١٠»
     يكذبان أو يفرغان — يسقطان، ويحمل صفُّ العدّ التنازلي وحده النتيجة
     مرتّبةً بتاريخ الصدور وبلا عتبة تقييم (upcomingByFilter يفعل ذلك
     أصلاً). ونافذة الترتيب تفقد معناها في المستقبل فتُتجاهل بصمت. */
  const upcoming = era?.upcoming === true;
  /* مدى الحقبة محسوباً: «القادم» = اليوم حتى بعد ستة أشهر، يتحرّك مع اليوم */
  const eraR = eraRange(era);

  /* الفلتر بلا تصنيف — لكل جهةٍ معرّفاتها فيُضاف عند الطلب */
  const base: DiscoverFilter = {
    lang: lang?.code ?? null,
    country: country?.code ?? null,
    provider,
    watchRegion: region,
    from: eraR.from,
    to: eraR.to,
    minRate: rate,
  };

  /* أعلى ١٠ حسب النافذة: أسبوعي = الرائج (أو discover المُصفّى)، سنوي =
     discover لهذه السنة مرتّباً بالشعبية، كل الأوقات = الأكثر أصواتاً.
     السنة تفرض مداها الزمني فوق الحقبة، وكلّ الأوقات يبقي مدى الحقبة إن
     اختير. */
  const y = new Date().getUTCFullYear();
  const topFor = (mt: "movie" | "tv", genreIds: number[] | undefined) => {
    if (win === "year") {
      return topByFilter(
        mt,
        { ...base, from: `${y}-01-01`, to: `${y}-12-31`, genreIds },
        10,
        "popularity.desc",
      ).catch(() => [] as SearchResult[]);
    }
    if (win === "all") {
      return topByFilter(mt, { ...base, genreIds }, 10, "vote_count.desc").catch(
        () => [] as SearchResult[],
      );
    }
    // أسبوعي
    return deep
      ? topByFilter(mt, { ...base, genreIds }).catch(() => [] as SearchResult[])
      : genreIds
        ? topTenGenreThisWeek(mt, genreIds).catch(() => [] as SearchResult[])
        : topTenThisWeek(mt).catch(() => [] as SearchResult[]);
  };

  const [topMovies, topSeries, topAnime, cinemas, soonMovies, soonSeries, publicLists, top50Movies, top50Series] =
    await Promise.all([
      wantMovies && !upcoming ? topFor("movie", genre?.movie) : Promise.resolve([] as SearchResult[]),
      wantSeries && !upcoming ? topFor("tv", genre?.tv) : Promise.resolve([] as SearchResult[]),
      // صفوف أسبوعية بطبعها: الأنمي «هذا الأسبوع»، ودور العرض «الآن»،
      // والقادم «مستقبلاً» — لا معنى لها في نافذتَي السنة وكل الأوقات
      isWeek && !active && wantSeries
        ? topTenAnimeThisWeek().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      isWeek && wantMovies ? nowPlayingMovies().catch(() => null) : Promise.resolve(null),
      // «القادم» يفتح صفّ العدّ التنازلي في كل النوافذ — هو النتيجة كلّها هناك
      (isWeek || upcoming) && wantMovies
        ? deep
          ? upcomingByFilter("movie", { ...base, genreIds: genre?.movie })
          : genre
            ? upcomingByGenre(genre.movie, "movie")
            : upcomingMovies().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      (isWeek || upcoming) && wantSeries
        ? deep
          ? upcomingByFilter("tv", { ...base, genreIds: genre?.tv })
          : genre
            ? upcomingByGenre(genre.tv, "tv")
            : airingTv().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      // «قوائم من المجتمع» — أحدث القوائم المعلنة؛ كذيل الخمسين: بلا نافذة
      // (القوائم بلا زمن) وتغيب مع الفلتر (لا تُصفّى بمعاييره فتكذب عليه)
      !active ? getPublicListsFeed(15).catch(() => []) : Promise.resolve([]),
      // أعلى ٥٠ على الإطلاق — ذيلٌ ثابت في الحالة غير المُصفّاة (طلب المالك)
      !active && wantMovies ? top50("movie").catch(() => [] as SearchResult[]) : Promise.resolve([] as SearchResult[]),
      !active && wantSeries ? top50("tv").catch(() => [] as SearchResult[]) : Promise.resolve([] as SearchResult[]),
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
  const inCinemas = provider
    ? null
    : cinemas && active
      ? { region: cinemas.region, results: cinemas.results.filter(fitsCinema) }
      : cinemas;

  // القادم فقط في صفّ العدّ التنازلي — ما صدر أمس ليس «قادماً»
  const soon: CountdownItem[] = [...soonMovies, ...soonSeries]
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
    topAnime.length === 0 &&
    soon.length === 0 &&
    top50Movies.length === 0 &&
    top50Series.length === 0 &&
    !inCinemas?.results.length;

  return (
    <div className="space-y-8">
      {/* ===== الصفّان الشخصيّان — Suspense مستقلّ (م٧/D-071) =====
          المقترحات وحدها ~٤٠ طلب TMDB في أول تحميل، وكانت داخل
          Promise.all الصفوف كلّها فيرهن أبطأُ طلبٍ رسمَ الصفحة بأكملها.
          فصلُهما يجعل «أفضل ١٠» ودور العرض تظهر فور جاهزيتها، ويلحق
          الشخصيّ حين يكتمل — والهيكل يحجز ارتفاعه (D-046) */}
      {isWeek && !active && (
        <Suspense fallback={<RailSkeleton count={6} />}>
          <PersonalRails locale={locale} t={t} />
        </Suspense>
      )}

      {inCinemas && inCinemas.results.length > 0 && (
        <RankedRail
          title={t.inCinemas}
          icon="film"
          items={inCinemas.results}
          /* اسم البلد من `region.ts` لا من خريطةٍ محلية: صفّ السينما
             صار يبدأ من بلد المستخدم، وخريطةٌ من أربعة بلدان كانت
             ستطبع «MA» لمن اختار المغرب */
          note={t.inCinemasRegion(regionName(inCinemas.region, locale === "en" ? "en" : "ar"))}
          ranked={false}
        />
      )}

      {topMovies.length > 0 && (
        <RankedRail title={t.topMoviesWin(win)} icon="film" items={topMovies} />
      )}
      {topSeries.length > 0 && (
        <RankedRail title={t.topSeriesWin(win)} icon="tv" items={topSeries} />
      )}
      {topAnime.length > 0 && (
        <RankedRail title={t.topTenAnime} icon="sparkle-star" items={topAnime} />
      )}
      {soon.length > 0 && (
        <CountdownRail title={t.comingSoon} icon="calendar" items={soon} locale={locale} />
      )}

      {/* «قوائم من المجتمع» قبل ذيل الخمسين: صنعُ الناس قبل المرجع الثابت */}
      <PublicListsRail lists={publicLists} locale={locale} />

      {/* ذيل «أعلى ٥٠ على الإطلاق» — مرجعٌ ثابت في الحالة غير المُصفّاة */}
      {top50Movies.length > 0 && (
        <RankedRail title={t.top50Movies} icon="film" items={top50Movies} />
      )}
      {top50Series.length > 0 && (
        <RankedRail title={t.top50Series} icon="tv" items={top50Series} />
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
async function PersonalRails({ locale, t }: { locale: Locale; t: T }) {
  const [pool, artistWorks] = await Promise.all([
    getSuggestions(300, locale).catch(() => []),
    getFollowedArtists(20)
      .then((a) => (a.length ? worksByPeople(a.map((x) => x.person_id), 20) : []))
      .catch(() => [] as SearchResult[]),
  ]);

  /* قرعةُ خادمٍ عند كل طلب (D-073): البِركة مخبّأة ساعةً فكانت العشرة
     الأولى تتجمّد معها — فتح «اكتشف» مرتين يعرض الوجوه نفسها. الخلطُ هنا
     يجعل كل فتحٍ عيّنةً مختلفة، وزرّ التحديث يبقى للسحب داخل الزيارة */
  const suggested = [...pool];
  for (let i = suggested.length - 1; i > 0; i--) {
    // العشوائية مقصودة: قرعةٌ لكل طلبٍ في مكوّن خادمٍ لا-متزامن يُنفَّذ مرةً واحدة
    // eslint-disable-next-line react-hooks/purity -- ليست دالة عرضٍ تُعاد
    const j = Math.floor(Math.random() * (i + 1));
    [suggested[i], suggested[j]] = [suggested[j], suggested[i]];
  }

  if (suggested.length === 0 && artistWorks.length === 0) return null;

  return (
    <div className="space-y-8">
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

      {/* «من فنّانيك» بعد المقترحات مباشرة: كلاهما صفٌّ شخصيّ، والشخصيّ
          يسبق العامّ. غير مرقّم — هذه أحدث أعمال فنّانيك لا ترتيبها */}
      {artistWorks.length > 0 && (
        <RankedRail title={t.artistsRail} icon="people" items={artistWorks} ranked={false} />
      )}
    </div>
  );
}
