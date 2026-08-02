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

export interface Profile {
  id: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  favorite_genres: number[];
}

export async function getProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, username, avatar_url, favorite_genres")
      .eq("id", user.id)
      .maybeSingle();

    // احتياط: لو الجدول لسه ما اتنشأ أو الصف ناقص، استخدم بيانات حساب Google
    if (!data) {
      return {
        id: user.id,
        nickname:
          (user.user_metadata?.full_name as string | undefined) ??
          user.email?.split("@")[0] ??
          null,
        username: user.email?.split("@")[0] ?? null,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        favorite_genres: [],
      };
    }
    return { ...data, favorite_genres: data.favorite_genres ?? [] } as Profile;
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

export interface MovieProgressRow {
  movie_tmdb_id: number;
  position_minutes: number;
  runtime_minutes: number | null;
  title: string | null;
  poster_path: string | null;
}

export async function getMovieProgress(movieTmdbId: number): Promise<MovieProgressRow | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("movie_progress")
      .select("movie_tmdb_id, position_minutes, runtime_minutes, title, poster_path")
      .eq("movie_tmdb_id", movieTmdbId)
      .maybeSingle();
    return (data as MovieProgressRow) ?? null;
  } catch {
    return null;
  }
}

export async function getAllMovieProgress(): Promise<MovieProgressRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("movie_progress")
      .select("movie_tmdb_id, position_minutes, runtime_minutes, title, poster_path")
      .order("updated_at", { ascending: false });
    return (data as MovieProgressRow[]) ?? [];
  } catch {
    return [];
  }
}

export async function getWatchedMovieIds(): Promise<Set<number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("watched_movies").select("movie_tmdb_id");
  return new Set((data ?? []).map((r) => r.movie_tmdb_id));
}
