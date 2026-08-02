// TMDB API client (v3). Requires TMDB_API_KEY in the environment.
// Server-only: never expose the key to the browser.

const BASE = "https://api.themoviedb.org/3";
export const IMG = "https://image.tmdb.org/t/p";

export function posterUrl(path: string | null, size: "w185" | "w342" | "w500" = "w342") {
  return path ? `${IMG}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size: "w780" | "w1280" = "w1280") {
  return path ? `${IMG}/${size}${path}` : null;
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not set");
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "ar-SA");
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

export type MediaType = "tv" | "movie";

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

// الأنواع المتاحة للاختيار في صفحة البروفايل (معرّفات TMDB)
export const GENRES: { id: number; name: string; emoji: string }[] = [
  { id: 35, name: "كوميدي", emoji: "😂" },
  { id: 18, name: "دراما", emoji: "🎭" },
  { id: 10759, name: "أكشن ومغامرة", emoji: "💥" },
  { id: 9648, name: "غموض", emoji: "🕵️" },
  { id: 80, name: "جريمة", emoji: "🚔" },
  { id: 10765, name: "خيال علمي وفانتازيا", emoji: "🚀" },
  { id: 16, name: "رسوم متحركة", emoji: "🎨" },
  { id: 99, name: "وثائقي", emoji: "📚" },
  { id: 10751, name: "عائلي", emoji: "👨‍👩‍👧" },
  { id: 10766, name: "دراما يومية", emoji: "📺" },
  { id: 37, name: "غربي", emoji: "🤠" },
  { id: 10768, name: "حربي وسياسي", emoji: "⚔️" },
];

export function getTv(id: number): Promise<TvDetails> {
  return tmdb<TvDetails>(`/tv/${id}`);
}

export function getMovie(id: number): Promise<MovieDetails> {
  return tmdb<MovieDetails>(`/movie/${id}`);
}

export function getSeason(tvId: number, seasonNumber: number): Promise<SeasonDetails> {
  return tmdb<SeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`);
}

export function titleOf(r: { title?: string; name?: string }): string {
  return r.title ?? r.name ?? "بدون عنوان";
}

export function yearOf(r: { first_air_date?: string | null; release_date?: string | null }): string {
  const d = r.first_air_date ?? r.release_date;
  return d ? d.slice(0, 4) : "";
}
