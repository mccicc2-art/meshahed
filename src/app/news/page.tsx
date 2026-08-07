import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser, getFollowedArtists } from "@/lib/data";
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
  browseKey,
  browseCount,
  needsDiscover,
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

  /* قائمة المنصّات تُجلب على الخادم وتُمرَّر للورقة: طلبٌ واحد مخبَّأ ساعةً
     في طبقة fetch، ورأس الصفحة يبقى يرسم فوراً لأن الصفوف وحدها خلف
     Suspense. وفشلُ الجلب يُخفي المحور بدل أن يعرض خانةً فارغة */
  const [providers, region] = await Promise.all([
    listWatchProviders(browse.type === "tv" ? "tv" : "movie"),
    getWatchRegion(),
  ]);

  return (
    <div className="space-y-8">
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة */}
      <h1 className="sr-only">{t.newsTitle}</h1>

      <DiscoverFilters
        locale={locale}
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

      {/* المفتاح يتغيّر بتغيّر الفلتر: React يُظهر الهيكل فوراً بدل أن
          يُبقي صفوف الفلتر السابق معلّقة حتى تصل الجديدة */}
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

  /* الفلتر بلا تصنيف — لكل جهةٍ معرّفاتها فيُضاف عند الطلب */
  const base: DiscoverFilter = {
    lang: lang?.code ?? null,
    country: country?.code ?? null,
    provider,
    watchRegion: region,
    from: era?.from ?? null,
    to: era?.to ?? null,
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

  const [topMovies, topSeries, topAnime, cinemas, soonMovies, soonSeries, suggested, artistWorks, top50Movies, top50Series] =
    await Promise.all([
      wantMovies ? topFor("movie", genre?.movie) : Promise.resolve([] as SearchResult[]),
      wantSeries ? topFor("tv", genre?.tv) : Promise.resolve([] as SearchResult[]),
      // صفوف أسبوعية بطبعها: الأنمي «هذا الأسبوع»، ودور العرض «الآن»،
      // والقادم «مستقبلاً» — لا معنى لها في نافذتَي السنة وكل الأوقات
      isWeek && !active && wantSeries
        ? topTenAnimeThisWeek().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      isWeek && wantMovies ? nowPlayingMovies().catch(() => null) : Promise.resolve(null),
      isWeek && wantMovies
        ? deep
          ? upcomingByFilter("movie", { ...base, genreIds: genre?.movie })
          : genre
            ? upcomingByGenre(genre.movie, "movie")
            : upcomingMovies().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      isWeek && wantSeries
        ? deep
          ? upcomingByFilter("tv", { ...base, genreIds: genre?.tv })
          : genre
            ? upcomingByGenre(genre.tv, "tv")
            : airingTv().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      // بِركةٌ تصل المئة لا اثنا عشر: العميل يعرض عشراً ويقلّبها بزرّ
      // التحديث محلياً (شكوى «ثابتة من الصباح») — طلبات TMDB نفسها تقريباً
      isWeek && !active ? getSuggestions(100, locale).catch(() => []) : Promise.resolve([]),
      // «من فنّانيك» — أحدث أفلام من تتابعهم (with_people)؛ صفٌّ شخصيّ
      // كصفّ المقترحات فيغيب مع الفلتر ونافذتَي السنة وكل الأوقات
      isWeek && !active
        ? getFollowedArtists(20)
            .then((a) => (a.length ? worksByPeople(a.map((x) => x.person_id), 20) : []))
            .catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
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
      if (d && era.from && d < era.from) return false;
      if (d && era.to && d > era.to) return false;
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
