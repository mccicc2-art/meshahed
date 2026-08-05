"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { GENRES, type MediaType } from "@/lib/media";
import { THEMES } from "@/lib/themes";
import { sanitizeHomePrefs, type HomePrefs } from "@/lib/homePrefs";

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


/**
 * رسالة فشلٍ واحدة للمستخدم مهما كان الخطأ.
 *
 * نصّ خطأ Postgres يكشف أسماء الجداول والقيود ولا يفيد مستخدماً — يُسجَّل
 * للخادم ويُستبدل برسالةٍ مفهومة.
 */
function fail(error: unknown): never {
  console.error("[action]", error);
  throw new Error("تعذّر إتمام العملية، جرّب مرة أخرى / Something went wrong, try again.");
}

export async function updateProfile(input: {
  nickname: string;
  username?: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  theme?: string;
  favoriteGenres: number[];
  hideName?: boolean;
  homePrefs?: HomePrefs;
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
  // تُنقّى قبل الكتابة كما تُنقّى بعد القراءة: القيمة تمرّ عبر الشبكة
  if (input.homePrefs !== undefined) payload.home_prefs = sanitizeHomePrefs(input.homePrefs);

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    // 23505 = تعارض في فهرس فريد (اسم المستخدم محجوز)
    if (error.code === "23505")
      throw new Error("اسم المستخدم محجوز، جرّب غيره. / Username is taken, try another.");
    fail(error);
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
    if (error) fail(error);
  } else {
    const { error } = await supabase.from("post_reactions").delete().match({
      user_id: user.id,
      tmdb_id: input.tmdbId,
      media_type: input.mediaType,
      reaction: "fire",
    });
    if (error) fail(error);
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
        // طابعٌ جديد مع كل تأشير: إعادة تأشير حلقةٍ في دورة إعادةٍ تحسبها للدورة
        watched_at: new Date().toISOString(),
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

  const now = new Date().toISOString();
  const rows = input.episodes.map((e) => ({
    user_id: user.id,
    show_tmdb_id: input.showTmdbId,
    season_number: e.season,
    episode_number: e.episode,
    runtime: e.runtime,
    watched_at: now,
  }));

  const { error } = await supabase
    .from("watched_episodes")
    .upsert(rows, { onConflict: "user_id,show_tmdb_id,season_number,episode_number" });
  if (error) fail(error);

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
    if (error) fail(error);
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
    const now = new Date().toISOString();
    const rows = input.episodes.map((e) => ({
      user_id: user.id,
      show_tmdb_id: input.showTmdbId,
      season_number: e.season,
      episode_number: e.episode,
      runtime: e.runtime,
      watched_at: now,
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

  const rating = Math.max(1, Math.min(10, Math.round(input.rating)));
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
  if (error) fail(error);

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
  if (error) fail(error);
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
  if (error) fail(error);
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
  if (error) fail(error);
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
  if (error) fail(error);

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
  if (error) fail(error);
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}

export async function deleteList(listId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("user_lists").delete().eq("id", listId);
  if (error) fail(error);
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
    if (error) fail(error);
  } else {
    const { error } = await supabase
      .from("user_list_items")
      .delete()
      .eq("list_id", input.listId)
      .eq("tmdb_id", input.tmdbId)
      .eq("media_type", input.mediaType);
    if (error) fail(error);
  }

  revalidatePath("/lists");
  revalidatePath(`/lists/${input.listId}`);
}

/** مسار ملصق TMDB فقط — لا نقبل عنواناً كاملاً من العميل */
function safeImagePath(path: string | null): string | null {
  if (!path) return null;
  return /^\/[A-Za-z0-9._-]{1,64}$/.test(path) ? path : null;
}

/**
 * إعجابٌ بمراجعة، أو سحبه.
 *
 * المفتاح الأساسي يمنع التكرار، وسياسة الإدراج تمنع الإعجاب بمراجعة
 * النفس — فلا يحتاج هذا الفعل فحصاً قبل الكتابة، والقاعدة هي الحارس.
 */
export async function toggleReviewLike(
  reviewUserId: string,
  tmdbId: number,
  mediaType: "tv" | "movie",
  liked: boolean,
) {
  const { supabase, user } = await requireUser();
  const key = {
    review_user_id: reviewUserId,
    tmdb_id: tmdbId,
    media_type: mediaType,
    liker_id: user.id,
  };

  const { error } = liked
    ? await supabase.from("review_likes").delete().match(key)
    : await supabase.from("review_likes").insert(key);

  if (error) fail(error);
  revalidatePath("/");
  revalidatePath(`/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`);
}

/**
 * «شفته كله»: يعلّم كل الحلقات المعروضة دفعةً واحدة.
 *
 * الصفوف تُبنى من عدّة المواسم في TMDB وتُدرج بدفعةٍ واحدة —
 * `upsert` على المفتاح الفريد فلا يتكرّر ما سبق تعليمه.
 */
export async function markShowWatched(tmdbId: number) {
  const { supabase, user } = await requireUser();
  const { getTv } = await import("@/lib/tmdb");
  const { airedPerSeason } = await import("@/lib/progress");

  const tv = await getTv(tmdbId);
  const per = airedPerSeason(tv);
  const runtime = tv.episode_run_time?.[0] ?? null;
  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const [season, count] of per) {
    for (let ep = 1; ep <= count; ep++) {
      rows.push({
        user_id: user.id,
        show_tmdb_id: tmdbId,
        season_number: season,
        episode_number: ep,
        runtime,
        watched_at: now,
      });
    }
  }
  if (rows.length) {
    const { error } = await supabase
      .from("watched_episodes")
      .upsert(rows, { onConflict: "user_id,show_tmdb_id,season_number,episode_number" });
    if (error) fail(error);
  }
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/show/${tmdbId}`);
}

/**
 * البطاقة الحمراء: إيقاف عملٍ اكتفيتَ منه.
 *
 * لا يُحذف ولا يُعلَّم مشاهداً — يبقى في المكتبة بشريطٍ أحمر ويختفي من
 * صفوف الرئيسية. علامةٌ على صفّ المتابعة نفسه لا جدول جديد.
 */
export async function setDropped(tmdbId: number, mediaType: MediaType, dropped: boolean) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("follows")
    .update({ dropped })
    .match({ user_id: user.id, tmdb_id: tmdbId, media_type: mediaType });
  if (error) fail(error);
  revalidatePath("/");
  revalidatePath("/library");
}

/**
 * 🔁 إعادة المشاهدة: دورةٌ جديدة تُختم بلحظة بدئها.
 *
 * لا صفَّ يُحذف — اليوميات مقدّسة. التقدّم فقط يُحسب من هذه اللحظة
 * فصاعداً، فيرجع المسلسل إلى «أكمل المشاهدة» من الصفر بشارة ×٢.
 */
export async function startRewatch(tmdbId: number) {
  const { supabase, user } = await requireUser();
  const { data: cur, error: readErr } = await supabase
    .from("follows")
    .select("rewatch_count")
    .match({ user_id: user.id, tmdb_id: tmdbId, media_type: "tv" })
    .maybeSingle();
  if (readErr) fail(readErr);
  const { error } = await supabase
    .from("follows")
    .update({
      rewatch_count: ((cur as { rewatch_count?: number | null } | null)?.rewatch_count ?? 0) + 1,
      rewatch_started_at: new Date().toISOString(),
      dropped: false,
    })
    .match({ user_id: user.id, tmdb_id: tmdbId, media_type: "tv" });
  if (error) fail(error);
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/show/${tmdbId}`);
}

/**
 * «+١»: تأشير الحلقة التالية غير المشاهَدة من ضغطةٍ مطوّلة في المكتبة.
 *
 * تجلب مواسم العمل من TMDB وقائمة ما شوهد من قاعدتنا، وتؤشّر أول حلقةٍ
 * معروضة لم تُشاهد بعد — بلا فتح صفحة المسلسل. ترجع رقمها للواجهة،
 * أو null إن لم يبقَ شيء.
 */
export async function markNextEpisode(
  tmdbId: number,
): Promise<{ season: number; episode: number } | null> {
  const { supabase, user } = await requireUser();
  const { getTv } = await import("@/lib/tmdb");
  const { airedPerSeason } = await import("@/lib/progress");

  const tv = await getTv(tmdbId);
  const per = airedPerSeason(tv);

  const { data: watched, error: readErr } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("user_id", user.id)
    .eq("show_tmdb_id", tmdbId)
    .limit(5000);
  if (readErr) fail(readErr);

  const seen = new Set((watched ?? []).map((w) => `${w.season_number}-${w.episode_number}`));

  for (const [season, count] of per) {
    for (let ep = 1; ep <= count; ep++) {
      if (seen.has(`${season}-${ep}`)) continue;
      const { error } = await supabase.from("watched_episodes").upsert(
        {
          user_id: user.id,
          show_tmdb_id: tmdbId,
          season_number: season,
          episode_number: ep,
          runtime: tv.episode_run_time?.[0] ?? null,
          watched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,show_tmdb_id,season_number,episode_number" },
      );
      if (error) fail(error);
      revalidatePath("/");
      revalidatePath("/library");
      revalidatePath(`/show/${tmdbId}`);
      return { season, episode: ep };
    }
  }
  return null;
}
