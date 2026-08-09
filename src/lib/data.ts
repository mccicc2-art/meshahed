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
  /** نبذةٌ قصيرة — اختيارية، وتغيب قبل تشغيل profile_bio.sql */
  bio?: string | null;
  /** حسابٌ خاص: المتابعة بطلبٍ يُقبل (follow_requests.sql) */
  is_private?: boolean | null;
  /** قفل قائمتَي المتابعة (هجرة 43) */
  hide_follow_lists?: boolean | null;
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
        "id, nickname, username, avatar_url, cover_url, cover_pos, avatar_pos, theme, favorite_genres, hide_name, home_prefs, bio, is_private, hide_follow_lists",
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
        data = { ...mid.data, cover_pos: null, avatar_pos: null, home_prefs: null, bio: null, is_private: null, hide_follow_lists: null };
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
            bio: null,
            is_private: null,
            hide_follow_lists: null,
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

/**
 * الأفلام المُشاهَدة بمدّة كلٍّ منها — لحساب ساعات المشاهدة بدقّة.
 *
 * الثغرة التي تسدّها: الإحصائيات كانت تعدّ كل فيلمٍ **١١٠ دقيقة** ثابتة
 * (`watchedMovieIds.size * 110`)، فالفيلم الطويل والقصير سواء، وبطاقة
 * المشاركة كانت تُسقط الأفلام من الوقت أصلاً. المدّة مخزّنة عند وضع علامة
 * المشاهدة (`toggleMovieWatched`)، فنقرأها ونجمعها فعلاً بدل التقدير.
 */
export async function getWatchedMovies(): Promise<{ id: number; runtime: number | null }[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];
  const rows = await pageAll<{ movie_tmdb_id: number; runtime: number | null }>((from, to) =>
    supabase
      .from("watched_movies")
      .select("movie_tmdb_id, runtime")
      .eq("user_id", user.id)
      .order("movie_tmdb_id", { ascending: true })
      .range(from, to),
  );
  return rows.map((r) => ({ id: r.movie_tmdb_id, runtime: r.runtime }));
}

/** إجمالي دقائق الأفلام — المدّة الفعلية، وبديلٌ ١١٠ لِما لا مدّةَ له فقط */
export function watchedMovieMinutes(rows: { runtime: number | null }[]): number {
  return rows.reduce((n, r) => n + (r.runtime ?? 110), 0);
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
  bio?: string | null;
  /** حسابٌ خاص — القفل حالةٌ معلنة (profile_visibility.sql) */
  is_private?: boolean | null;
  /** قفل قائمتَي المتابعة (هجرة 43) — غيابه قبل تشغيلها = false */
  hide_follow_lists?: boolean | null;
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
      .select("id, nickname, username, avatar_url, cover_url, cover_pos, avatar_pos, favorite_genres, hide_name, bio, is_private")
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
        is_private: null,
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
/** نوع حدث الخطّ — الأولوية في SQL، والصياغة في `feedLine` (D-123) */
export type FeedKind = "rate" | "movie" | "episodes" | "add";

export interface FeedItem {
  person: PersonLite;
  kind: FeedKind;
  tmdb_id: number;
  media_type: "tv" | "movie";
  /** رقمٌ للتقييم وحده — المشاهدة حدثٌ بلا رأي */
  rating: number | null;
  /** نصّ المراجعة إن كُتب؛ التقييم المجرّد صفٌّ بلا فقرة */
  review: string | null;
  title: string | null;
  poster_path: string | null;
  updated_at: string;
  /** يوم الحدث (UTC) — مفتاح التجميع، ويدخل في مفتاح الرسم */
  day: string;
  /** عدد حلقات ذلك اليوم وأعلى موسم — يلتقطهما التقييم إن ابتلع المشاهدة */
  episodeCount: number;
  topSeason: number;
  likes: number;
  likedByMe: boolean;
}

/**
 * خطّ النشاط: ما فعلته دائرتك، لا ما كتبته وحده (**D-123**).
 *
 * كان الخطّ حتى اليوم مراجعاتٍ مكتوبةً فقط — كلُّ تقييمٍ بلا نصّ كان
 * يُسقَط هنا في الكود. فمن شاهد موسماً كاملاً ولم يكتب شيئاً لم يحدث في
 * نظر التطبيق، والنتيجة خطٌّ صامتٌ يبدو ميتاً وإن كانت الدائرة نشطة.
 * `following_activity_v2` (هجرة ٤٥) تفتحه لأربعة أنواع — تقييم، فيلم،
 * حلقات، إضافة — **مجمّعةً صفّاً واحداً لكل (شخص + عمل + يوم)** كي لا
 * يدفن من شاهد اثنتي عشرة حلقةً دائرته باثني عشر سطراً.
 *
 * `mode` يبقى الفرق الوحيد بين التبويبين، ودالّةٌ واحدة تخدمهما (D-042):
 * «مجتمعي» من الدالّة الجديدة، و«المجتمع» من `community_activity` بشكلها
 * القديم (مراجعات فقط) — تُطبَّع هنا إلى `kind: "rate"` فيبقى النوع واحداً
 * في الواجهة مهما اختلف مصدره.
 *
 * **الإعجاب على التقييمات وحدها اليوم**: `feed_review_likes` مفتاحه
 * المراجعة، وأحداث المشاهدة لا مراجعة لها. إعجابُ الحدث يحتاج
 * `activity_likes` (D-124) — وحتى تُشحن، أزرارُ الإعجاب تظهر على صفوف
 * التقييم فقط، وهو أصدق من زرٍّ لا يكتب شيئاً.
 */
export async function getCommunityFeed(
  mode: "following" | "all" = "following",
): Promise<FeedItem[]> {
  try {
    const supabase = await createClient();
    const me = await getUser();
    if (!me) return [];

    // نشاط المتابَعين أو المجتمع من دالة definer — الجداول ليست مفتوحة
    // القراءة، والدالّة تُرجع الأعمدة العامة وحدها مع إخفاء الاسم منفَّذاً
    // في SQL (supabase/activity_v2.sql و supabase/community_feed.sql)
    const { data: actRows, error } = await supabase.rpc(
      mode === "all" ? "community_activity" : "following_activity_v2",
    );
    if (error || !actRows) return [];

    type ActivityRow = {
      id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean;
      kind?: FeedKind;
      tmdb_id: number;
      media_type: "tv" | "movie";
      rating: number | null;
      review: string | null;
      title: string | null;
      poster_path: string | null;
      updated_at?: string;
      day?: string;
      episode_count?: number;
      top_season?: number;
      at?: string;
    };
    // صفٌّ بلا عنوان لا يُرسم — الملصق والعنوان يأتيان من `follows`، فإن
    // غاب الصفّ هناك (استيرادٌ ناقص مثلاً) لم يبقَ ما يُعرض
    const rows = (actRows as ActivityRow[]).filter((r) => r.title || r.review);
    if (!rows.length) return [];

    /* الإعجابات في ندائين متوازيين — أعدادٌ و«هل أعجبتُ به» بلا أي
       معرّف مُعجِب. صفُّ التقييم من `review_likes` (رأيٌ واحد برقمٍ واحد
       أينما ظهر)، وحدثُ المشاهدة من `activity_likes` بمفتاحٍ فيه **يوم**
       — لأن صفّ الخطّ نفسه مفتاحُه اليوم منذ D-123 (D-124). */
    const rated = rows.filter((r) => (r.kind ?? "rate") === "rate");
    const acted = rows.filter((r) => (r.kind ?? "rate") !== "rate");
    const likeKey = (u: string, t2: number, m: string, d = "") => `${u}|${t2}|${m}|${d}`;
    const counts = new Map<string, number>();
    const mine = new Set<string>();

    const [reviewLikes, activityLikes] = await Promise.all([
      rated.length
        ? supabase.rpc("feed_review_likes", {
            uids: [...new Set(rated.map((r) => r.id))],
          })
        : Promise.resolve({ data: null }),
      acted.length
        ? supabase.rpc("feed_activity_likes", {
            uids: [...new Set(acted.map((r) => r.id))],
          })
        : Promise.resolve({ data: null }),
    ]);

    for (const l of (reviewLikes.data ?? []) as {
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
    /* الجدول غائبٌ (لم تُشغَّل الهجرة ٤٦ بعد)؟ `data` يعود فارغاً
       فتُقرأ الأعداد أصفاراً — سقوطٌ صامت لا شاشةُ خطأ (نمط D-113). */
    for (const l of (activityLikes.data ?? []) as {
      actor_id: string;
      tmdb_id: number;
      media_type: string;
      day: string;
      likes: number;
      liked_by_me: boolean;
    }[]) {
      const k = likeKey(l.actor_id, l.tmdb_id, l.media_type, l.day);
      counts.set(k, Number(l.likes));
      if (l.liked_by_me) mine.add(k);
    }

    return rows.map((r) => {
      const kind: FeedKind = r.kind ?? "rate";
      const when = r.at ?? r.updated_at ?? new Date(0).toISOString();
      const day = r.day ?? when.slice(0, 10);
      const k = likeKey(r.id, r.tmdb_id, r.media_type, kind === "rate" ? "" : day);
      const review = r.review?.trim() ?? "";
      return {
        person: {
          id: r.id,
          nickname: r.nickname,
          username: r.username,
          avatar_url: r.avatar_url,
          hide_name: r.hide_name,
        } as PersonLite,
        kind,
        tmdb_id: r.tmdb_id,
        media_type: r.media_type,
        rating: kind === "rate" ? r.rating ?? null : null,
        review: review || null,
        title: r.title,
        poster_path: r.poster_path,
        updated_at: when,
        day,
        episodeCount: Number(r.episode_count ?? 0),
        topSeason: Number(r.top_season ?? 0),
        likes: counts.get(k) ?? 0,
        likedByMe: mine.has(k),
      };
    });
  } catch {
    return [];
  }
}

// ================= الرسائل: مشاركة عملٍ وخيط ردّ =================

/**
 * الأعمال المرفوضة بـ«غير مهتم» — يستبعدها محرّك «مقترح لك».
 *
 * معرّفات فقط: `blendRecommendations` يستبعد بالمعرّف، والجدول صغير.
 * (حلّت محلّ `getShares`/`ShareThread` الميّتتين — أزيلتا هنا كما وعد D-054.)
 */
export async function getDismissedTitles(): Promise<Set<number>> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return new Set();
    const { data } = await supabase
      .from("dismissed_titles")
      .select("tmdb_id")
      .eq("user_id", user.id)
      .limit(1000);
    return new Set((data ?? []).map((r) => r.tmdb_id as number));
  } catch {
    return new Set();
  }
}

/** عدد الرسائل الواردة غير المقروءة — لشارة تبويب «الرسائل» */
export async function getUnreadShares(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("unread_shares");
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}

/**
 * عدّاد شارة الجرس وحده (**D-125**).
 *
 * يُنادى في كل صفحة (الترويسة عامّة)، فيحمل **رقماً لا أسطراً**: الأسطر
 * تُطلب عند فتح الورقة بفعلٍ من العميل (نمط `myBlocksList`). والدالّة
 * غائبة قبل الهجرة ٤٧؟ صفرٌ صامت — الجرس بلا شارة لا شاشة خطأ.
 */
export async function getUnreadSignals(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("unread_signals");
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}

// ============================================================
//  المحادثات — رسالة واحدة لكل شخص (لا خيطٌ لكل مشاركة)
//
//  الجداول نفسها (title_shares + share_replies) بلا تغيير في SQL؛ التجميع
//  هنا: كل مشاركاتِ عملٍ مع شخصٍ وردودُها تُدمَج في محادثةٍ واحدة مرتّبة
//  زمنياً — كالرسائل الخاصة. والردّ الجديد يُعلَّق بآخر عملٍ شورك في
//  المحادثة، فيبقى شرط «الردّ معلَّقٌ بعمل» قائماً (D-051).
// ============================================================

export interface ConvShareEvent {
  kind: "share";
  id: string;
  /** أنا المُرسِل */
  mine: boolean;
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string | null;
  poster_path: string | null;
  note: string | null;
  created_at: string;
}
export interface ConvReplyEvent {
  kind: "reply";
  id: string;
  mine: boolean;
  body: string;
  created_at: string;
}
/** قائمةٌ مُشارَكة — مرفقٌ منظَّم كمشاركة العمل، لا رابطٌ في نصٍّ حر (D-051) */
export interface ConvListShareEvent {
  kind: "list";
  id: string;
  mine: boolean;
  list_id: string;
  /** الاسم والعدّة لحظة الإرسال — البطاقة تُرسم بلا join والرابط يحمل الحيّ */
  list_name: string | null;
  item_count: number | null;
  note: string | null;
  created_at: string;
}
export type ConvEvent = ConvShareEvent | ConvReplyEvent | ConvListShareEvent;

export interface Conversation {
  personId: string;
  person: PersonLite | null;
  /** الأحداث مرتّبةً تصاعدياً — مشاركاتٌ وردود */
  events: ConvEvent[];
  lastAt: string;
  unread: number;
  /** آخر عملٍ شورك — وجهةُ الردّ الجديد */
  latestShareId: string;
}

export async function getConversations(): Promise<Conversation[]> {
  try {
    const supabase = await createClient();
    const me = await getUser();
    if (!me) return [];

    /* الجدولان معاً: مشاركات الأعمال ومشاركات القوائم خيطٌ واحد مع الشخص */
    const [{ data: rows, error }, { data: listRows }] = await Promise.all([
      supabase
        .from("title_shares")
        .select(
          "id, sender_id, recipient_id, tmdb_id, media_type, title, poster_path, note, created_at, read_at",
        )
        .order("created_at", { ascending: true })
        .limit(300),
      supabase
        .from("list_shares")
        .select("id, sender_id, recipient_id, list_id, list_name, item_count, note, created_at, read_at")
        .order("created_at", { ascending: true })
        .limit(300),
    ]);
    if (error && !listRows?.length) return [];
    if (!rows?.length && !listRows?.length) return [];

    type ShareRow = {
      id: string;
      sender_id: string;
      recipient_id: string;
      tmdb_id: number;
      media_type: "tv" | "movie";
      title: string | null;
      poster_path: string | null;
      note: string | null;
      created_at: string;
      read_at: string | null;
    };
    const shareRows = (rows ?? []) as ShareRow[];
    type ListShareRow = {
      id: string;
      sender_id: string;
      recipient_id: string;
      list_id: string;
      list_name: string | null;
      item_count: number | null;
      note: string | null;
      created_at: string;
      read_at: string | null;
    };
    const listShareRows = (listRows ?? []) as ListShareRow[];

    // معرّف المشاركة → الطرف الآخر، لنسب ردودها إلى محادثة الشخص نفسه
    const otherOf = new Map<string, string>();
    for (const s of shareRows) {
      otherOf.set(s.id, s.sender_id === me.id ? s.recipient_id : s.sender_id);
    }

    const shareIds = shareRows.map((s) => s.id);
    const { data: replyRows } = shareIds.length
      ? await supabase
          .from("share_replies")
          .select("id, share_id, author_id, body, created_at")
          .in("share_id", shareIds)
          .order("created_at", { ascending: true })
          .limit(2000)
      : { data: [] };
    type ReplyRow = {
      id: string;
      share_id: string;
      author_id: string;
      body: string;
      created_at: string;
    };
    const replies = (replyRows ?? []) as ReplyRow[];

    const ids = new Set<string>();
    for (const s of shareRows) ids.add(otherOf.get(s.id)!);
    for (const s of listShareRows) ids.add(s.sender_id === me.id ? s.recipient_id : s.sender_id);
    const { data: people } = await supabase
      .from("public_profiles")
      .select("id, nickname, username, avatar_url, hide_name")
      .in("id", [...ids]);
    const byId = new Map((people ?? []).map((p) => [p.id, p as PersonLite]));

    const convs = new Map<string, Conversation>();
    const ensure = (personId: string): Conversation => {
      let c = convs.get(personId);
      if (!c) {
        c = {
          personId,
          person: byId.get(personId) ?? null,
          events: [],
          lastAt: "",
          unread: 0,
          latestShareId: "",
        };
        convs.set(personId, c);
      }
      return c;
    };

    for (const s of shareRows) {
      const c = ensure(otherOf.get(s.id)!);
      c.events.push({
        kind: "share",
        id: s.id,
        mine: s.sender_id === me.id,
        tmdb_id: s.tmdb_id,
        media_type: s.media_type,
        title: s.title,
        poster_path: s.poster_path,
        note: s.note,
        created_at: s.created_at,
      });
      c.latestShareId = s.id; // الصفوف تصاعدية، فالأخير هو الأحدث
      if (s.recipient_id === me.id && !s.read_at) c.unread++;
    }
    for (const r of replies) {
      const other = otherOf.get(r.share_id);
      if (!other) continue;
      ensure(other).events.push({
        kind: "reply",
        id: r.id,
        mine: r.author_id === me.id,
        body: r.body,
        created_at: r.created_at,
      });
    }
    /* مشاركات القوائم — أحداثٌ في الخيط نفسه؛ الردود تبقى معلَّقةً
       بالأعمال وحدها (D-051) فلا otherOf لها */
    for (const s of listShareRows) {
      const c = ensure(s.sender_id === me.id ? s.recipient_id : s.sender_id);
      c.events.push({
        kind: "list",
        id: s.id,
        mine: s.sender_id === me.id,
        list_id: s.list_id,
        list_name: s.list_name,
        item_count: s.item_count,
        note: s.note,
        created_at: s.created_at,
      });
      if (s.recipient_id === me.id && !s.read_at) c.unread++;
    }

    const list = [...convs.values()];
    for (const c of list) {
      c.events.sort((a, b) => a.created_at.localeCompare(b.created_at));
      c.lastAt = c.events.length ? c.events[c.events.length - 1].created_at : "";
    }
    list.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    return list;
  } catch {
    return [];
  }
}

/** حالة المتابعة والإيقاف لعملٍ واحد — لقائمة «المزيد» في صفحته */
export async function getFollowState(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<{ following: boolean; dropped: boolean }> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return { following: false, dropped: false };
    const { data } = await supabase
      .from("follows")
      .select("dropped")
      .eq("user_id", user.id)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();
    return { following: !!data, dropped: !!data?.dropped };
  } catch {
    return { following: false, dropped: false };
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

/**
 * علاقتي بشخصٍ: أتابعه، أو **طلبت** متابعته (حسابه خاص) وما زال الطلب
 * معلّقاً — لزرّ المتابعة ثلاثيّ الحالة على الملف العام.
 */
export async function getFollowRelation(
  targetId: string,
): Promise<{ following: boolean; requested: boolean; followsMe: boolean }> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return { following: false, requested: false, followsMe: false };
    // الاتجاه الثالث — «هل يتابعني؟» — تحتاجه قائمة الملف: خيار «رسالة»
    // لا يُفتح إلا للمتبادلَين (D-051)، والحكم يحتاج الاتجاهين معاً
    const [f, r, b] = await Promise.all([
      supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .eq("following_id", targetId)
        .maybeSingle(),
      supabase
        .from("follow_requests")
        .select("target_id")
        .eq("requester_id", user.id)
        .eq("target_id", targetId)
        .maybeSingle(),
      supabase
        .from("user_follows")
        .select("follower_id")
        .eq("follower_id", targetId)
        .eq("following_id", user.id)
        .maybeSingle(),
    ]);
    return { following: !!f.data, requested: !!r.data, followsMe: !!b.data };
  } catch {
    return { following: false, requested: false, followsMe: false };
  }
}

/** طلبات المتابعة الواردة إليّ — أصحابها بالأقدميّة، لصندوق القبول/الرفض */
export async function getIncomingFollowRequests(): Promise<PersonLite[]> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];
    const { data: rows } = await supabase
      .from("follow_requests")
      .select("requester_id, created_at")
      .eq("target_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!rows?.length) return [];
    const { data: people } = await supabase
      .from("public_profiles")
      .select("id, nickname, username, avatar_url, hide_name")
      .in("id", rows.map((r) => r.requester_id));
    const byId = new Map((people ?? []).map((p) => [p.id, p as PersonLite]));
    return rows.map((r) => byId.get(r.requester_id)).filter(Boolean) as PersonLite[];
  } catch {
    return [];
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

// ============================================================
//  متابعة الفنانين (person_follows.sql) — «فنان» تمييزاً عن متابعة
//  المستخدمين أعلاه: getFollowedPeople تعيد أشخاص التطبيق، وهذه تعيد
//  أشخاص TMDB. الاسم والصورة محفوظان مع الصفّ (D-048).
// ============================================================

export interface ArtistLite {
  person_id: number;
  name: string | null;
  profile_path: string | null;
}

/** هل أتابع هذا الفنان؟ — للحالة الأولى لزرّ صفحته */
export async function isFollowingArtist(personId: number): Promise<boolean> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("person_follows")
      .select("person_id")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/** فنّانوك بالأحدث متابعةً — يغذّي صفّ «من فنّانيك» في اكتشف */
export async function getFollowedArtists(limit = 20): Promise<ArtistLite[]> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("person_follows")
      .select("person_id, name, profile_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as ArtistLite[];
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


export interface ChartRow {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string | null;
  poster_path: string | null;
  rating: number;
  votes: number;
}

/**
 * قائمة IMDb المثبَّتة (D-135) — المصدر الأول لمجموعات TOP 250.
 *
 * تُقرأ من `imdb_chart` الذي بُني من ملفّات IMDb المفتوحة، فبِركةُ
 * المرشّحين صارت IMDb كلّها لا أربعمئة عملٍ من TMDB. **والجدول فارغ أو
 * غائب؟ مصفوفةٌ فارغة** — والمستدعي يسقط إلى مسار D-132 القديم، فلا
 * تنكسر القوائم قبل أن تُشغَّل الهجرة أو تُملأ المسوّدة.
 */
export async function getImdbChart(
  kind: "movie" | "tv" | "anime",
  limit = 250,
): Promise<ChartRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("imdb_chart")
      .select("tmdb_id, media_type, title, poster_path, rating, votes")
      .eq("kind", kind)
      .order("rank", { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data as ChartRow[];
  } catch {
    return [];
  }
}

export interface SuggestedPerson extends PersonLite {
  /** كم عملاً من بذرتك في مكتبته — صفرٌ يعني «اقتراح احتياطي بلا سبب» */
  shared: number;
  followers: number;
}

/**
 * «أشخاص لمتابعتهم» (D-126) — دالّة definer واحدة لسطحين.
 *
 * بذرةٌ صريحة في شاشة التهيئة (الأعمال التي ضغطها المستخدم قبل أن تُكتب
 * في مكتبته)، وبذرةٌ ضمنية داخل الفيد (مكتبته الفعليّة). الحرّاس كلّهم في
 * SQL: لا يُقترح من لا تُرى صفحته ولا من أخفى اسمه ولا من تتابعه أصلاً.
 *
 * **الدالّة غائبة؟ مصفوفةٌ فارغة** — الواجهتان تختفيان بلا شاشة خطأ
 * (نمط D-113): الاقتراح إضافةٌ، وغيابُه يعيد الحال إلى ما قبل D-126.
 */
export async function getPeopleToFollow(
  seedIds: number[] | null = null,
  want = 6,
): Promise<SuggestedPerson[]> {
  try {
    const supabase = await createClient();
    const me = await getUser();
    if (!me) return [];
    const { data, error } = await supabase.rpc("people_to_follow", {
      seed_ids: seedIds && seedIds.length ? seedIds.slice(0, 40) : null,
      want,
    });
    if (error || !data) return [];
    return data as SuggestedPerson[];
  } catch {
    return [];
  }
}

export interface TitleCircle {
  /** عدد من تتابعهم ممّن شاهدوه — **صفرٌ يعني «لا تُظهر السطر»** لا «لا أحد» */
  watchers: number;
  raters: number;
  avgRating: number | null;
}

/**
 * «٣ ممن تتابعهم شاهدوه · متوسط تقييمهم ★٨» (D-127).
 *
 * الكتم تحت ثلاثة يقع **في SQL لا هنا**: رقمٌ يقول «واحدٌ ممن تتابعهم
 * شاهده» يسمّي شخصاً بعينه في حسابٍ دائرتُه صغيرة. والصفر الراجع من
 * الدالّة يعني «لا تُرسم»، فلا تكتب الواجهة «لا أحد» — غيابُ الخبر ليس خبراً.
 */
export async function getTitleCircle(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<TitleCircle> {
  const none: TitleCircle = { watchers: 0, raters: 0, avgRating: null };
  try {
    const supabase = await createClient();
    const me = await getUser();
    if (!me) return none;
    const { data, error } = await supabase.rpc("title_circle", {
      t_id: tmdbId,
      m_type: mediaType,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return none;
    return {
      watchers: Number(row.watchers ?? 0),
      raters: Number(row.raters ?? 0),
      avgRating: row.avg_rating === null || row.avg_rating === undefined
        ? null
        : Number(row.avg_rating),
    };
  } catch {
    return none;
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
//  المجتمعات (communities.sql)
// ============================================================

/** مجتمعٌ كما يظهر في الدليل والبحث */
export interface CommunityLite {
  id: string;
  name: string;
  is_private: boolean;
  owner_id: string;
  /** صورة المجتمع — يرفعها المالك (هجرة 41)؛ غيابها يعيد قرص الحرف */
  photo_url?: string | null;
  member_count: number;
  /** علاقتي به — يأتي من search_communities فقط */
  my_status?: "member" | "requested" | "none";
}

/** رسالةٌ في غرفة مجتمع */
export interface CommunityMessage {
  id: string;
  author_id: string;
  author: PersonLite | null;
  mine: boolean;
  body: string;
  created_at: string;
}

/** غرفة مجتمعٍ كاملة — ما تحتاجه صفحتها في قراءةٍ واحدة مجمَّعة */
export interface CommunityRoomData {
  id: string;
  name: string;
  is_private: boolean;
  owner_id: string;
  photo_url: string | null;
  /** من دعاهم المالك — للمالك وحده؛ فارغة لغيره (هجرة 42) */
  invitedIds: string[];
  isOwner: boolean;
  isMember: boolean;
  /** طلبتُ الانضمام وما زال معلّقاً (الخاصّ) */
  requested: boolean;
  member_count: number;
  members: PersonLite[];
  messages: CommunityMessage[];
  /** طلبات الانضمام المعلّقة — للمالك وحده، وإلا فارغة */
  joinRequests: PersonLite[];
}

/** مجتمعاتي — ما أنا عضوٌ فيه، لصدر الدليل */
export async function getMyCommunities(): Promise<CommunityLite[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_communities");
    if (error || !data) return [];
    return (data as CommunityLite[]).map((c) => ({ ...c, member_count: Number(c.member_count) }));
  } catch {
    return [];
  }
}

/** دعواتي المعلّقة — قسم «دعوات» فوق مجتمعاتي في الدليل (هجرة 42) */
export async function getMyCommunityInvites(): Promise<CommunityLite[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_community_invites");
    if (error || !data) return [];
    return (data as CommunityLite[]).map((c) => ({ ...c, member_count: Number(c.member_count) }));
  } catch {
    return [];
  }
}

/**
 * غرفة مجتمع. الصفّ نفسه مقروءٌ للجميع (الدليل عامّ)؛ الأعضاء والرسائل
 * تحرسهما سياسات العضوية فتعودان فارغتين لغير العضو — فتعرض الصفحة
 * غلافَ «انضمّ» بدل الدردشة. طلبات الانضمام تُقرأ للمالك وحده.
 */
export async function getCommunityRoom(id: string): Promise<CommunityRoomData | null> {
  try {
    if (!UUID_RE.test(id)) return null;
    const supabase = await createClient();
    const me = await getUser();
    if (!me) return null;

    const { data: c } = await supabase
      .from("communities")
      .select("id, name, is_private, owner_id, photo_url")
      .eq("id", id)
      .maybeSingle();
    if (!c) return null;
    const isOwner = c.owner_id === me.id;

    const [memberRows, msgRows, reqRows, myReq, inviteRows] = await Promise.all([
      supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", id)
        .order("joined_at", { ascending: true })
        .limit(100),
      supabase
        .from("community_messages")
        .select("id, author_id, body, created_at")
        .eq("community_id", id)
        .order("created_at", { ascending: true })
        .limit(200),
      isOwner
        ? supabase
            .from("community_join_requests")
            .select("user_id")
            .eq("community_id", id)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as { user_id: string }[] }),
      supabase
        .from("community_join_requests")
        .select("community_id")
        .eq("community_id", id)
        .eq("user_id", me.id)
        .maybeSingle(),
      // من دعاهم المالك — لحالة «مدعو» في ورقة الدعوة (هجرة 42)
      isOwner
        ? supabase
            .from("community_invites")
            .select("user_id")
            .eq("community_id", id)
            .limit(200)
        : Promise.resolve({ data: [] as { user_id: string }[] }),
    ]);

    const members = (memberRows.data ?? []).map((r) => r.user_id);
    const isMember = members.includes(me.id);

    // ملفّات كل من يظهر — الأعضاء ومؤلّفو الرسائل والطالبون — نداءٌ واحد
    const ids = new Set<string>(members);
    for (const m of msgRows.data ?? []) ids.add(m.author_id);
    for (const r of reqRows.data ?? []) ids.add(r.user_id);
    const { data: people } = ids.size
      ? await supabase
          .from("public_profiles")
          .select("id, nickname, username, avatar_url, hide_name")
          .in("id", [...ids])
      : { data: [] as PersonLite[] };
    const byId = new Map((people ?? []).map((p) => [p.id, p as PersonLite]));

    return {
      id: c.id,
      name: c.name,
      is_private: c.is_private,
      owner_id: c.owner_id,
      photo_url: c.photo_url ?? null,
      invitedIds: (inviteRows.data ?? []).map((r) => r.user_id),
      isOwner,
      isMember,
      requested: !!myReq.data,
      member_count: members.length,
      members: members.map((uid) => byId.get(uid)).filter(Boolean) as PersonLite[],
      messages: (msgRows.data ?? []).map((m) => ({
        id: m.id,
        author_id: m.author_id,
        author: byId.get(m.author_id) ?? null,
        mine: m.author_id === me.id,
        body: m.body,
        created_at: m.created_at,
      })),
      joinRequests: (reqRows.data ?? [])
        .map((r) => byId.get(r.user_id))
        .filter(Boolean) as PersonLite[],
    };
  } catch {
    return null;
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

/**
 * قائمة معلنة، لزائرٍ بلا حساب.
 *
 * بابٌ واحد (`public_list`) لا قراءةٌ من ثلاثة جداول: سياسات القراءة العامّة
 * مقصورة على المسجَّلين، فالرابط المُشارَك كان يطلب تسجيل دخولٍ ممّن أُرسل
 * إليه — أي أنّ «المعلنة» لم تكن معلنة. الدالّة تُرجع القائمة وصاحبها
 * وعناصرها، وتُرجع لا شيء لو كانت خاصّة (انظر security2.sql).
 */
export interface PublicList {
  id: string;
  name: string;
  subtitle: string | null;
  kind: ListKind;
  created_at: string;
  owner_id: string;
  owner_nickname: string | null;
  owner_username: string | null;
  owner_avatar: string | null;
  items: ListItem[];
}

export async function getPublicList(listId: string): Promise<PublicList | null> {
  if (!/^[0-9a-f-]{36}$/i.test(listId)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("public_list", { p_id: listId });
    if (error || !data?.length) return null;
    const row = data[0] as PublicList;
    return {
      ...row,
      kind: (row.kind ?? "regular") as ListKind,
      items: Array.isArray(row.items) ? (row.items as ListItem[]) : [],
    };
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

/**
 * أحدث القوائم المعلنة — لصفّ «قوائم من المجتمع» في اكتشف.
 *
 * لا SQL جديد: سياستا القراءة العامة على `user_lists` و`user_list_items`
 * (المسموحتان عمداً في فحص qual='true' الصحّي) هما المصدر، وأسماء أصحابها
 * من `public_profiles` الذي يُخفي الاسم بنفسه (D-011) — فقائمة مخفي الاسم
 * تظهر بلا صاحب كما في صفحة القائمة نفسها.
 *
 * الأعداد تُحسب من جلبة العناصر المسقوفة بألف صفّ لخمس عشرة قائمة —
 * دقيقة عملياً (القوائم المولَّدة عشرون عنصراً)، ولو فاضت قائمةٌ عملاقة
 * نقص عدُّها لا الصفّ كلّه.
 */
export interface PublicListCard {
  id: string;
  name: string;
  kind: string | null;
  owner: string | null;
  item_count: number;
  posters: string[];
}

/**
 * تشكيل بطاقات القوائم — العدّ وأربعة ملصقات وسطر الصاحب، في طلبين
 * مهما كثرت القوائم. مُشترَكٌ بين ثلاثة أبواب: «قوائم من المجتمع» في
 * اكتشف (D-063)، والمحفوظة في قوائمي، وقوائم الشخص في ملفّه (D-068) —
 * بطاقةٌ واحدة تعني منطقاً واحداً لا ثلاث نسخٍ تتباعد.
 */
async function shapeListCards(
  lists: { id: string; user_id: string; name: string; kind: string | null }[],
  withOwner: boolean,
): Promise<PublicListCard[]> {
  const supabase = await createClient();
  const ids = lists.map((l) => l.id);
  const [items, owners] = await Promise.all([
    supabase
      .from("user_list_items")
      .select("list_id, poster_path, added_at")
      .in("list_id", ids)
      .order("added_at", { ascending: false })
      .limit(1000),
    withOwner
      ? supabase
          .from("public_profiles")
          .select("id, nickname, username, hide_name")
          .in("id", [...new Set(lists.map((l) => l.user_id))])
      : Promise.resolve({ data: [] as { id: string; nickname: string | null; username: string | null; hide_name: boolean | null }[] }),
  ]);

  const byList = new Map<string, { count: number; posters: string[] }>();
  for (const r of items.data ?? []) {
    const e = byList.get(r.list_id) ?? { count: 0, posters: [] };
    e.count += 1;
    if (r.poster_path && e.posters.length < 4) e.posters.push(r.poster_path);
    byList.set(r.list_id, e);
  }
  const nameOf = new Map(
    (owners.data ?? []).map((p) => [
      p.id,
      p.hide_name ? null : (p.nickname || p.username || null),
    ]),
  );

  return lists
    .map((l) => {
      const e = byList.get(l.id) ?? { count: 0, posters: [] };
      return {
        id: l.id,
        name: l.name,
        kind: l.kind ?? null,
        owner: withOwner ? (nameOf.get(l.user_id) ?? null) : null,
        item_count: e.count,
        posters: e.posters,
      };
    })
    /* قائمةٌ فارغة لا تُكتشف — لا تعرض شيئاً ولا تدعو لشيء */
    .filter((c) => c.item_count > 0);
}

/**
 * البحث في قوائم المجتمع المعلنة بالاسم — لتبويب «القوائم» في اكتشف.
 *
 * بحثُ خادمٍ لا ترشيحٌ محليّ: القوائم العامة كلّها لا تُحمَّل للمتصفّح
 * أصلاً (بخلاف بحث الرسائل الذي يرشّح ما حُمِّل). و`ilike` يكفي هنا —
 * الاسم قصير والبحث «يحتوي» لا لغويّ، ومحارف النمط تُنزع من المدخل كي
 * لا يكتب أحدهم `%` فيطابق كلَّ شيء.
 */
export async function searchPublicLists(q: string, limit = 40): Promise<PublicListCard[]> {
  try {
    const needle = q.trim().replace(/[%_\\]/g, "").slice(0, 60);
    if (!needle) return [];
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];
    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, user_id, name, kind, updated_at")
      .eq("is_public", true)
      .neq("user_id", user.id)
      .ilike("name", `%${needle}%`)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!lists?.length) return [];
    return await shapeListCards(lists, true);
  } catch {
    return [];
  }
}

/**
 * قوائم من أتابعهم — صفّ «أصدقائك» في ديسكفري القوائم (D-082).
 * المتابَعون أولاً ثم قوائمهم المعلنة: طلبان مهما كثر المتابَعون،
 * والقراءة عبر سياسة `is_public` العالمية نفسها.
 */
export async function getFollowedPublicLists(limit = 15): Promise<PublicListCard[]> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];
    const { data: fs } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .limit(200);
    const ids = (fs ?? []).map((f) => f.following_id);
    if (ids.length === 0) return [];
    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, user_id, name, kind, updated_at")
      .eq("is_public", true)
      .in("user_id", ids)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!lists?.length) return [];
    return await shapeListCards(lists, true);
  } catch {
    return [];
  }
}


/**
 * القوائم العامة التي يظهر فيها هذا العمل — لتبويب «مشابه» في صفحته
 * (دفعة أحمد الثالثة: «تبويب للأعمال المشابهة والليستات»).
 *
 * لا SQL جديد: عناصر القوائم المعلنة مقروءة عالمياً بسياسة `is_public`
 * نفسها (باب D-063) — نسأل العناصر عن معرّف العمل ثم نجلب قوائمها.
 */
export async function getPublicListsContaining(
  tmdbId: number,
  mediaType: "tv" | "movie",
  limit = 10,
): Promise<PublicListCard[]> {
  try {
    const supabase = await createClient();
    const { data: rows } = await supabase
      .from("user_list_items")
      .select("list_id")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .limit(60);
    const ids = [...new Set((rows ?? []).map((r) => r.list_id as string))].slice(0, limit * 2);
    if (!ids.length) return [];
    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, user_id, name, kind, updated_at")
      .in("id", ids)
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!lists?.length) return [];
    return await shapeListCards(lists, true);
  } catch {
    return [];
  }
}

export async function getPublicListsFeed(limit = 15): Promise<PublicListCard[]> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];
    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, user_id, name, kind, updated_at")
      .eq("is_public", true)
      .neq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!lists?.length) return [];
    return await shapeListCards(lists, true);
  } catch {
    return [];
  }
}

/**
 * قوائم شخصٍ المعلنة — لصفّها في ملفّه العام (D-068).
 * القراءة عبر سياسة `is_public` العالمية نفسها؛ بلا سطر صاحبٍ — الصفحة
 * كلّها صفحته أصلاً.
 */
export async function getPublicListsOf(userId: string, limit = 15): Promise<PublicListCard[]> {
  try {
    const supabase = await createClient();
    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, user_id, name, kind, updated_at")
      .eq("is_public", true)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!lists?.length) return [];
    return await shapeListCards(lists, false);
  } catch {
    return [];
  }
}

/**
 * القوائم المحفوظة — مراجعُ حيّةٌ إلى قوائم أصحابها (D-068).
 *
 * الحفظ صفُّ ربطٍ لا نسخة، فالبطاقة تُقرأ من قائمة صاحبها مباشرةً وأي
 * تعديلٍ منه ينعكس هنا بلا مزامنة. قائمةٌ أعادها صاحبها خاصةً تسقط من
 * القراءة بسياسة SQL نفسها — فتختفي من هنا بصدقٍ بدل بطاقةٍ لا تُفتح.
 */
export async function getSavedLists(limit = 30): Promise<PublicListCard[]> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return [];
    const { data: saves } = await supabase
      .from("list_saves")
      .select("list_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!saves?.length) return [];

    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, user_id, name, kind")
      .in("id", saves.map((s) => s.list_id))
      .eq("is_public", true);
    if (!lists?.length) return [];

    // ترتيب الحفظ لا ترتيب القوائم: الأحدث حفظاً أولاً
    const rank = new Map(saves.map((s, i) => [s.list_id, i]));
    const sorted = [...lists].sort(
      (a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9),
    );
    return await shapeListCards(sorted, true);
  } catch {
    return [];
  }
}

/** هل حفظ المستخدمُ هذه القائمة؟ — لحالة زرّ «أضِفها إلى قوائمي» */
export async function isListSaved(listId: string): Promise<boolean> {
  try {
    if (!UUID_RE.test(listId)) return false;
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("list_saves")
      .select("list_id")
      .match({ user_id: user.id, list_id: listId })
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
