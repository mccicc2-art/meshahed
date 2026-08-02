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
  cover_url: string | null;
  theme: string | null;
  favorite_genres: number[];
}

export async function getProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    let { data } = await supabase
      .from("profiles")
      .select("id, nickname, username, avatar_url, cover_url, theme, favorite_genres")
      .eq("id", user.id)
      .maybeSingle();

    // احتياط: لو أعمدة المظهر لسه ما انضافت، اقرأ الأعمدة القديمة فقط
    if (!data) {
      const legacy = await supabase
        .from("profiles")
        .select("id, nickname, username, avatar_url, favorite_genres")
        .eq("id", user.id)
        .maybeSingle();
      if (legacy.data) {
        data = { ...legacy.data, cover_url: null, theme: null };
      }
    }

    // احتياط أخير: لو الجدول لسه ما اتنشأ أو الصف ناقص، استخدم بيانات حساب Google
    if (!data) {
      return {
        id: user.id,
        nickname:
          (user.user_metadata?.full_name as string | undefined) ??
          user.email?.split("@")[0] ??
          null,
        username: user.email?.split("@")[0] ?? null,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        cover_url: null,
        theme: null,
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

// PostgREST يرجّع 1000 صف كحد أقصى للطلب الواحد — نقرأ على صفحات حتى لا تضيع حلقات
async function pageAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data } = await fetchPage(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export async function getWatchedForShow(showTmdbId: number): Promise<Set<string>> {
  const supabase = await createClient();
  const rows = await pageAll<{ season_number: number; episode_number: number }>((from, to) =>
    supabase
      .from("watched_episodes")
      .select("season_number, episode_number")
      .eq("show_tmdb_id", showTmdbId)
      .order("season_number", { ascending: true })
      .order("episode_number", { ascending: true })
      .range(from, to),
  );
  return new Set(rows.map((r) => episodeKey(r.season_number, r.episode_number)));
}

export async function getAllWatchedEpisodes(): Promise<WatchedEpisodeRow[]> {
  const supabase = await createClient();
  return pageAll<WatchedEpisodeRow>((from, to) =>
    supabase
      .from("watched_episodes")
      .select("show_tmdb_id, season_number, episode_number, watched_at, runtime")
      .order("show_tmdb_id", { ascending: true })
      .order("season_number", { ascending: true })
      .order("episode_number", { ascending: true })
      .range(from, to),
  );
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

export interface ReactionInfo {
  counts: Record<string, number>; // "tv-1396" → عدد 🔥
  mine: Set<string>;
}

export async function getReactions(): Promise<ReactionInfo> {
  const empty: ReactionInfo = { counts: {}, mine: new Set() };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data } = await supabase
      .from("post_reactions")
      .select("user_id, tmdb_id, media_type");
    if (!data) return empty;

    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    for (const r of data) {
      const key = `${r.media_type}-${r.tmdb_id}`;
      counts[key] = (counts[key] ?? 0) + 1;
      if (user && r.user_id === user.id) mine.add(key);
    }
    return { counts, mine };
  } catch {
    return empty;
  }
}

export async function getWatchedMovieIds(): Promise<Set<number>> {
  const supabase = await createClient();
  const rows = await pageAll<{ movie_tmdb_id: number }>((from, to) =>
    supabase
      .from("watched_movies")
      .select("movie_tmdb_id")
      .order("movie_tmdb_id", { ascending: true })
      .range(from, to),
  );
  return new Set(rows.map((r) => r.movie_tmdb_id));
}

// ================= التقييمات والمراجعات =================

export interface RatingRow {
  user_id: string;
  tmdb_id: number;
  media_type: "tv" | "movie";
  rating: number;
  review: string | null;
  title: string | null;
  poster_path: string | null;
  updated_at: string;
}

export async function getMyRating(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<RatingRow | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("ratings")
      .select("user_id, tmdb_id, media_type, rating, review, title, poster_path, updated_at")
      .eq("user_id", user.id)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();
    return (data as RatingRow) ?? null;
  } catch {
    return null;
  }
}

/** تقييمات مستخدم معيّن مرتّبة من الأعلى */
export async function getRatingsOf(userId: string): Promise<RatingRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ratings")
      .select("user_id, tmdb_id, media_type, rating, review, title, poster_path, updated_at")
      .eq("user_id", userId)
      .order("rating", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    return (data as RatingRow[]) ?? [];
  } catch {
    return [];
  }
}

/** متوسط تقييمات كل المستخدمين لعمل معيّن */
export async function getCommunityRating(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<{ avg: number; count: number; reviews: RatingRow[] }> {
  const empty = { avg: 0, count: 0, reviews: [] as RatingRow[] };
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ratings")
      .select("user_id, tmdb_id, media_type, rating, review, title, poster_path, updated_at")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .order("updated_at", { ascending: false })
      .limit(100);
    const rows = (data as RatingRow[]) ?? [];
    if (!rows.length) return empty;
    const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
    return { avg, count: rows.length, reviews: rows.filter((r) => r.review?.trim()).slice(0, 10) };
  } catch {
    return empty;
  }
}

// ================= متابعة المستخدمين =================

export interface PublicProfile {
  id: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  favorite_genres: number[];
}

export async function getProfileByUsername(username: string): Promise<PublicProfile | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, username, avatar_url, cover_url, favorite_genres")
      .ilike("username", username)
      .maybeSingle();
    if (!data) return null;
    return { ...data, favorite_genres: data.favorite_genres ?? [] } as PublicProfile;
  } catch {
    return null;
  }
}

export async function getFollowStats(
  userId: string,
): Promise<{ followers: number; following: number }> {
  try {
    const supabase = await createClient();
    const [a, b] = await Promise.all([
      supabase
        .from("user_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", userId),
      supabase
        .from("user_follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", userId),
    ]);
    return { followers: a.count ?? 0, following: b.count ?? 0 };
  } catch {
    return { followers: 0, following: 0 };
  }
}

export async function amIFollowing(targetId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .eq("following_id", targetId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/** الأشخاص الذين أتابعهم — لعرض تقييماتهم أو اقتراحهم */
export async function getFollowedPeople(): Promise<PublicProfile[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: ids } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .limit(100);
    const list = (ids ?? []).map((r) => r.following_id);
    if (!list.length) return [];
    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, username, avatar_url, cover_url, favorite_genres")
      .in("id", list);
    return ((data ?? []) as PublicProfile[]).map((p) => ({
      ...p,
      favorite_genres: p.favorite_genres ?? [],
    }));
  } catch {
    return [];
  }
}
