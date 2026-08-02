"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";

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
  coverUrl?: string | null;
  theme?: string;
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
  if (input.coverUrl !== undefined) payload.cover_url = input.coverUrl;
  if (input.theme !== undefined) payload.theme = input.theme;

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    // 23505 = تعارض في فهرس فريد (اسم المستخدم محجوز)
    if (error.code === "23505")
      throw new Error("اسم المستخدم محجوز، جرّب غيره. / Username is taken, try another.");
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
}

// تبديل لغة الواجهة — تُحفظ في كوكي ليقرأها الخادم وتُخزَّن في الحساب أيضاً
export async function setLocale(value: string) {
  const locale = normalizeLocale(value);

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .upsert({ id: user.id, locale }, { onConflict: "id" });
    }
  } catch {
    // الكوكي كافٍ لعمل التبديل حتى لو تعذّر الحفظ في الحساب
  }

  revalidatePath("/", "layout");
}

// تفاعل 🔥 على منشور في صفحة الأخبار
export async function toggleReaction(input: {
  tmdbId: number;
  mediaType: MediaType;
  on: boolean;
}) {
  const { supabase, user } = await requireUser();

  if (input.on) {
    const { error } = await supabase.from("post_reactions").upsert(
      {
        user_id: user.id,
        tmdb_id: input.tmdbId,
        media_type: input.mediaType,
        reaction: "fire",
      },
      { onConflict: "user_id,tmdb_id,media_type,reaction" },
    );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("post_reactions").delete().match({
      user_id: user.id,
      tmdb_id: input.tmdbId,
      media_type: input.mediaType,
      reaction: "fire",
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/news");
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

// ================= التقييمات والمراجعات =================

export async function saveRating(input: {
  tmdbId: number;
  mediaType: MediaType;
  rating: number;
  review: string;
  title: string;
  posterPath: string | null;
}) {
  const { supabase, user } = await requireUser();

  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  const review = input.review.trim().slice(0, 2000);

  const { error } = await supabase.from("ratings").upsert(
    {
      user_id: user.id,
      tmdb_id: input.tmdbId,
      media_type: input.mediaType,
      rating,
      review: review || null,
      title: input.title,
      poster_path: input.posterPath,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tmdb_id,media_type" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/${input.mediaType === "tv" ? "show" : "movie"}/${input.tmdbId}`);
  revalidatePath("/", "layout");
}

export async function deleteRating(input: { tmdbId: number; mediaType: MediaType }) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("ratings").delete().match({
    user_id: user.id,
    tmdb_id: input.tmdbId,
    media_type: input.mediaType,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/${input.mediaType === "tv" ? "show" : "movie"}/${input.tmdbId}`);
}

// ================= متابعة المستخدمين =================

export async function followUser(targetId: string) {
  const { supabase, user } = await requireUser();
  if (targetId === user.id) throw new Error("لا يمكنك متابعة نفسك / You can't follow yourself");
  const { error } = await supabase
    .from("user_follows")
    .upsert({ follower_id: user.id, following_id: targetId }, { onConflict: "follower_id,following_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function unfollowUser(targetId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_follows")
    .delete()
    .match({ follower_id: user.id, following_id: targetId });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
