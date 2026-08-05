import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { Icon } from "@/components/Icon";
import {
  upcomingMovies,
  airingTv,
  topTenThisWeek,
  topTenAnimeThisWeek,
  nowPlayingMovies,
  discoverTitles,
  titleOf,
  yearOf,
  posterUrl,
  type SearchResult,
} from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { num, type Locale } from "@/lib/i18n";
import {
  parseBrowse,
  browseGenreName,
  browseKey,
  type BrowseItem,
  type BrowseQuery,
} from "@/lib/browse";
import { RankedRail } from "@/components/RankedRail";
import { CountdownRail, type CountdownItem } from "@/components/CountdownRail";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { PosterCard } from "@/components/PosterCard";
import { RailSkeleton } from "@/components/Skeletons";
import { DiscoverFilters } from "@/components/DiscoverFilters";
import { DiscoverResults } from "@/components/DiscoverResults";
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
 * وجهان لصفحةٍ واحدة: سكونٌ وتصفّح. في السكون صفوفٌ منسّقة تُقرأ بالتمرير
 * لا بالاختيار — أفضل عشرة أفلام ومسلسلات وأنمي، ثم القادم بعدّ تنازلي.
 * وحين يلمس المستخدم فلتراً (جهة المحتوى أو نوعاً درامياً) تُستبدل الصفوف
 * بشبكة نتائج: من يعرف ما يريد لا يُجبر على التمرير في صفوفٍ ليست طلبه،
 * ومن لا يعرف لا يُستقبل بجدار خيارات.
 *
 * الترويسة والبحث والفلاتر ترسم فوراً، وكلا الوجهين خلف Suspense يجلب
 * بياناته بنفسه — فلا تنتظر الصفحة كلّها أبطأ طلب TMDB.
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
      <header>
        <h1 className="text-xl font-bold">{t.newsTitle}</h1>
      </header>

      <div className="space-y-4">
        {/* مدخل البحث — حقلٌ شكليّ يفتح صفحة البحث، على عادة تبويبات
            «اكتشف» في التطبيقات الكبيرة */}
        <Link
          href="/search"
          className="flex items-center gap-2.5 bg-surface border border-border rounded-2xl px-4 py-3.5 text-sm text-muted hover:border-accent/60 active:bg-surface-2 transition"
        >
          <Icon name="search" size={17} className="shrink-0" />
          {t.searchPlaceholder}
        </Link>

        <DiscoverFilters
          locale={locale}
          type={browse.type}
          genre={browse.genre?.slug ?? null}
          sort={browse.sort}
          active={browse.active}
        />
      </div>

      {browse.active ? (
        // المفتاح يتغيّر بتغيّر الفلتر: React يُظهر الهيكل فوراً بدل أن
        // يُبقي نتائج الفلتر السابق معلّقة حتى تصل الجديدة
        <Suspense key={browseKey(browse)} fallback={<BrowseSkeleton />}>
          <BrowseSection browse={browse} locale={locale} t={t} />
        </Suspense>
      ) : (
        <Suspense
          fallback={
            <div className="space-y-8" aria-hidden>
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
            </div>
          }
        >
          <CuratedRails locale={locale} t={t} />
        </Suspense>
      )}
    </div>
  );
}

/** نتائج التصفّح — الصفحة الأولى من الخادم، وما بعدها من العميل */
async function BrowseSection({
  browse,
  locale,
  t,
}: {
  browse: BrowseQuery;
  locale: Locale;
  t: T;
}) {
  let page: Awaited<ReturnType<typeof discoverTitles>> | null = null;
  try {
    page = await discoverTitles(browse, 1);
  } catch {
    page = null;
  }

  const items: BrowseItem[] = (page?.results ?? []).map((r) => ({
    id: r.id,
    mediaType: r.media_type === "tv" ? "tv" : "movie",
    title: titleOf(r),
    poster: r.poster_path,
    year: yearOf(r),
  }));

  const typeLabel =
    browse.type === "movie"
      ? t.browseMovies
      : browse.type === "tv"
        ? t.browseSeries
        : t.browseAll;
  const heading = [typeLabel, browse.genre ? browseGenreName(browse.genre, locale) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-bold">{heading}</h2>
        {page && page.total > 0 && (
          <span className="text-xs text-muted shrink-0 tabular-nums">
            {t.browseCount(num(page.total, locale))}
          </span>
        )}
      </div>

      {!page ? (
        <p className="text-center text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">
          {t.browseFailed}
        </p>
      ) : items.length > 0 ? (
        <DiscoverResults
          initial={items}
          hasMore={page.hasMore}
          query={{ type: browse.type, g: browse.genre?.slug ?? null, sort: browse.sort }}
          labels={{
            movie: t.typeMovie,
            series: t.typeSeries,
            more: t.browseMore,
            loading: t.browseLoading,
            end: t.browseEnd,
            failed: t.browseFailed,
          }}
        />
      ) : (
        <p className="text-center text-muted py-16">{t.browseEmpty}</p>
      )}
    </section>
  );
}

/** هيكل شبكة النتائج — بنفس أبعاد البطاقات فلا تقفز الصفحة عند وصولها */
function BrowseSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="skeleton h-6 w-40 rounded" />
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(96px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="skeleton aspect-[2/3] rounded-[18px] border border-border" />
        ))}
      </div>
    </div>
  );
}

/** الوجه الساكن: صفوف اكتشف المنسّقة */
async function CuratedRails({ locale, t }: { locale: Locale; t: T }) {
  const [topMovies, topSeries, topAnime, cinemas, movies, tv, suggested] = await Promise.all([
    topTenThisWeek("movie").catch(() => [] as SearchResult[]),
    topTenThisWeek("tv").catch(() => [] as SearchResult[]),
    topTenAnimeThisWeek().catch(() => [] as SearchResult[]),
    nowPlayingMovies().catch(() => null),
    upcomingMovies().catch(() => [] as SearchResult[]),
    airingTv().catch(() => [] as SearchResult[]),
    getSuggestions(12).catch(() => []),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  // القادم فقط في صفّ العدّ التنازلي — ما صدر أمس ليس «قادماً»
  const soon: CountdownItem[] = [...movies, ...tv]
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

      {cinemas && (
        <RankedRail
          title={t.inCinemas}
          icon="film"
          items={cinemas.results}
          note={t.inCinemasRegion(
            REGIONS[cinemas.region]?.[locale === "en" ? "en" : "ar"] ?? cinemas.region,
          )}
          ranked={false}
        />
      )}

      <RankedRail title={t.topTenMovies} icon="film" items={topMovies} />
      <RankedRail title={t.topTenSeries} icon="tv" items={topSeries} />
      <RankedRail title={t.topTenAnime} icon="sparkle-star" items={topAnime} />
      <CountdownRail title={t.comingSoon} icon="calendar" items={soon} locale={locale} />

      {topMovies.length === 0 && topSeries.length === 0 && soon.length === 0 && (
        <p className="text-center text-muted py-20">{t.newsEmpty}</p>
      )}
    </div>
  );
}
