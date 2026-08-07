import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { episodeKey } from "@/lib/keys";

export { episodeKey };

export interface FollowRow {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  added_at: string;
  // إحصاءات مخزّنة تُغني المكتبة عن طلب TMDB لكل مسلسل
  total_episodes?: number | null;
  aired_episodes?: number | null;
  next_air_date?: string | null;
  /** بطاقة حمراء: موقوفٌ عند صاحبه — يبقى بالمكتبة ويغيب عن الرئيسية */
  dropped?: boolean | null;
  /** إعادة المشاهدة: عدد الدورات، ولحظة بدء الدورة الحالية */
  rewatch_count?: number | null;
  rewatch_started_at?: string | null;
  /** آخر تخزين للإحصاءات — غيابه يعني أن تاريخ الفيلم لم يُخبَّأ بعد */
  stats_updated_at?: string | null;
}

export interface WatchedEpisodeRow {
  show_tmdb_id: number;
  season_number: number;
  episode_number: number;
  watched_at: string;
  runtime: number | null;
}

/**
 * المستخدم الحالي.
 *
 * `auth.getUser()` ليست قراءة محلية — إنها رحلة شبكة كاملة لخادم Supabase
 * للتحقق من التوكن. كانت تُستدعى ٥ مرات في رسم الصفحة الواحدة (proxy،
 * التخطيط، الشريط العلوي مرتين، الصفحة نفسها) فتضيف ~٦٥٠ مللي ثانية لكل
 * طلب مهما كانت الصفحة. `cache()` تجعلها رحلة واحدة لكل طلب.
 */
export const getUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

export interface Profile {
  id: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  /** التموضع الرأسي للصورتين (٠ أعلى — ١٠٠ أسفل) — انظر image_positions.sql */
  cover_pos?: number | null;
  avatar_pos?: number | null;
  theme: string | null;
  favorite_genres: number[];
  hide_name?: boolean | null;
  home_prefs?: unknown;
}

/** الملف الشخصي — يُقرأ في التخطيط والشريط العلوي والصفحة، فيُخزَّن لكل طلب */
export const getProfile = cache(async (): Promise<Profile | null> => {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return null;

    // eslint-disable-next-line prefer-const
    let { data, error } = await supabase
      .from("profiles")
      .select(
        "id, nickname, username, avatar_url, cover_url, cover_pos, avatar_pos, theme, favorite_genres, hide_name, home_prefs",
      )
      .eq("id", user.id)
      .maybeSingle();

    // الاحتياط لعمودٍ ناقص لا لصفٍّ غير موجود: الحساب الجديد بلا صفّ يُرجع
    // null بلا خطأ، وكان يدفع استعلاماً ثانياً ضائعاً في كل طلب
    if (error) {
      // درجتان من التراجع لا واحدة: العمود الأحدث وحده هو الغائب غالباً،
      // والسقوط مباشرةً إلى أقدم قائمة أعمدة كان يُفقد الغلاف والثيم —
      // ظهر ذلك عياناً حين نُشر الكود قبل تشغيل ملف SQL الخاص بعموده
      const mid = await supabase
        .from("profiles")
        .select("id, nickname, username, avatar_url, cover_url, theme, favorite_genres, hide_name")
        .eq("id", user.id)
        .maybeSingle();
      if (mid.data) {
        // عمودا التموضع أحدث من هذه الدرجة — يسقطان إلى سلوكهما القديم
        data = { ...mid.data, cover_pos: null, avatar_pos: null, home_prefs: null };
      } else {
        const legacy = await supabase
          .from("profiles")
          .select("id, nickname, username, avatar_url, favorite_genres")
          .eq("id", user.id)
          .maybeSingle();
        if (legacy.data) {
          data = {
            ...legacy.data,
            cover_url: null,
            cover_pos: null,
            avatar_pos: null,
            theme: null,
            hide_name: false,
            home_prefs: null,
          };
        }
      }
    }

    // احتياط أخير: لو الجدول لسه ما اتنشأ أو الصف ناقص، استخدم بيانات حساب Google
    if (!data) {
      return {
        id: user.id,
        nickname: (user.user_metadata?.full_name as string | undefined) ?? null,
        // معرّف عشوائي لا بداية الإيميل: المعرّف يُنشر ويُبحث، وبداية
        // الإيميل هوية لم يخترها صاحبها
        username: `user_${user.id.replace(/-/g, "").slice(0, 8)}`,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        cover_url: null,
        cover_pos: null,
        avatar_pos: null,
        theme: null,
        favorite_genres: [],
        hide_name: false,
        home_prefs: null,
      };
    }
    return { ...data, favorite_genres: data.favorite_genres ?? [] } as Profile;
  } catch {
    return null;
  }
});

/**
 * المتابعات — مخزّنة لكل طلب.
 *
 * تُقرأ من الصفحة ومن محرّك الاقتراحات ومن صفحة العمل في الطلب نفسه، وبلا
 * `cache()` كان كلٌّ منها يفتح استعلاماً جديداً على الجدول ذاته.
 */
export const getFollows = cache(async (): Promise<FollowRow[]> => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];

  // فلترة صريحة بالمستخدم: سياسات القراءة العامة على الجدول (لصفحات البروفايل)
  // تعني أن الاستعلام غير المفلتر يرجع صفوف الجميع، لا صفوف صاحب الحساب فقط.
  const { data, error } = await supabase
    .from("follows")
    .select(
      "tmdb_id, media_type, title, poster_path, added_at, total_episodes, aired_episodes, next_air_date, dropped, rewatch_count, rewatch_started_at, stats_updated_at",
    )
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  // احتياط: لو أعمدة الإحصاءات لسه ما انضافت، اقرأ الأعمدة الأساسية فقط
  if (error) {
    const base = await supabase
      .from("follows")
      .select("tmdb_id, media_type, title, poster_path, added_at")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });
    return base.data ?? [];
  }

  return data ?? [];
});

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

export async function getWatchedForShow(
  showTmdbId: number,
  /** لحظة بدء الإعادة إن كانت بيد المستدعي — تمريرها يوفّر استعلام المتابعة */
  rewatchSince?: string | null,
): Promise<Set<string>> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return new Set();

  // إعادة المشاهدة: ما أُشِّر قبل لحظة البدء لا يُحسب تقدّماً في الدورة الحالية
  let since: string | null = rewatchSince ?? null;
  if (rewatchSince === undefined) {
    try {
      const { data: fr } = await supabase
        .from("follows")
        .select("rewatch_started_at")
        .eq("user_id", user.id)
        .eq("tmdb_id", showTmdbId)
        .eq("media_type", "tv")
        .maybeSingle();
      since = (fr as { rewatch_started_at?: string | null } | null)?.rewatch_started_at ?? null;
    } catch {
      since = null;
    }
  }

  const rows = await pageAll<{ season_number: number; episode_number: number }>((from, to) => {
    let q = supabase
      .from("watched_episodes")
      .select("season_number, episode_number")
      .eq("user_id", user.id)
      .eq("show_tmdb_id", showTmdbId);
    if (since) q = q.gte("watched_at", since);
    return q
      .order("season_number", { ascending: true })
      .order("episode_number", { ascending: true })
      .range(from, to);
  });
  return new Set(rows.map((r) => episodeKey(r.season_number, r.episode_number)));
}


/** هل أتابع هذا العمل؟ صفٌّ واحد بدل قراءة كل المتابعات لسؤال بنعم أو لا */
export async function isFollowing(tmdbId: number, mediaType: "tv" | "movie"): Promise<boolean> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("follows")
      .select("tmdb_id")
      .eq("user_id", user.id)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/** هل شاهدت هذا الفيلم؟ صفٌّ واحد بدل ترقيم كل الأفلام المشاهَدة */
export async function isMovieWatched(movieTmdbId: number): Promise<boolean> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("watched_movies")
      .select("movie_tmdb_id")
      .eq("user_id", user.id)
      .eq("movie_tmdb_id", movieTmdbId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export interface WatchSummaryRow {
  show_tmdb_id: number;
  watched: number;
  last_watched: string;
  minutes: number;
}

/**
 * ملخّص المشاهدة: صف واحد لكل مسلسل بدل صف لكل حلقة.
 *
 * الرئيسية والمكتبة كانتا تسحبان كل صفوف الحلقات المشاهَدة — آلاف الصفوف
 * لمن يتابع مسلسلات طويلة — لمجرّد حساب العدّادات. الآن يجمع Postgres.
 * لو لم تُشغَّل دالة SQL بعد، نرجع للطريقة القديمة تلقائياً.
 */
export async function getWatchSummary(): Promise<WatchSummaryRow[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("watch_summary");
    if (error || !data) return null;
    return (data as WatchSummaryRow[]).map((r) => ({
      ...r,
      watched: Number(r.watched),
      minutes: Number(r.minutes),
    }));
  } catch {
    return null;
  }
}

export async function getAllWatchedEpisodes(): Promise<WatchedEpisodeRow[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];
  return pageAll<WatchedEpisodeRow>((from, to) =>
    supabase
      .from("watched_episodes")
      .select("show_tmdb_id, season_number, episode_number, watched_at, runtime")
      .eq("user_id", user.id)
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
    const user = await getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("movie_progress")
      .select("movie_tmdb_id, position_minutes, runtime_minutes, title, poster_path")
      .eq("user_id", user.id)
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
    const user = await getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("movie_progress")
      .select("movie_tmdb_id, position_minutes, runtime_minutes, title, poster_path")
      .eq("user_id", user.id)
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

/**
 * عدّادات 🔥 لعناصر محدّدة + تفاعلات المستخدم نفسه.
 *
 * كانت تقرأ جدول التفاعلات كاملاً بلا حدّ — ينمو بلا سقف مع المستخدمين،
 * ويكشف معرّف كل من تفاعل مع أي عمل. الآن: التجميع في Postgres للعناصر
 * الظاهرة فقط، وصفوف المستخدم وحده تُقرأ لمعرفة ما تفاعل معه.
 */
export async function getReactions(ids: number[] = []): Promise<ReactionInfo> {
  const empty: ReactionInfo = { counts: {}, mine: new Set() };
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return empty;

    const unique = [...new Set(ids)].slice(0, 200);
    const counts: Record<string, number> = {};

    if (unique.length) {
      // العدّ من دالة definer حصراً: القراءة المباشرة صارت مقصورة على
      // صفوف المستخدم نفسه، فأي عدٍّ محلي سيكون ناقصاً بصمت
      const { data, error } = await supabase.rpc("reaction_counts", { ids: unique });
      if (!error && data) {
        for (const r of data as { tmdb_id: number; media_type: string; n: number }[]) {
          counts[`${r.media_type}-${r.tmdb_id}`] = Number(r.n);
        }
      }
    }

    const { data: own } = await supabase
      .from("post_reactions")
      .select("tmdb_id, media_type")
      .eq("user_id", user.id)
      .limit(1000);

    const mine = new Set<string>((own ?? []).map((r) => `${r.media_type}-${r.tmdb_id}`));
    return { counts, mine };
  } catch {
    return empty;
  }
}

export async function getWatchedMovieIds(): Promise<Set<number>> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return new Set();
  const rows = await pageAll<{ movie_tmdb_id: number }>((from, to) =>
    supabase
      .from("watched_movies")
      .select("movie_tmdb_id")
      .eq("user_id", user.id)
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
    const user = await getUser();
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

/** كل تقييماتي — تُغذّي محرّك الاقتراحات (بذور للمحبوب، استبعاد للمكروه) */
export async function getMyRatings(): Promise<RatingRow[]> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("ratings")
      .select("user_id, tmdb_id, media_type, rating, review, title, poster_path, updated_at")
      .eq("user_id", user.id)
      .order("rating", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    return (data as RatingRow[]) ?? [];
  } catch {
    return [];
  }
}

/** تقييمات مستخدم معيّن مرتّبة من الأعلى — عبر دالة definer محدودة
 *  الأعمدة والعدد، لأن جدول التقييمات لم يعد مفتوح القراءة */
export async function getRatingsOf(userId: string): Promise<RatingRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("user_ratings", { target: userId });
    if (error) return [];
    return (data as RatingRow[]) ?? [];
  } catch {
    return [];
  }
}

/** متوسط تقييمات كل المستخدمين لعمل معيّن — رقمان مجمّعان من دالة
 *  definer، بلا أي صفّ خام (جدول التقييمات لم يعد مفتوح القراءة).
 *  المراجعات نفسها تأتي من getTitleReviews. */
export async function getCommunityRating(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<{ avg: number; count: number }> {
  const empty = { avg: 0, count: 0 };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("community_rating", {
      t_id: tmdbId,
      m_type: mediaType,
    });
    if (error || !data) return empty;
    const row = (data as { avg_rating: number; votes: number }[])[0];
    if (!row) return empty;
    return { avg: Number(row.avg_rating), count: Number(row.votes) };
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
  cover_pos?: number | null;
  avatar_pos?: number | null;
  favorite_genres: number[];
  hide_name?: boolean | null;
}

/** معرّف UUID كما يكتبه Postgres — يميّز رابط الهوية عن رابط المعرّف */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * الملف العام بالمعرّف أو بالهوية.
 *
 * المعرّف (`username`) اختياريّ ولا يملكه كل حساب: من يدخل بحساب Google
 * ولا يمرّ على شاشة التهيئة يبقى بلا معرّف، فكان صفّه في «المتابِعون»
 * وفي البحث لا يُفتح — لا صفحةَ له تُقصد. فتُقبل الهوية بديلاً: من له
 * معرّف يبقى رابطه بالمعرّف (أنظف وأقبل للمشاركة)، ومن لا معرّف له
 * يُفتح بهويته بدل أن يكون اسماً لا يُنقر.
 */
export async function getProfileByUsername(
  handleOrId: string,
): Promise<PublicProfile | null> {
  // كان هنا `.ilike` — و ILIKE يعامل % و _ كأحرف بديلة، فرابط مثل /u/%
  // كان يطابق أي مستخدم ويسمح بتعداد الحسابات بالتخمين. المطابقة الآن تامّة،
  // وأسماء المستخدمين تُحفظ بحروف صغيرة أصلاً في updateProfile.
  const raw = handleOrId.trim();
  const byId = UUID_RE.test(raw);
  const handle = raw.toLowerCase();
  if (!byId && !/^[a-z0-9_]{1,24}$/.test(handle)) return null;

  const column = byId ? "id" : "username";
  const value = byId ? raw : handle;

  try {
    const supabase = await createClient();
    // العرض العام لا الجدول: الجدول صار مقصوراً على صاحبه، والعرض يحمل
    // الأعمدة العامة وحدها (انظر supabase/public_profiles.sql)
    const { data, error } = await supabase
      .from("public_profiles")
      .select("id, nickname, username, avatar_url, cover_url, cover_pos, avatar_pos, favorite_genres, hide_name")
      .eq(column, value)
      .maybeSingle();

    // احتياط لو عمود إخفاء الاسم لم يُضَف بعد
    if (error) {
      const legacy = await supabase
        .from("public_profiles")
        .select("id, nickname, username, avatar_url, cover_url, favorite_genres")
        .eq(column, value)
        .maybeSingle();
      if (!legacy.data) return null;
      return {
        ...legacy.data,
        favorite_genres: legacy.data.favorite_genres ?? [],
        cover_pos: null,
        avatar_pos: null,
        hide_name: false,
      } as PublicProfile;
    }

    if (!data) return null;
    return { ...data, favorite_genres: data.favorite_genres ?? [] } as PublicProfile;
  } catch {
    return null;
  }
}

/**
 * عدد الإعجابات التي تلقّاها المستخدم على مراجعاته.
 *
 * `head: true` مع `count: "exact"` تُرجع العدد بلا صفوف: الترويسة تحتاج
 * رقماً لا قائمة. والجدول قد لا يكون منشأً بعد (`supabase/likes.sql`)،
 * فالفشل يُرجع صفراً ولا يُسقط الصفحة.
 */
/** مكتبة مستخدمٍ آخر — القراءة العامة أُذن بها في سياسات الجداول */
export async function getFollowsOf(userId: string): Promise<FollowRow[]> {
  try {
    // جداول المكتبة مقصورة على صاحبها بالسياسات — القراءة المباشرة كانت
    // ترجع صفراً بصمت. المكتبة عامة بحكم المنتج، فتخرج من دالة definer
    // محدودة الأعمدة والعدد (انظر supabase/security2.sql)
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("user_public_follows", { target: userId });
    if (error) return [];
    return (data as FollowRow[]) ?? [];
  } catch {
    return [];
  }
}

/** مشاهدات مستخدمٍ آخر مجمّعةً: عددٌ لكل مسلسل ومعرّفات أفلامه — من
 *  دوال definer، لا صفوف حلقات ولا أوقات مشاهدة */
export async function getWatchedOf(
  userId: string,
): Promise<{ byShow: Map<number, number>; episodes: number; movies: Set<number> }> {
  const empty = { byShow: new Map<number, number>(), episodes: 0, movies: new Set<number>() };
  try {
    const supabase = await createClient();
    const [eps, mvs] = await Promise.all([
      supabase.rpc("user_watch_overview", { target: userId }),
      supabase.rpc("user_watched_movie_ids", { target: userId }),
    ]);
    const byShow = new Map<number, number>();
    let episodes = 0;
    for (const r of (eps.data ?? []) as { show_tmdb_id: number; watched: number }[]) {
      byShow.set(r.show_tmdb_id, Number(r.watched));
      episodes += Number(r.watched);
    }
    return {
      byShow,
      episodes,
      movies: new Set(
        ((mvs.data ?? []) as { movie_tmdb_id: number }[]).map((m) => m.movie_tmdb_id),
      ),
    };
  } catch {
    return empty;
  }
}

/** رأيٌ في خطّ المجتمع: صاحبه وعمله ونصّه وإعجاباته */
export interface FeedItem {
  person: PersonLite;
  tmdb_id: number;
  media_type: "tv" | "movie";
  rating: number;
  review: string;
  title: string | null;
  poster_path: string | null;
  updated_at: string;
  likes: number;
  likedByMe: boolean;
}

/**
 * خطّ الآراء: مراجعات من تتابعهم وحدهم، والأكثر إعجاباً أولاً.
 *
 * ثلاث قراءات متوازية بعد جلب قائمة المتابَعين — المراجعات والإعجابات
 * والملفات — ثم يُجمَّع كل شيء في الذاكرة: الخط يُبنى من ستين مراجعة
 * على الأكثر، والفرز بالإعجاب يحتاج العدّ كاملاً قبل الترتيب فلا ينفع
 * فيه ترقيم الخادم.
 */
export async function getCommunityFeed(): Promise<FeedItem[]> {
  try {
    const supabase = await createClient();
    const me = await getUser();
    if (!me) return [];

    // نشاط المتابَعين من دالة definer — جدول التقييمات لم يعد مفتوح
    // القراءة، والدالة تُرجع الأعمدة العامة وحدها مع إخفاء الاسم منفَّذاً
    // في SQL (انظر supabase/security.sql)
    const { data: actRows, error } = await supabase.rpc("following_activity");
    if (error || !actRows) return [];

    type ActivityRow = {
      id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean;
      tmdb_id: number;
      media_type: "tv" | "movie";
      rating: number;
      review: string | null;
      title: string | null;
      poster_path: string | null;
      updated_at: string;
    };
    const reviews = (actRows as ActivityRow[]).filter((r) => r.review?.trim());
    if (!reviews.length) return [];

    // إعجابات كل هذه المراجعات في نداء واحد — أعدادٌ و«هل أعجبتُ به»،
    // بلا أي معرّف مُعجِب
    const uids = [...new Set(reviews.map((r) => r.id))];
    const likeKey = (u: string, t2: number, m: string) => `${u}|${t2}|${m}`;
    const counts = new Map<string, number>();
    const mine = new Set<string>();
    const { data: likeRows } = await supabase.rpc("feed_review_likes", { uids });
    for (const l of (likeRows ?? []) as {
      review_user_id: string;
      tmdb_id: number;
      media_type: string;
      likes: number;
      liked_by_me: boolean;
    }[]) {
      const k = likeKey(l.review_user_id, l.tmdb_id, l.media_type);
      counts.set(k, Number(l.likes));
      if (l.liked_by_me) mine.add(k);
    }

    return reviews
      .map((r) => {
        const k = likeKey(r.id, r.tmdb_id, r.media_type);
        return {
          person: {
            id: r.id,
            nickname: r.nickname,
            username: r.username,
            avatar_url: r.avatar_url,
            hide_name: r.hide_name,
          } as PersonLite,
          tmdb_id: r.tmdb_id,
          media_type: r.media_type,
          rating: r.rating,
          review: r.review!.trim(),
          title: r.title,
          poster_path: r.poster_path,
          updated_at: r.updated_at,
          likes: counts.get(k) ?? 0,
          likedByMe: mine.has(k),
        };
      })
      .sort((a, b) => b.likes - a.likes || b.updated_at.localeCompare(a.updated_at));
  } catch {
    return [];
  }
}

export async function getReceivedLikes(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("received_likes", { target: userId });
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
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
    const user = await getUser();
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
    const user = await getUser();
    if (!user) return [];
    const { data: ids } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .limit(100);
    const list = (ids ?? []).map((r) => r.following_id);
    if (!list.length) return [];
    const { data } = await supabase
      .from("public_profiles")
      .select("id, nickname, username, avatar_url, cover_url, favorite_genres, hide_name")
      .in("id", list);
    return ((data ?? []) as PublicProfile[]).map((p) => ({
      ...p,
      favorite_genres: p.favorite_genres ?? [],
    }));
  } catch {
    return [];
  }
}

// ================= الطبقة الاجتماعية =================

export interface PersonLite {
  id: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  hide_name: boolean;
}

/** الاسم المعروض مع احترام خيار الإخفاء */
export function displayNameOf(
  p: { nickname: string | null; username: string | null; hide_name?: boolean | null },
  anonymousLabel: string,
): string {
  if (p.hide_name) return anonymousLabel;
  return p.nickname || p.username || anonymousLabel;
}

/** بحث عن أشخاص بالاسم أو المعرّف — الأحرف البديلة تُهرَّب داخل الدالة */
export async function searchPeople(q: string): Promise<PersonLite[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_people", { q: term });
    if (error || !data) return [];
    return data as PersonLite[];
  } catch {
    return [];
  }
}

export interface ActivityRow extends PersonLite {
  tmdb_id: number;
  media_type: "tv" | "movie";
  rating: number;
  review: string | null;
  title: string | null;
  poster_path: string | null;
  updated_at: string;
}

/** آخر تقييمات ومراجعات من تتابعهم */
export async function getFollowingActivity(): Promise<ActivityRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("following_activity");
    if (error || !data) return [];
    return data as ActivityRow[];
  } catch {
    return [];
  }
}

export interface TitleReview extends PersonLite {
  rating: number;
  review: string | null;
  updated_at: string;
  /** عدد الإعجابات، وهل أعجبتُ بها، وهل هي مراجعتي */
  likes: number;
  likedByMe: boolean;
  isMine: boolean;
}

/** مراجعات عمل معيّن مع أصحابها */
export async function getTitleReviews(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<TitleReview[]> {
  try {
    const supabase = await createClient();
    const [{ data, error }, me] = await Promise.all([
      supabase.rpc("title_reviews", { t_id: tmdbId, m_type: mediaType }),
      getUser(),
    ]);
    if (error || !data) return [];
    const rows = data as Omit<TitleReview, "likes" | "likedByMe" | "isMine">[];
    if (!rows.length) return [];

    // إعجابات العمل كلها في نداءٍ واحد على دالة definer تُرجع الأعداد
    // و«هل أعجبتُ به أنا» فقط — من أعجب بماذا لم يعد يُقرأ
    const counts = new Map<string, number>();
    const mine = new Set<string>();
    const { data: likeRows } = await supabase.rpc("title_review_likes", {
      t_id: tmdbId,
      m_type: mediaType,
    });
    for (const l of (likeRows ?? []) as {
      review_user_id: string;
      likes: number;
      liked_by_me: boolean;
    }[]) {
      counts.set(l.review_user_id, Number(l.likes));
      if (l.liked_by_me) mine.add(l.review_user_id);
    }

    return rows.map((r) => ({
      ...r,
      likes: counts.get(r.id) ?? 0,
      likedByMe: mine.has(r.id),
      isMine: me?.id === r.id,
    }));
  } catch {
    return [];
  }
}

/** يسجّل زيارة للملف (يتجاهل زيارة صاحبه ويتجاهل التكرار اليومي) */
export async function recordProfileView(targetId: string): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("record_profile_view", { target: targetId });
  } catch {
    // العدّاد تحسين لا أكثر
  }
}

export async function getProfileViewCount(targetId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("profile_view_count", { target: targetId });
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}

/** الأشخاص الذين يتابعون هذا الملف والذين يتابعهم — لعرضهم على الصفحة */
export async function getFollowLists(
  userId: string,
): Promise<{ followers: PersonLite[]; following: PersonLite[] }> {
  const empty = { followers: [] as PersonLite[], following: [] as PersonLite[] };
  try {
    const supabase = await createClient();
    const [a, b] = await Promise.all([
      supabase.from("user_follows").select("follower_id").eq("following_id", userId).limit(50),
      supabase.from("user_follows").select("following_id").eq("follower_id", userId).limit(50),
    ]);
    const ids = [
      ...(a.data ?? []).map((r) => r.follower_id),
      ...(b.data ?? []).map((r) => r.following_id),
    ];
    if (!ids.length) return empty;

    const { data: people } = await supabase
      .from("public_profiles")
      .select("id, nickname, username, avatar_url, hide_name")
      .in("id", [...new Set(ids)]);

    const byId = new Map((people ?? []).map((p) => [p.id, p as PersonLite]));
    return {
      followers: (a.data ?? []).map((r) => byId.get(r.follower_id)).filter(Boolean) as PersonLite[],
      following: (b.data ?? []).map((r) => byId.get(r.following_id)).filter(Boolean) as PersonLite[],
    };
  } catch {
    return empty;
  }
}

// ============================================================
//  لوحة الصدارة
// ============================================================

export interface LeaderRow {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string | null;
  poster_path: string | null;
  /** متوسط تقييم مجتمع مشاهد (١–٥) — للأعلى تقييماً فقط */
  avg_rating?: number | null;
  /** عدد مقيّمي مشاهد */
  votes?: number | null;
  /** مَن أضافه لمكتبته في المدة */
  followers?: number | null;
  /** مَن شاهد منه شيئاً في المدة */
  viewers?: number | null;
  /** مجموع الحلقات المؤشّرة في المدة */
  episodes?: number | null;
  score?: number | null;
}

/**
 * الأعلى تقييماً في مجتمع مشاهد خلال مدة.
 * days = 0 تعني «كل الوقت».
 */
export async function getTopRated(days = 7): Promise<LeaderRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("top_rated_period", { days });
    if (error || !data) return [];
    return data as LeaderRow[];
  } catch {
    return [];
  }
}

/** الأكثر مشاهدة في مجتمع مشاهد خلال مدة (متابعات + حلقات مؤشّرة) */
export async function getMostWatched(days = 7): Promise<LeaderRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("most_watched_period", { days });
    if (error || !data) return [];
    return data as LeaderRow[];
  } catch {
    return [];
  }
}

// ============================================================
//  سجلّ المشاهدة
// ============================================================

export interface HistoryRow {
  kind: "episode" | "movie";
  tmdbId: number;
  /** الموسم والحلقة — للحلقات فقط */
  season?: number;
  episode?: number;
  watchedAt: string;
  runtime: number | null;
}

/**
 * كل ما شاهدته مرتّباً من الأحدث.
 *
 * الحلقات والأفلام في قائمة واحدة: السجلّ يُقرأ بالزمن لا بنوع العمل، ومن
 * يتذكّر «شفت شيئاً ليلة الخميس» لا يتذكّر إن كان فيلماً أم حلقة.
 */
export async function getWatchHistory(limit = 400): Promise<HistoryRow[]> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];
    // شرط المستخدم صريح في الاستعلام: RLS يحمي فعلاً، لكن الاستعلام الذي
    // «يقرأ الجدول كله ويثق أن السياسة سترشّح» ينكسر بصمتٍ كارثي لو
    // تبدّلت سياسة يوماً — الدفاع طبقتان لا واحدة
    const [eps, movies] = await Promise.all([
      supabase
        .from("watched_episodes")
        .select("show_tmdb_id, season_number, episode_number, watched_at, runtime")
        .eq("user_id", user.id)
        .order("watched_at", { ascending: false })
        .limit(limit),
      supabase
        .from("watched_movies")
        .select("movie_tmdb_id, watched_at, runtime")
        .eq("user_id", user.id)
        .order("watched_at", { ascending: false })
        .limit(limit),
    ]);

    const rows: HistoryRow[] = [
      ...((eps.data ?? []) as WatchedEpisodeRow[]).map((e) => ({
        kind: "episode" as const,
        tmdbId: e.show_tmdb_id,
        season: e.season_number,
        episode: e.episode_number,
        watchedAt: e.watched_at,
        runtime: e.runtime,
      })),
      ...((movies.data ?? []) as { movie_tmdb_id: number; watched_at: string; runtime: number | null }[]).map(
        (m) => ({
          kind: "movie" as const,
          tmdbId: m.movie_tmdb_id,
          watchedAt: m.watched_at,
          runtime: m.runtime,
        }),
      ),
    ];

    return rows.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt)).slice(0, limit);
  } catch {
    return [];
  }
}

// ============================================================
//  القوائم الشخصية
// ============================================================

export interface UserList {
  id: string;
  name: string;
  /** سطرٌ واحد يشرح غرض القائمة — ملكُ القائمة لا القارئ (lists3.sql) */
  subtitle: string | null;
  kind: ListKind;
  is_public: boolean;
  created_at: string;
  item_count: number;
  /** عدّ المسلسلات/الأفلام داخل القائمة (my_lists) — اختياريان قبل تشغيل SQL */
  shows_count?: number;
  movies_count?: number;
  posters: string[] | null;
}

/** نوع القائمة — هو ما يقرّر هل للترتيب اليدوي وأرقامه معنى (lists2.sql) */
export type ListKind = "regular" | "ranked" | "watch_order";

export interface ListItem {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string | null;
  poster_path: string | null;
  added_at: string;
  sort_order: number | null;
}

/** قوائمي مع عدد عناصر كل واحدة — استعلام واحد لا استعلام لكل قائمة */
export async function getMyLists(): Promise<UserList[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_lists");
    if (error || !data) return [];
    return data as UserList[];
  } catch {
    return [];
  }
}

/**
 * قائمة واحدة بعناصرها — تُرجع null لو لم تكن لك ولا معلنة.
 *
 * الترتيب: `sort_order` أولاً والفارغ آخراً، ثم `added_at` تنازلياً. فالقائمة
 * التي لم تُرتَّب يدوياً تظهر كما كانت تماماً — لا هجرة بيانات ولا تغيّر سلوك.
 *
 * والتقييمات تُقرأ في استعلامٍ ثانٍ من جدول `ratings` (مفتاحه
 * user_id+tmdb_id+media_type فالقراءة فهرسية): تقييمُ القارئ نفسه لا تقييمُ
 * TMDB — الأول نملكه ولا يكلّف طلباً خارجياً، والثاني كان سيعني طلب TMDB
 * لكل عملٍ في صفحةٍ بُنيت عمداً على ألّا تطلب TMDB إطلاقاً.
 */
export async function getList(listId: string): Promise<{
  list: {
    id: string;
    name: string;
    subtitle: string | null;
    is_public: boolean;
    user_id: string;
    kind: ListKind;
  };
  items: ListItem[];
  ratings: Record<string, number>;
} | null> {
  if (!/^[0-9a-f-]{36}$/i.test(listId)) return null;
  try {
    const supabase = await createClient();
    const { data: list } = await supabase
      .from("user_lists")
      .select("id, name, subtitle, is_public, user_id, kind")
      .eq("id", listId)
      .maybeSingle();
    if (!list) return null;

    const { data: items } = await supabase
      .from("user_list_items")
      .select("tmdb_id, media_type, title, poster_path, added_at, sort_order")
      .eq("list_id", listId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("added_at", { ascending: false })
      .limit(500);

    const rows = (items ?? []) as ListItem[];

    const ratings: Record<string, number> = {};
    const user = await getUser();
    if (user && rows.length) {
      const { data: rated } = await supabase
        .from("ratings")
        .select("tmdb_id, media_type, rating")
        .eq("user_id", user.id)
        .in("tmdb_id", [...new Set(rows.map((r) => r.tmdb_id))]);
      for (const r of rated ?? []) {
        ratings[`${r.media_type}-${r.tmdb_id}`] = r.rating as number;
      }
    }

    return { list: { ...list, kind: (list.kind ?? "regular") as ListKind }, items: rows, ratings };
  } catch {
    return null;
  }
}

/** أي قوائمي تحتوي هذا العمل — لتعليم الأزرار في صفحة العمل */
export async function getListsContaining(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<string[]> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];
    // القيد على قوائم المستخدم نفسه: RLS تسمح أيضاً بقراءة عناصر القوائم
    // المُعلنة، فبدون هذا الشرط كانت مؤشرات «موجود في قائمة» تلتقط قوائم
    // الآخرين العامة التي تصادف احتواءها العمل
    const { data } = await supabase
      .from("user_list_items")
      .select("list_id, user_lists!inner(user_id)")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .eq("user_lists.user_id", user.id);
    return (data ?? []).map((r) => r.list_id as string);
  } catch {
    return [];
  }
}
