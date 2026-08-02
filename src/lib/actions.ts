"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MediaType } from "@/lib/tmdb";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجّل الدخول");
  return { supabase, user };
}

export async function updateProfile(input: {
  nickname: string;
  username?: string;
  avatarUrl: string | null;
  favoriteGenres: number[];
}) {
  const { supabase, user } = await requireUser();

  const nickname = input.nickname.trim().slice(0, 40);
  const username = (input.username ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);

  const payload: Record<string, unknown> = {
    id: user.id,
    nickname: nickname || null,
    avatar_url: input.avatarUrl,
    favorite_genres: input.favoriteGenres,
    updated_at: new Date().toISOString(),
  };
  if (input.username !== undefined) payload.username = username || null;

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    // 23505 = تعارض في فهرس فريد (اسم المستخدم محجوز)
    if (error.code === "23505") throw new Error("اسم المستخدم محجوز، جرّب غيره.");
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");
}

export async function follow(input: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
}) {
  const { supabase, user } = await requireUser();
  await supabase.from("follows").upsert(
    {
      user_id: user.id,
      tmdb_id: input.tmdbId,
      media_type: input.mediaType,
      title: input.title,
      poster_path: input.posterPath,
    },
    { onConflict: "user_id,tmdb_id,media_type" },
  );
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/${input.mediaType === "tv" ? "show" : "movie"}/${input.tmdbId}`);
}

export async function unfollow(input: { tmdbId: number; mediaType: MediaType }) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("follows")
    .delete()
    .match({ user_id: user.id, tmdb_id: input.tmdbId, media_type: input.mediaType });
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/${input.mediaType === "tv" ? "show" : "movie"}/${input.tmdbId}`);
}

export async function toggleEpisode(input: {
  showTmdbId: number;
  season: number;
  episode: number;
  runtime: number | null;
  watched: boolean;
}) {
  const { supabase, user } = await requireUser();
  if (input.watched) {
    await supabase.from("watched_episodes").upsert(
      {
        user_id: user.id,
        show_tmdb_id: input.showTmdbId,
        season_number: input.season,
        episode_number: input.episode,
        runtime: input.runtime,
      },
      { onConflict: "user_id,show_tmdb_id,season_number,episode_number" },
    );
  } else {
    await supabase.from("watched_episodes").delete().match({
      user_id: user.id,
      show_tmdb_id: input.showTmdbId,
      season_number: input.season,
      episode_number: input.episode,
    });
  }
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/show/${input.showTmdbId}`);
}

// تأشير حلقة وكل ما قبلها كمشاهَد (اختيار الحلقة ٥٠ يعني مشاهدة ١..٥٠)
export async function watchUpTo(input: {
  showTmdbId: number;
  episodes: { season: number; episode: number; runtime: number | null }[];
}) {
  const { supabase, user } = await requireUser();
  if (!input.episodes.length) return;

  const rows = input.episodes.map((e) => ({
    user_id: user.id,
    show_tmdb_id: input.showTmdbId,
    season_number: e.season,
    episode_number: e.episode,
    runtime: e.runtime,
  }));

  const { error } = await supabase
    .from("watched_episodes")
    .upsert(rows, { onConflict: "user_id,show_tmdb_id,season_number,episode_number" });
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/show/${input.showTmdbId}`);
}

// حفظ موضع التوقف في فيلم لاستئنافه لاحقاً
export async function saveMovieProgress(input: {
  movieTmdbId: number;
  positionMinutes: number;
  runtimeMinutes: number | null;
  title: string;
  posterPath: string | null;
}) {
  const { supabase, user } = await requireUser();

  const max = input.runtimeMinutes ?? 600;
  const pos = Math.max(0, Math.min(Math.round(input.positionMinutes), max));

  // الوصول للنهاية يعني أن الفيلم اكتمل: يُسجَّل كمشاهَد ويُزال من "قيد المشاهدة"
  if (input.runtimeMinutes && pos >= input.runtimeMinutes) {
    await supabase
      .from("watched_movies")
      .upsert(
        { user_id: user.id, movie_tmdb_id: input.movieTmdbId, runtime: input.runtimeMinutes },
        { onConflict: "user_id,movie_tmdb_id" },
      );
    await supabase
      .from("movie_progress")
      .delete()
      .match({ user_id: user.id, movie_tmdb_id: input.movieTmdbId });
  } else if (pos === 0) {
    await supabase
      .from("movie_progress")
      .delete()
      .match({ user_id: user.id, movie_tmdb_id: input.movieTmdbId });
  } else {
    const { error } = await supabase.from("movie_progress").upsert(
      {
        user_id: user.id,
        movie_tmdb_id: input.movieTmdbId,
        position_minutes: pos,
        runtime_minutes: input.runtimeMinutes,
        title: input.title,
        poster_path: input.posterPath,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,movie_tmdb_id" },
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath(`/movie/${input.movieTmdbId}`);
}

// تأشير موسم كامل كمشاهَد أو غير مشاهَد
export async function setSeasonWatched(input: {
  showTmdbId: number;
  episodes: { season: number; episode: number; runtime: number | null }[];
  watched: boolean;
}) {
  const { supabase, user } = await requireUser();
  if (input.watched) {
    const rows = input.episodes.map((e) => ({
      user_id: user.id,
      show_tmdb_id: input.showTmdbId,
      season_number: e.season,
      episode_number: e.episode,
      runtime: e.runtime,
    }));
    await supabase
      .from("watched_episodes")
      .upsert(rows, { onConflict: "user_id,show_tmdb_id,season_number,episode_number" });
  } else {
    const seasons = [...new Set(input.episodes.map((e) => e.season))];
    for (const s of seasons) {
      await supabase
        .from("watched_episodes")
        .delete()
        .match({ user_id: user.id, show_tmdb_id: input.showTmdbId, season_number: s });
    }
  }
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/show/${input.showTmdbId}`);
}

export async function toggleMovieWatched(input: {
  movieTmdbId: number;
  runtime: number | null;
  watched: boolean;
}) {
  const { supabase, user } = await requireUser();
  if (input.watched) {
    await supabase.from("watched_movies").upsert(
      { user_id: user.id, movie_tmdb_id: input.movieTmdbId, runtime: input.runtime },
      { onConflict: "user_id,movie_tmdb_id" },
    );
  } else {
    await supabase
      .from("watched_movies")
      .delete()
      .match({ user_id: user.id, movie_tmdb_id: input.movieTmdbId });
  }
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/movie/${input.movieTmdbId}`);
}
