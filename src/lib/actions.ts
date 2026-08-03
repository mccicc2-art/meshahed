"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { GENRES, type MediaType } from "@/lib/media";
import { THEMES } from "@/lib/themes";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجّل الدخول");
  return { supabase, user };
}

/**
 * لا نقبل إلا روابط صور من مخزن Supabase الخاص بالمشروع.
 *
 * بدون هذا يستطيع مستخدم أن يضع رابط صورة على خادم يملكه، وبما أن الملفات
 * الشخصية عامة فإن كل من يزور صفحته يسرّب عنوان IP ونوع متصفحه لذلك الخادم.
 */
function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return null;

    // مخزن المشروع نفسه
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (base && u.host === new URL(base).host) {
      return u.pathname.startsWith("/storage/v1/object/public/") ? u.toString() : null;
    }

    // صورة حساب Google التي تأتي مع تسجيل الدخول
    if (u.host === "lh3.googleusercontent.com") return u.toString();

    return null;
  } catch {
    return null;
  }
}

export async function updateProfile(input: {
  nickname: string;
  username?: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  theme?: string;
  favoriteGenres: number[];
  hideName?: boolean;
}) {
  const { supabase, user } = await requireUser();

  const nickname = input.nickname.trim().slice(0, 40);
  const username = (input.username ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);

  // الأنواع تُقصر على المعرّفات المعروفة، والصور على مخزن المشروع
  const genres = [...new Set(input.favoriteGenres)]
    .filter((g) => Number.isInteger(g) && GENRES.some((k) => k.id === g))
    .slice(0, 12);

  const payload: Record<string, unknown> = {
    id: user.id,
    nickname: nickname || null,
    avatar_url: safeImageUrl(input.avatarUrl),
    favorite_genres: genres,
    updated_at: new Date().toISOString(),
  };
  if (input.username !== undefined) payload.username = username || null;
  if (input.coverUrl !== undefined) payload.cover_url = safeImageUrl(input.coverUrl);
  if (input.theme !== undefined) {
    payload.theme = THEMES.some((t) => t.id === input.theme) ? input.theme : "amber";
  }
  if (input.hideName !== undefined) payload.hide_name = !!input.hideName;

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

// ================= تخزين إحصاءات المسلسلات =================

/**
 * تحفظ عدد الحلقات المعروضة/الإجمالية مع صف المتابعة.
 * تُستدعى من الرئيسية وصفحة المسلسل (حيث تُطلب بيانات TMDB أصلاً)،
 * فتقرأ المكتبة بعدها من قاعدة البيانات مباشرة بلا أي طلب خارجي.
 */
export async function cacheShowStats(
  rows: { tmdbId: number; total: number; aired: number; nextAirDate: string | null }[],
) {
  if (!rows.length) return;
  try {
    const { supabase, user } = await requireUser();
    const now = new Date().toISOString();
    await Promise.all(
      rows.slice(0, 100).map((r) =>
        supabase
          .from("follows")
          .update({
            total_episodes: r.total,
            aired_episodes: r.aired,
            next_air_date: r.nextAirDate,
            stats_updated_at: now,
          })
          .match({ user_id: user.id, tmdb_id: r.tmdbId, media_type: "tv" }),
      ),
    );
  } catch {
    // التخزين تحسين أداء فقط — فشله لا يجب أن يكسر الصفحة
  }
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

  // التقييم يظهر في صفحة العمل وصفحتي العامة فقط — لا داعي لإبطال التطبيق كاملاً
  revalidatePath(`/${input.mediaType === "tv" ? "show" : "movie"}/${input.tmdbId}`);
  revalidatePath("/");
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
  revalidatePath("/");
}

// ================= متابعة المستخدمين =================

export async function followUser(targetId: string) {
  const { supabase, user } = await requireUser();
  if (targetId === user.id) throw new Error("لا يمكنك متابعة نفسك / You can't follow yourself");
  const { error } = await supabase
    .from("user_follows")
    .upsert({ follower_id: user.id, following_id: targetId }, { onConflict: "follower_id,following_id" });
  if (error) throw new Error(error.message);
  // عدّادات المتابعة تظهر في الرئيسية وصفحات المستخدمين فقط
  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
}

export async function unfollowUser(targetId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_follows")
    .delete()
    .match({ follower_id: user.id, following_id: targetId });
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
}

// ================= الأشخاص =================

/** بحث عن أشخاص — يمرّ عبر دالة SQL تُهرِّب أحرف البحث البديلة */
export async function findPeople(q: string) {
  await requireUser();
  const { searchPeople } = await import("@/lib/data");
  return searchPeople(q);
}

/**
 * يطبّق اختيارات شاشة الانضمام.
 *
 * «شفته كامل» ليس مجرّد وسم: للفيلم يُسجَّل كمشاهَد، وللمسلسل تُؤشَّر كل
 * حلقاته المعروضة فعلاً — وإلا كانت الخطوة الثانية زينة بلا أثر.
 */
export async function applyOnboardingProgress(
  items: { tmdbId: number; mediaType: MediaType; progress: "none" | "some" | "done" }[],
) {
  const { supabase, user } = await requireUser();
  const { getTv, getSeason } = await import("@/lib/tmdb");
  const { airedPerSeason } = await import("@/lib/progress");

  for (const it of items.slice(0, 24)) {
    if (it.progress !== "done") continue;

    if (it.mediaType === "movie") {
      await supabase
        .from("watched_movies")
        .upsert(
          { user_id: user.id, movie_tmdb_id: it.tmdbId, runtime: null },
          { onConflict: "user_id,movie_tmdb_id" },
        );
      continue;
    }

    try {
      const tv = await getTv(it.tmdbId);
      const aired = airedPerSeason(tv);
      const rows: {
        user_id: string;
        show_tmdb_id: number;
        season_number: number;
        episode_number: number;
        runtime: number | null;
      }[] = [];

      for (const [season, count] of aired) {
        if (count <= 0) continue;
        const detail = await getSeason(it.tmdbId, season).catch(() => null);
        for (let e = 1; e <= count; e++) {
          const ep = detail?.episodes.find((x) => x.episode_number === e);
          rows.push({
            user_id: user.id,
            show_tmdb_id: it.tmdbId,
            season_number: season,
            episode_number: e,
            runtime: ep?.runtime ?? tv.episode_run_time?.[0] ?? null,
          });
        }
      }

      // دفعات حتى لا يُرفض الطلب لضخامته
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from("watched_episodes").upsert(rows.slice(i, i + 500), {
          onConflict: "user_id,show_tmdb_id,season_number,episode_number",
        });
      }
    } catch {
      // مسلسل واحد فشل لا يوقف البقية
    }
  }

  revalidatePath("/");
  revalidatePath("/library");
}

// ============================================================
//  القوائم الشخصية
// ============================================================

export async function createList(name: string, isPublic = false): Promise<string | null> {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error("empty name");
  const { supabase, user } = await requireUser();

  // سقف معقول: يمنع إنشاء آلاف القوائم بحلقة برمجية
  const { count } = await supabase
    .from("user_lists")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= 50) throw new Error("too many lists");

  const { data, error } = await supabase
    .from("user_lists")
    .insert({ user_id: user.id, name: clean, is_public: isPublic })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/lists");
  return data?.id ?? null;
}

export async function renameList(listId: string, name: string, isPublic: boolean) {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error("empty name");
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("user_lists")
    .update({ name: clean, is_public: isPublic, updated_at: new Date().toISOString() })
    .eq("id", listId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}

export async function deleteList(listId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("user_lists").delete().eq("id", listId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function toggleInList(input: {
  listId: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  add: boolean;
}) {
  const { supabase } = await requireUser();

  if (input.add) {
    // العنوان والملصق يُخزَّنان مع العنصر حتى تُعرض القائمة بلا طلب TMDB
    const { error } = await supabase.from("user_list_items").upsert(
      {
        list_id: input.listId,
        tmdb_id: input.tmdbId,
        media_type: input.mediaType,
        title: input.title,
        poster_path: safeImagePath(input.posterPath),
      },
      { onConflict: "list_id,tmdb_id,media_type" },
    );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("user_list_items")
      .delete()
      .eq("list_id", input.listId)
      .eq("tmdb_id", input.tmdbId)
      .eq("media_type", input.mediaType);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/lists");
  revalidatePath(`/lists/${input.listId}`);
}

/** مسار ملصق TMDB فقط — لا نقبل عنواناً كاملاً من العميل */
function safeImagePath(path: string | null): string | null {
  if (!path) return null;
  return /^\/[A-Za-z0-9._-]{1,64}$/.test(path) ? path : null;
}
