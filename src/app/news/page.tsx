import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import {
  upcomingMovies,
  airingTv,
  topTenThisWeek,
  topTenAnimeThisWeek,
  topTenGenreThisWeek,
  upcomingByGenre,
  nowPlayingMovies,
  titleOf,
  yearOf,
  posterUrl,
  type SearchResult,
} from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { type Locale } from "@/lib/i18n";
import { parseBrowse, browseKey, type BrowseQuery } from "@/lib/browse";
import { RankedRail } from "@/components/RankedRail";
import { CountdownRail, type CountdownItem } from "@/components/CountdownRail";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { PosterCard } from "@/components/PosterCard";
import { RailSkeleton } from "@/components/Skeletons";
import { DiscoverFilters } from "@/components/DiscoverFilters";
import { getSuggestions } from "@/lib/suggest";

type T = Awaited<ReturnType<typeof getT>>["t"];

// اسم المنطقة باللغتين — كانت عربيةً وحدها فتتسرّب إلى الواجهة الإنجليزية
const REGIONS: Record<string, { ar: string; en: string }> = {
  SA: { ar: "السعودية", en: "Saudi Arabia" },
  AE: { ar: "الإمارات", en: "UAE" },
  EG: { ar: "مصر", en: "Egypt" },
  US: { ar: "أمريكا", en: "the US" },
};

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
  searchParams: Promise<{ type?: string; g?: string; sort?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const sp = await searchParams;
  const browse = parseBrowse(sp);

  return (
    <div className="space-y-8">
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة */}
      <h1 className="sr-only">{t.newsTitle}</h1>

      <DiscoverFilters
        locale={locale}
        type={browse.type}
        genre={browse.genre?.slug ?? null}
        active={browse.active}
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
        <CuratedRails locale={locale} t={t} browse={browse} />
      </Suspense>
    </div>
  );
}

/**
 * صفوف اكتشف — مقصورةً على الفلتر إن وُجد.
 *
 * الطلبات تُبنى على قدر الفلتر: جهة «أفلام» لا تطلب المسلسلات أصلاً،
 * والنوع الدرامي يحوّل كل صفٍّ إلى نظيره المُصفّى. وصفّ الأنمي وصفّ
 * «مقترح لك» يظهران في السكون وحده: الأول تصنيفٌ قائم بذاته لا يُقصّ
 * بنوعٍ درامي، والثاني بُني على ذوق المستخدم لا على اختياره اللحظي.
 */
async function CuratedRails({
  locale,
  t,
  browse,
}: {
  locale: Locale;
  t: T;
  browse: BrowseQuery;
}) {
  const { type, genre, active } = browse;
  const wantMovies = type !== "tv";
  const wantSeries = type !== "movie";

  const [topMovies, topSeries, topAnime, cinemas, soonMovies, soonSeries, suggested] =
    await Promise.all([
      wantMovies
        ? genre
          ? topTenGenreThisWeek("movie", genre.movie).catch(() => [] as SearchResult[])
          : topTenThisWeek("movie").catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      wantSeries
        ? genre
          ? topTenGenreThisWeek("tv", genre.tv).catch(() => [] as SearchResult[])
          : topTenThisWeek("tv").catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      !active && wantSeries
        ? topTenAnimeThisWeek().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      wantMovies ? nowPlayingMovies().catch(() => null) : Promise.resolve(null),
      wantMovies
        ? genre
          ? upcomingByGenre(genre.movie, "movie")
          : upcomingMovies().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      wantSeries
        ? genre
          ? upcomingByGenre(genre.tv, "tv")
          : airingTv().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      !active ? getSuggestions(12).catch(() => []) : Promise.resolve([]),
    ]);

  const today = new Date().toISOString().slice(0, 10);

  // «في السينما» لا يقبل نوعاً درامياً من TMDB، فيُصفّى هنا بمعرّفاته
  const inCinemas =
    cinemas && genre
      ? {
          region: cinemas.region,
          results: cinemas.results.filter((r) =>
            (r.genre_ids ?? []).some((id) => genre.movie.includes(id)),
          ),
        }
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
    !inCinemas?.results.length;

  return (
    <div className="space-y-8">
      {suggested.length > 0 && (
        <PosterRail title={t.suggestedForYou} icon="sparkles">
          {suggested.map((s) => (
            <RailItem key={`sug-${s.result.media_type}-${s.result.id}`}>
              <PosterCard
                href={`/${s.result.media_type === "movie" ? "movie" : "show"}/${s.result.id}`}
                title={titleOf(s.result)}
                posterPath={s.result.poster_path}
                year={yearOf(s.result)}
                note={
                  s.source === "rated" && s.seedTitle
                    ? t.recoBecauseRated(s.seedTitle)
                    : s.source === "follows" && s.seedTitle
                      ? t.recoBecauseFollow(s.seedTitle)
                      : s.source === "recent" && s.seedTitle
                        ? t.recoBecauseWatched(s.seedTitle)
                        : t.recoBecauseGenre
                }
              />
            </RailItem>
          ))}
        </PosterRail>
      )}

      {inCinemas && inCinemas.results.length > 0 && (
        <RankedRail
          title={t.inCinemas}
          icon="film"
          items={inCinemas.results}
          note={t.inCinemasRegion(
            REGIONS[inCinemas.region]?.[locale === "en" ? "en" : "ar"] ?? inCinemas.region,
          )}
          ranked={false}
        />
      )}

      {topMovies.length > 0 && (
        <RankedRail title={t.topTenMovies} icon="film" items={topMovies} />
      )}
      {topSeries.length > 0 && (
        <RankedRail title={t.topTenSeries} icon="tv" items={topSeries} />
      )}
      {topAnime.length > 0 && (
        <RankedRail title={t.topTenAnime} icon="sparkle-star" items={topAnime} />
      )}
      {soon.length > 0 && (
        <CountdownRail title={t.comingSoon} icon="calendar" items={soon} locale={locale} />
      )}

      {empty && (
        <p className="text-center text-muted py-20">
          {active ? t.browseEmpty : t.newsEmpty}
        </p>
      )}
    </div>
  );
}
