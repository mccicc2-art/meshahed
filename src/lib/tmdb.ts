// TMDB API client (v3). Requires TMDB_API_KEY in the environment.
// Server-only: never expose the key to the browser.

import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";

export {
  IMG,
  posterUrl,
  backdropUrl,
  titleOf,
  yearOf,
  GENRES,
  genreName,
} from "@/lib/media";
export type { MediaType } from "@/lib/media";

const BASE = "https://api.themoviedb.org/3";

// لغة بيانات TMDB تتبع لغة الواجهة المختارة
async function tmdbLanguage(): Promise<string> {
  try {
    const store = await cookies();
    return store.get(LOCALE_COOKIE)?.value === "en" ? "en-US" : "ar-SA";
  } catch {
    return "ar-SA";
  }
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not set");
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", await tmdbLanguage());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    // Cache TMDB responses for an hour; content changes slowly.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`TMDB ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface SearchResult {
  id: number;
  media_type: MediaType | "person";
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date?: string;
  release_date?: string;
  vote_average: number;
  /** عدد المصوّتين عالمياً — تُستخدم كعتبة حتى لا يتصدّر عمل بصوتين */
  vote_count?: number;
  popularity?: number;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
}

export interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

export interface TvDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  genres: { id: number; name: string }[];
  vote_average: number;
  status: string;
  seasons: Season[];
  next_episode_to_air: Episode | null;
  last_episode_to_air: Episode | null;
  networks: { id: number; name: string; logo_path: string | null }[];
}

export interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  status: string;
}

export interface SeasonDetails {
  id: number;
  name: string;
  season_number: number;
  overview: string;
  poster_path: string | null;
  episodes: Episode[];
}

export async function searchMulti(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const data = await tmdb<{ results: SearchResult[] }>("/search/multi", {
    query,
    include_adult: "false",
  });
  return data.results.filter(
    (r) => (r.media_type === "tv" || r.media_type === "movie") && r.poster_path,
  );
}

export async function trending(): Promise<SearchResult[]> {
  const data = await tmdb<{ results: SearchResult[] }>("/trending/all/week");
  return data.results.filter(
    (r) => (r.media_type === "tv" || r.media_type === "movie") && r.poster_path,
  );
}

// أخبار: أفلام قادمة قريباً + مسلسلات تُعرض حالياً
export async function upcomingMovies(): Promise<SearchResult[]> {
  const data = await tmdb<{ results: SearchResult[] }>("/movie/upcoming", { region: "SA" });
  return data.results
    .filter((r) => r.poster_path)
    .map((r) => ({ ...r, media_type: "movie" as const }));
}

export async function airingTv(): Promise<SearchResult[]> {
  const data = await tmdb<{ results: SearchResult[] }>("/tv/on_the_air");
  return data.results
    .filter((r) => r.poster_path)
    .map((r) => ({ ...r, media_type: "tv" as const }));
}

// اقتراحات حسب الأنواع المفضّلة في البروفايل
export async function discoverByGenres(
  genreIds: number[],
  mediaType: MediaType = "tv",
): Promise<SearchResult[]> {
  if (!genreIds.length) return [];
  const data = await tmdb<{ results: SearchResult[] }>(`/discover/${mediaType}`, {
    with_genres: genreIds.join("|"),
    sort_by: "popularity.desc",
    include_adult: "false",
  });
  return data.results
    .filter((r) => r.poster_path)
    .map((r) => ({ ...r, media_type: mediaType }));
}

// ترشيحات TMDB المبنية على عمل معيّن (تُستخدم كبذور لمحرّك الاقتراحات)
export async function recommendationsFor(
  mediaType: MediaType,
  id: number,
): Promise<SearchResult[]> {
  const data = await tmdb<{ results: SearchResult[] }>(`/${mediaType}/${id}/recommendations`);
  return data.results
    .filter((r) => r.poster_path)
    .map((r) => ({ ...r, media_type: mediaType }));
}

export function getTv(id: number): Promise<TvDetails> {
  return tmdb<TvDetails>(`/tv/${id}`);
}

export function getMovie(id: number): Promise<MovieDetails> {
  return tmdb<MovieDetails>(`/movie/${id}`);
}

export function getSeason(tvId: number, seasonNumber: number): Promise<SeasonDetails> {
  return tmdb<SeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`);
}

/**
 * الأعلى تقييماً عالمياً هذا الأسبوع.
 *
 * TMDB لا يوفّر «أعلى تقييماً لهذا الأسبوع» جاهزاً — قائمة top_rated عنده
 * تاريخية لا أسبوعية. فالمعيار هنا: رائج هذا الأسبوع + تجاوز عتبة أصوات
 * تمنع عملاً بثلاثة أصوات من التصدّر.
 */
export async function topRatedThisWeek(minVotes = 150): Promise<SearchResult[]> {
  const rows = await trending();
  return rows
    .filter((r) => (r.vote_count ?? 0) >= minVotes && r.vote_average > 0)
    .sort((a, b) => b.vote_average - a.vote_average);
}

/** الأكثر رواجاً عالمياً هذا الأسبوع — ترتيب TMDB نفسه */
export async function mostPopularThisWeek(): Promise<SearchResult[]> {
  const rows = await trending();
  return [...rows].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

// ============================================================
//  الترايلر وأين تشاهده
// ============================================================

export interface Video {
  key: string;
  site: string;
  type: string;
  name: string;
  official: boolean;
  size: number;
}

/**
 * أفضل ترايلر متاح لعمل معيّن.
 *
 * الترتيب: ترايلر رسمي ← ترايلر ← تيزر ← أي مقطع يوتيوب. ويُطلب باللغة
 * المختارة أولاً، فإن لم يوجد مقطع عربي رجعنا للإنجليزية — أغلب الأعمال
 * الأجنبية ليس لها ترايلر مرفوع بالعربية.
 */
export async function getTrailer(
  mediaType: MediaType,
  id: number,
): Promise<{ key: string; name: string } | null> {
  const pick = (vids: Video[]) => {
    const yt = vids.filter((v) => v.site === "YouTube" && v.key);
    return (
      yt.find((v) => v.type === "Trailer" && v.official) ??
      yt.find((v) => v.type === "Trailer") ??
      yt.find((v) => v.type === "Teaser") ??
      yt[0] ??
      null
    );
  };

  try {
    const local = await tmdb<{ results: Video[] }>(`/${mediaType}/${id}/videos`);
    const found = pick(local.results ?? []);
    if (found) return { key: found.key, name: found.name };
  } catch {
    /* نكمل للإنجليزية */
  }

  try {
    const en = await tmdb<{ results: Video[] }>(`/${mediaType}/${id}/videos`, {
      language: "en-US",
    });
    const found = pick(en.results ?? []);
    return found ? { key: found.key, name: found.name } : null;
  } catch {
    return null;
  }
}

export interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
}

export interface WatchOptions {
  /** اشتراك — نتفلكس وشاهد وغيرها */
  flatrate: Provider[];
  /** إيجار */
  rent: Provider[];
  /** شراء */
  buy: Provider[];
  /** مجاني بإعلانات */
  free: Provider[];
  /** رابط JustWatch الرسمي — TMDB تشترط عرضه مع البيانات */
  link: string | null;
}

/**
 * منصّات المشاهدة في بلد المستخدم.
 *
 * TMDB تُرجع خريطة بكل الدول؛ نأخذ السعودية أولاً ثم الإمارات ثم أمريكا،
 * لأن كثيراً من الأعمال غير مُدرجة تحت SA فتظهر الصفحة بلا فائدة.
 */
export async function getWatchProviders(
  mediaType: MediaType,
  id: number,
  regions: string[] = ["SA", "AE", "EG", "US"],
): Promise<{ region: string; options: WatchOptions } | null> {
  try {
    const data = await tmdb<{
      results: Record<
        string,
        { link?: string; flatrate?: Provider[]; rent?: Provider[]; buy?: Provider[]; free?: Provider[] }
      >;
    }>(`/${mediaType}/${id}/watch/providers`);

    for (const region of regions) {
      const r = data.results?.[region];
      if (!r) continue;
      const options: WatchOptions = {
        flatrate: r.flatrate ?? [],
        rent: r.rent ?? [],
        buy: r.buy ?? [],
        free: r.free ?? [],
        link: r.link ?? null,
      };
      const any =
        options.flatrate.length || options.rent.length || options.buy.length || options.free.length;
      if (any) return { region, options };
    }
    return null;
  } catch {
    return null;
  }
}
