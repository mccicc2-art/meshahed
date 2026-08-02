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

export function getTv(id: number): Promise<TvDetails> {
  return tmdb<TvDetails>(`/tv/${id}`);
}

export function getMovie(id: number): Promise<MovieDetails> {
  return tmdb<MovieDetails>(`/movie/${id}`);
}

export function getSeason(tvId: number, seasonNumber: number): Promise<SeasonDetails> {
  return tmdb<SeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`);
}
