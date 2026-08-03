import { redirect } from "next/navigation";
import { getUser, getFollows, getReactions } from "@/lib/data";
import {
  upcomingMovies,
  airingTv,
  topTenThisWeek,
  topTenAnimeThisWeek,
  nowPlayingMovies,
  titleOf,
  yearOf,
  posterUrl,
  backdropUrl,
  type SearchResult,
} from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import type { NewsItem } from "@/components/NewsPost";
import { NewsList } from "@/components/NewsList";
import { RankedRail } from "@/components/RankedRail";
import { SectionTitle } from "@/components/Icon";
import { CountdownRail, type CountdownItem } from "@/components/CountdownRail";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { PosterCard } from "@/components/PosterCard";
import { getSuggestions } from "@/lib/suggest";

const REGIONS: Record<string, string> = {
  SA: "السعودية",
  AE: "الإمارات",
  EG: "مصر",
  US: "أمريكا",
};

function dateOf(r: SearchResult) {
  return r.release_date ?? r.first_air_date ?? "";
}

/**
 * الأخبار.
 *
 * كانت ثلاثة تبويبات وثلاث مجموعات فلاتر فوق المحتوى — تسع خيارات قبل أن
 * يرى المستخدم ملصقاً واحداً. الآن ثلاثة صفوف أفقية تُقرأ بالتمرير لا
 * بالاختيار: أفضل عشرة أفلام، أفضل عشرة مسلسلات، ثم القادم بعدّ تنازلي.
 * وتحتها التغطية المفصّلة لمن يريد الاستزادة.
 */
export default async function NewsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const [topMovies, topSeries, topAnime, cinemas, movies, tv, follows, suggested] =
    await Promise.all([
    topTenThisWeek("movie").catch(() => [] as SearchResult[]),
    topTenThisWeek("tv").catch(() => [] as SearchResult[]),
    topTenAnimeThisWeek().catch(() => [] as SearchResult[]),
    nowPlayingMovies().catch(() => null),
    upcomingMovies().catch(() => [] as SearchResult[]),
    airingTv().catch(() => [] as SearchResult[]),
    getFollows(),
    getSuggestions(12).catch(() => []),
  ]);

  const followed = follows.map((f) => `${f.media_type}-${f.tmdb_id}`);
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

  // التغطية المفصّلة: الأحدث أولاً، وعدد أقل مما كان — الصفوف فوقها تكفي
  // للاستكشاف السريع، وهذه لمن ينزل يقرأ
  const items: NewsItem[] = [...movies, ...tv]
    .filter((r) => r.media_type === "tv" || r.media_type === "movie")
    .map((r) => ({
      id: r.id,
      mediaType: r.media_type as "tv" | "movie",
      title: titleOf(r),
      overview: r.overview ?? "",
      poster: posterUrl(r.poster_path, "w342"),
      posterPath: r.poster_path,
      backdrop: backdropUrl(r.backdrop_path, "w500"),
      date: dateOf(r),
      rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : null,
    }))
    .sort((a, b) => {
      const aFuture = a.date >= today;
      const bFuture = b.date >= today;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aFuture ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    })
    .slice(0, 18);

  const reactions = await getReactions(items.map((i) => i.id));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold">{t.newsTitle}</h1>
        <p className="text-xs text-muted mt-0.5">{t.discoverSub}</p>
      </header>

      {suggested.length > 0 && (
        <PosterRail title={t.suggestedForYou} icon="sparkles" subtitle={t.suggestedSubtitle}>
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
          locale={locale}
          note={t.inCinemasRegion(REGIONS[cinemas.region] ?? cinemas.region)}
          ranked={false}
        />
      )}

      <RankedRail title={t.topTenMovies} icon="film" items={topMovies} locale={locale} />
      <RankedRail title={t.topTenSeries} icon="tv" items={topSeries} locale={locale} />
      <RankedRail title={t.topTenAnime} icon="sparkle-star" items={topAnime} locale={locale} />
      <CountdownRail title={t.comingSoon} icon="calendar" items={soon} locale={locale} />

      {items.length > 0 && (
        <section>
          <SectionTitle icon="newspaper" className="mb-1">
            {t.newsCoverage}
          </SectionTitle>
          <p className="text-[11px] text-muted mb-3">{t.newsSubtitle}</p>
          <NewsList
            items={items}
            locale={locale}
            counts={reactions.counts}
            mine={[...reactions.mine]}
            followed={followed}
          />
        </section>
      )}

      {items.length === 0 && topMovies.length === 0 && (
        <p className="text-center text-muted py-20">{t.newsEmpty}</p>
      )}
    </div>
  );
}
