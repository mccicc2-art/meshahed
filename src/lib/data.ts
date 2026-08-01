import { createClient } from "@/lib/supabase/server";
import { episodeKey } from "@/lib/keys";

export { episodeKey };

export interface FollowRow {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  added_at: string;
}

export interface WatchedEpisodeRow {
  show_tmdb_id: number;
  season_number: number;
  episode_number: number;
  watched_at: string;
  runtime: number | null;
}

export async function getUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function getFollows(): Promise<FollowRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("tmdb_id, media_type, title, poster_path, added_at")
    .order("added_at", { ascending: false });
  return data ?? [];
}

export async function getWatchedForShow(showTmdbId: number): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("show_tmdb_id", showTmdbId);
  return new Set((data ?? []).map((r) => episodeKey(r.season_number, r.episode_number)));
}

export async function getAllWatchedEpisodes(): Promise<WatchedEpisodeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watched_episodes")
    .select("show_tmdb_id, season_number, episode_number, watched_at, runtime");
  return data ?? [];
}

export async function getWatchedMovieIds(): Promise<Set<number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("watched_movies").select("movie_tmdb_id");
  return new Set((data ?? []).map((r) => r.movie_tmdb_id));
}
