import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import {
  upcomingMovies,
  airingTv,
  topTenThisWeek,
  topTenAnimeThisWeek,
  nowPlayingMovies,
  titleOf,
  yearOf,
  posterUrl,
  type SearchResult,
} from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { RankedRail } from "@/components/RankedRail";
import { CountdownRail, type CountdownItem } from "@/components/CountdownRail";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { PosterCard } from "@/components/PosterCard";
import { getSuggestions } from "@/lib/suggest";

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
      <header>
        <h1 className="text-xl font-bold">{t.newsTitle}</h1>
      </header>

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
