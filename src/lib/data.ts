import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { decodeSessionCookie, sessionCookieParts } from "@/lib/sessionCookie";
import type { PersonLite } from "./people";
import { episodeKey } from "@/lib/keys";
import { LOOPZ_ID } from "@/lib/loopz";
import {
  CONTENT_PREFS_COOKIE,
  EMPTY_CONTENT_PREFS,
  parseContentPrefs,
  sanitizeContentPrefs,
  type ContentPrefs,
} from "@/lib/contentPrefs";

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
  /** 🆕 معرّفات تصنيف TMDB للعمل (D-648) — `null` = لم تُقرأ بعد، لا «بلا نوع» */
  genres?: number[] | null;
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

/**
 * معرّف المستخدم من كوكي الجلسة مباشرةً — بلا رحلة تحقّق.
 *
 * جولة أداء ٢٠ أغسطس: كل قارئٍ كان ينتظر `getUser()` (رحلة شبكةٍ إلى
 * خادم Auth) قبل أن يبدأ استعلامه، فصار أول استعلامٍ في كل طلبٍ رحلتين
 * متسلسلتين. وهذه الرحلة **ليست هي الحارس أصلاً**: الاستعلام يحمل توكن
 * الجلسة نفسه، وPostgres يتحقّق من توقيعه وصلاحيته في RLS مع كل صفّ —
 * فتوكنٌ مزوَّر أو منتهٍ يعيد صفراً من الصفوف لا صفوفَ غيره، سواءٌ
 * تحقّقنا هنا أم لا. القراءة هنا فكُّ حمولة الـJWT محلياً (كما يفعل
 * الوسيط في `proxy.ts`) لأخذ `sub` وحده — قيمته تُستعمل **للفلترة
 * والعرض فقط**، والصلاحيات كلها تبقى عند RLS.
 *
 * حدّان مقصودان:
 *  - توكن منتهٍ أو مشوَّه → نسقط إلى `getUser()` الكامل الذي يجدّد
 *    الجلسة، فلا يظهر «حسابٌ فارغ» لمن طالت جلسته.
 *  - **الكتابات والقرارات الحسّاسة لا تستعمله**: `requireUser` وأفعال
 *    الخادم كلها تبقى على التحقّق الكامل.
 */
export const getUserId = cache(async (): Promise<string | null> => {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const parts = sessionCookieParts(store.getAll());
    if (parts.length === 0) return null; // زائر — بلا رحلةٍ أصلاً

    const claims = decodeSessionCookie(parts);
    // مشوَّهٌ أو منتهٍ أو على وشك؟ التحقّق الكامل يجدّد الجلسة —
    // لا نستعلم بتوكنٍ ميّت فيظهر «حسابٌ فارغ»
    if (!claims || !claims.exp || claims.exp * 1000 <= Date.now() + 5000)
      return (await getUser())?.id ?? null;
    return claims.sub;
  } catch {
    return (await getUser())?.id ?? null;
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
  /* 🆕 **تفضيلاتُ المحتوى** (D-545، الهجرة ١٢٦) — **أعمدةٌ على `profiles`
     لا جدولٌ ثانٍ**: `favorite_genres` هو «المفضَّل» أصلاً، **وصفُّ
     الملفّ يُقرأ مرّةً مخبَّأةً لكلِّ صفحة فلا استعلامَ إضافيّ.**
     **وغيابُها (قبل تشغيل الهجرة) يعني الفراغَ لا العطل.** */
  unwanted_genres?: number[] | null;
  /** **مرتَّبةٌ**: الأولى أعلى أولويّة (ISO 639-1) */
  preferred_languages?: string[] | null;
  excluded_languages?: string[] | null;
  /** 🆕 **روابطُ التواصل** (D-546، الهجرة ١٢٧) — معرّفاتٌ لا روابط */
  socials?: unknown;
  hide_name?: boolean | null;
  home_prefs?: unknown;
  /** تخصيص البروفايل — توأم `home_prefs` (هجرة 51، D-129) */
  profile_prefs?: unknown;
  /** نبذةٌ قصيرة — اختيارية، وتغيب قبل تشغيل profile_bio.sql */
  bio?: string | null;
  /** حسابٌ خاص: المتابعة بطلبٍ يُقبل (follow_requests.sql) */
  is_private?: boolean | null;
  /** قفل قائمتَي المتابعة (هجرة 43) */
  hide_follow_lists?: boolean | null;
  /** حجم خطّ الواجهة والمحتوى (هجرة 121) — `null` قبل تشغيلها */
  font_ui?: string | null;
  font_content?: string | null;
  /** التلميحات المقروءة وتقدّم الجولة (هجرة 121) — `null` قبلها */
  ui_state?: unknown;
  /* 🆕 **الخطّة** (D-633، الهجرة ١٤٠) — والحكمُ عليها في `lib/plan.ts`
     وحدَه: **لا شرطَ `plan === "plus"` في مكوّن** (D-145). */
  plan?: string | null;
  /** `null` = بلا انتهاء (حالُ المؤسِّسين) */
  plus_until?: string | null;
  /** صفةٌ لا خطّة — تبقى بعد أيِّ تبدّلٍ في الاشتراك */
  founder?: boolean | null;
}

/** الملف الشخصي — يُقرأ في التخطيط والشريط العلوي والصفحة، فيُخزَّن لكل طلب */
export const getProfile = cache(async (): Promise<Profile | null> => {
  try {
    const supabase = await createClient();
    /* المعرّف من الكوكي مباشرةً (جولة ٢٠ أغسطس): الاستعلام محميٌّ بـRLS،
       والتحقّق الكامل يبقى في الفرع الاحتياطي وحده حيث نحتاج بيانات
       حساب Google نفسها */
    const uid = await getUserId();
    if (!uid) return null;

    // eslint-disable-next-line prefer-const
    let { data, error } = await supabase
      .from("profiles")
      .select(
        "id, nickname, username, avatar_url, cover_url, cover_pos, avatar_pos, theme, favorite_genres, unwanted_genres, preferred_languages, excluded_languages, socials, hide_name, home_prefs, bio, is_private, hide_follow_lists, profile_prefs, font_ui, font_content, ui_state, plan, plus_until, founder",
      )
      .eq("id", uid)
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
        .eq("id", uid)
        .maybeSingle();
      if (mid.data) {
        // عمودا التموضع أحدث من هذه الدرجة — يسقطان إلى سلوكهما القديم
        /* 🆕 **وأعمدةُ ١٢٦ تسقط إلى الفراغ في هذه الدرجة** — **والفراغُ
           يعني «بلا تفضيلات» أي السلوكَ القديم بالضبط** (D-063). */
        data = { ...mid.data, cover_pos: null, avatar_pos: null, home_prefs: null, bio: null, is_private: null, hide_follow_lists: null, profile_prefs: null, font_ui: null, font_content: null, ui_state: null, unwanted_genres: null, preferred_languages: null, excluded_languages: null, socials: null, plan: "free", plus_until: null, founder: false };
      } else {
        const legacy = await supabase
          .from("profiles")
          .select("id, nickname, username, avatar_url, favorite_genres")
          .eq("id", uid)
          .maybeSingle();
        if (legacy.data) {
          data = {
            ...legacy.data,
            cover_url: null,
            cover_pos: null,
            avatar_pos: null,
            theme: null,
            unwanted_genres: null,
            preferred_languages: null,
            excluded_languages: null,
            socials: null,
            hide_name: false,
            home_prefs: null,
            bio: null,
            is_private: null,
            hide_follow_lists: null,
            profile_prefs: null,
            font_ui: null,
            font_content: null,
            ui_state: null,
            /* الدرجةُ الأقدم: بلا خطّةٍ = مجّانيّ — **والفراغُ يعني
               السلوكَ القديم بالضبط** (D-063/D-179). */
            plan: "free",
            plus_until: null,
            founder: false,
          };
        }
      }
    }

    // احتياط أخير: لو الجدول لسه ما اتنشأ أو الصف ناقص، استخدم بيانات حساب Google
    if (!data) {
      // هنا وحدها نحتاج كائن المستخدم كاملاً (بيانات Google) — حسابٌ جديد
      // أو جدولٌ ناقص، فالرحلة الكاملة ثمنها مقبول في هذه الندرة
      const user = await getUser();
      if (!user) return null;
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
  const uid = await getUserId();
  if (!uid) return [];

  // فلترة صريحة بالمستخدم: سياسات القراءة العامة على الجدول (لصفحات البروفايل)
  // تعني أن الاستعلام غير المفلتر يرجع صفوف الجميع، لا صفوف صاحب الحساب فقط.
  // وبـ`pageAll` كأشقّائه: PostgREST يقصّ عند ألف صفٍّ **بصمت** — فمكتبةُ
  // ألفِ عملٍ وواحد كانت ستفقد أقدمَ أعمالها بلا خطأٍ يُرى.
  try {
    const data = await pageAll<FollowRow>((from, to) =>
      supabase
        .from("follows")
        .select(
          "tmdb_id, media_type, title, poster_path, added_at, total_episodes, aired_episodes, next_air_date, dropped, rewatch_count, rewatch_started_at, stats_updated_at, genres",
        )
        .eq("user_id", uid)
        .order("added_at", { ascending: false })
        .range(from, to)
        .throwOnError(),
    );
    return data;
  } catch {
    // احتياط: لو أعمدة الإحصاءات لسه ما انضافت، اقرأ الأعمدة الأساسية فقط
    const base = await supabase
      .from("follows")
      .select("tmdb_id, media_type, title, poster_path, added_at")
      .eq("user_id", uid)
      .order("added_at", { ascending: false });
    return base.data ?? [];
  }
});

/**
 * علَمُ الأنمي لكل متابعة (D-182) — **استعلامٌ منفصلٌ عن `getFollows` عمداً.**
 *
 * وضعُ `is_anime` في اختيار `getFollows` كان سيُسقط الاستعلام كلَّه إلى
 * احتياطِه ذي الأعمدة الخمسة **في كل زيارةٍ قبل تشغيل الهجرة ٦١** — فتفقد
 * المكتبةُ التقدّم والحلقات والبطاقة الحمراء لأجل علَمٍ واحد. **عمودٌ جديد
 * لا يُقحم في استعلامٍ قائمٍ يحمل غيره.** (درسُ الهجرة ٥٨ في `04`: هجرةٌ لم
 * تُشغَّل ليست مشحونة — والشيفرة تُكتب لتعيش قبلها وبعدها.)
 *
 * الجدول بلا العمود؟ **خريطةٌ فارغة** — فيبقى كلُّ شيءٍ «غير مصنَّف»،
 * والتبويب يقول ذلك بدل أن ينكسر.
 */
export const getMyAnimeFlags = cache(
  async (): Promise<Map<string, boolean | null>> => {
    const out = new Map<string, boolean | null>();
    try {
      const supabase = await createClient();
      const uid = await getUserId();
      if (!uid) return out;
      const { data, error } = await supabase
        .from("follows")
        .select("tmdb_id, media_type, is_anime")
        .eq("user_id", uid);
      if (error || !data) return out;
      for (const r of data as { tmdb_id: number; media_type: string; is_anime: boolean | null }[]) {
        out.set(`${r.media_type}-${r.tmdb_id}`, r.is_anime ?? null);
      }
      return out;
    } catch {
      return out;
    }
  },
);

/**
 * 🆕 **علَمُ الأنمي لصاحبِ ملفٍّ أزوره** (D-561) — **توأمُ
 * `getMyAnimeFlags` لا نسخته**: نفسُ الخريطة بمفتاحها نفسِه،
 * **والمختلفُ المعيار** (صاحبُ الصفحة لا أنا) **والبوّابةُ**
 * (`can_view_profile` داخل الدالّة).
 *
 * **ولماذا دالّةٌ ثالثةٌ صغيرة لا عمودٌ يُضاف إلى `user_public_follows`:**
 * **تغييرُ نوعِ إرجاعِ دالّةٍ قائمةٍ يوجب إسقاطَها أوّلاً** — وإسقاطُ
 * دالّةٍ تقرؤها صفحةٌ حيّةٌ يعني ثوانيَ تكون فيها مكتبةُ كلِّ زائرٍ
 * فارغة. **وهذه إضافةٌ خالصة**: تُشغَّل فيظهر صفُّ الأنمي، ولا تُشغَّل
 * فيبقى كلُّ شيءٍ كما هو اليوم (**خريطةٌ فارغة، ولا صفَّ أنمي، ولا
 * عطل**) — وهي حجّةُ D-182 بحرفها.
 *
 * ⚠️ **وتُقرأ المفضّلةُ بها أيضاً**: صفوفُ المفضّلة عناوينُ في
 * `user_list_items` **ولا علَمَ فيها** — **والعلَمُ في `follows`
 * وحدَها**، فالخريطةُ واحدةٌ لقارئَين.
 */
export async function getProfileAnimeFlags(userId: string): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("profile_anime_flags", { p_user: userId });
    if (error || !data) return out;
    for (const r of data as { tmdb_id: number; media_type: string; is_anime: boolean | null }[]) {
      if (r.is_anime) out.set(`${r.media_type}-${r.tmdb_id}`, true);
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * 🆕 **قلوبُ مراجعات ملفٍّ واحد** (D-583) — لتبويب «مراجعات» وقد لبس
 * بطاقةَ المجتمع.
 *
 * **الدالّةُ هي دالّةُ الخطِّ نفسُها** (`feed_review_likes`، definer):
 * تُنادى بمعرّفٍ واحدٍ بدل مصفوفة الخطّ — **فتُرجع أعدادَ إعجابات
 * مراجعاته كلِّها و«هل أعجبتُ أنا» في نداءٍ واحدٍ للصفحة** (D-205)،
 * **ولا قارئَ جديدَ في القاعدة.** والمفتاحُ `(عمل، وسيط)` لأن صاحبَ
 * الصفحة واحد.
 */
export async function getReviewLikesOf(
  userId: string,
): Promise<Map<string, { likes: number; likedByMe: boolean }>> {
  const out = new Map<string, { likes: number; likedByMe: boolean }>();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("feed_review_likes", { uids: [userId] });
    if (error || !data) return out;
    for (const l of data as {
      review_user_id: string;
      tmdb_id: number;
      media_type: string;
      likes: number;
      liked_by_me: boolean;
    }[]) {
      out.set(`${l.media_type}-${l.tmdb_id}`, {
        likes: Number(l.likes),
        likedByMe: !!l.liked_by_me,
      });
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * 🆕 **معرّفُ قائمة مفضّلتي** (D-567) — **صفٌّ واحدٌ بعلامةٍ واحدة.**
 *
 * **ولا يُقرأ من `getMyLists`**: تلك تُرجع صفوفاً بملصقاتها وعدّاداتها،
 * **والمطلوبُ هنا معرّفٌ واحد** — **ونداءٌ بعمودٍ واحدٍ أرخصُ من قراءةِ
 * قوائمك كلِّها لأجل حرفٍ منها.** **والغيابُ يعني أنك لم تقلب قلباً
 * بعد** (القائمةُ تُولد عند أوّل قلب، D-130) — **فلا زرَّ ترتيب.**
 */
export const getMyFavoritesListId = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return null;
    const { data, error } = await supabase
      .from("user_lists")
      .select("id")
      .eq("user_id", uid)
      .eq("kind", "favorites")
      .maybeSingle();
    if (error || !data) return null;
    return String((data as { id: string }).id);
  } catch {
    return null;
  }
});

/** مفتاح خريطة الأغلفة — نوعٌ ومعرّف، لا نصٌّ حرّ */
export function artKey(mediaType: string, tmdbId: number) {
  return `${mediaType}-${tmdbId}`;
}

export interface TitleArt {
  poster_path: string | null;
  backdrop_path: string | null;
}

/**
 * أغلفتي المختارة (D-131) — خريطةٌ واحدة تُقرأ مرّةً وتُطبَّق على كل
 * بطاقة، بدل استعلامٍ لكل عمل.
 *
 * `cache` لأن الصفحة الواحدة قد تطلبها من موضعين (المكتبة والرئيسية)،
 * والقاعدة غير المهاجَرة تُرجع خطأً فنعود بخريطةٍ فارغة: الأغلفة زينةٌ،
 * وسقوطُها لا يجوز أن يُسقط المكتبة.
 */
export const getMyTitleArt = cache(async (): Promise<Map<string, TitleArt>> => {
  const out = new Map<string, TitleArt>();
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return out;
    const { data, error } = await supabase
      .from("title_art")
      .select("tmdb_id, media_type, poster_path, backdrop_path")
      .eq("user_id", uid);
    if (error || !data) return out;
    for (const r of data) {
      out.set(artKey(r.media_type as string, r.tmdb_id as number), {
        poster_path: r.poster_path ?? null,
        backdrop_path: r.backdrop_path ?? null,
      });
    }
    return out;
  } catch {
    return out;
  }
});

/**
 * مفضّلاتي — مجموعةُ مفاتيح (D-130).
 *
 * نداءٌ واحد بدل سؤالٍ لكل عمل، ومخبّأٌ للطلب فتقرؤه صفحةٌ من موضعين
 * بلا رحلةٍ ثانية. وسقوطُه يعيد مجموعةً فارغة: قلبٌ صامتٌ أهون من صفحةٍ
 * لا تُرسم.
 */
export const getMyFavorites = cache(async (): Promise<Set<string>> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_favorites");
    if (error || !data) return new Set();
    return new Set(
      (data as { tmdb_id: number; media_type: string }[]).map((r) =>
        artKey(r.media_type, r.tmdb_id),
      ),
    );
  } catch {
    return new Set();
  }
});

/**
 * أغلفة صاحب بروفايلٍ أزوره (D-131).
 *
 * بروفايل الشخص من سطوحه (ق٨) فما اختاره يظهر فيه لزائره — لكن عبر
 * `profile_title_art` (definer) خلف `can_view_profile` **وحدها**: البوابة
 * الواحدة، ولا باب ثانٍ (D-061/D-070). وسقوطُها يعيد خريطةً فارغة:
 * الأغلفة زينةٌ، ولا يجوز أن يُسقط سقوطُها البروفايل.
 */
export async function getProfileArt(userId: string): Promise<Map<string, TitleArt>> {
  const out = new Map<string, TitleArt>();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("profile_title_art", { p_user: userId });
    if (error || !data) return out;
    for (const r of data as {
      tmdb_id: number;
      media_type: string;
      poster_path: string | null;
      backdrop_path: string | null;
    }[]) {
      out.set(artKey(r.media_type, r.tmdb_id), {
        poster_path: r.poster_path ?? null,
        backdrop_path: r.backdrop_path ?? null,
      });
    }
    return out;
  } catch {
    return out;
  }
}

/** غلافُ عملٍ بعينه عندي — لصفحة العمل (خلفيةً وملصقاً) */
export async function getMyArtFor(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<TitleArt | null> {
  const map = await getMyTitleArt();
  return map.get(artKey(mediaType, tmdbId)) ?? null;
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

export async function getWatchedForShow(
  showTmdbId: number,
  /** لحظة بدء الإعادة إن كانت بيد المستدعي — تمريرها يوفّر استعلام المتابعة */
  rewatchSince?: string | null,
): Promise<Set<string>> {
  const supabase = await createClient();
  const uid = await getUserId();
  if (!uid) return new Set();

  // إعادة المشاهدة: ما أُشِّر قبل لحظة البدء لا يُحسب تقدّماً في الدورة الحالية
  let since: string | null = rewatchSince ?? null;
  if (rewatchSince === undefined) {
    try {
      const { data: fr } = await supabase
        .from("follows")
        .select("rewatch_started_at")
        .eq("user_id", uid)
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
      .eq("user_id", uid)
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
/* `cache()`: getLibState غيرُ مخبّأةٍ وتتداخل استدعاءاتُها في /news ثلاث
   مرّاتٍ في الطلب الواحد — فكان ملخّصُ المشاهدة يُحسب ثلاثاً. */
export const getWatchSummary = cache(async (): Promise<WatchSummaryRow[] | null> => {
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
});

export async function getAllWatchedEpisodes(): Promise<WatchedEpisodeRow[]> {
  const supabase = await createClient();
  const uid = await getUserId();
  if (!uid) return [];
  return pageAll<WatchedEpisodeRow>((from, to) =>
    supabase
      .from("watched_episodes")
      .select("show_tmdb_id, season_number, episode_number, watched_at, runtime")
      .eq("user_id", uid)
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
    const uid = await getUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from("movie_progress")
      .select("movie_tmdb_id, position_minutes, runtime_minutes, title, poster_path")
      .eq("user_id", uid)
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

/* `cache()`: نفسُ علّة getWatchSummary — مسحُ watched_movies المُرقَّم كان
   يتكرّر بعدد استدعاءات getLibState في الطلب. */
export const getWatchedMovieIds = cache(async (): Promise<Set<number>> => {
  const supabase = await createClient();
  const uid = await getUserId();
  if (!uid) return new Set();
  const rows = await pageAll<{ movie_tmdb_id: number }>((from, to) =>
    supabase
      .from("watched_movies")
      .select("movie_tmdb_id")
      .eq("user_id", uid)
      .order("movie_tmdb_id", { ascending: true })
      .range(from, to),
  );
  return new Set(rows.map((r) => r.movie_tmdb_id));
});

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
  const uid = await getUserId();
  if (!uid) return [];
  const rows = await pageAll<{ movie_tmdb_id: number; runtime: number | null }>((from, to) =>
    supabase
      .from("watched_movies")
      .select("movie_tmdb_id, runtime")
      .eq("user_id", uid)
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
  /** 🆕 **أعلن كاتبُه أن فيه حرقاً** (D-315، الهجرة ١٠٠) — كأخيه في المشاركات */
  has_spoiler?: boolean;
}

export async function getMyRating(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<RatingRow | null> {
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return null;
    const { data } = await supabase
      .from("ratings")
      .select(
        "user_id, tmdb_id, media_type, rating, review, title, poster_path, updated_at, has_spoiler",
      )
      .eq("user_id", uid)
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
    const uid = await getUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from("ratings")
      .select(
        "user_id, tmdb_id, media_type, rating, review, title, poster_path, updated_at, has_spoiler",
      )
      .eq("user_id", uid)
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
/**
 * 🆕 **نبضُ العمل — قلوبٌ وتقييماتٌ في نداءٍ واحد** (D-408، الهجرة ١١٨).
 *
 * **والقلوبُ هي ما لم يكن يُقرأ**: المفضّلةُ قائمةٌ في `user_lists`
 * بعلامة `kind='favorites'` (هجرة ٥٥)، **وسياساتُها تُظهر قوائمَ صاحبها
 * وحدَه** — فالعدُّ من العميل يعود واحداً دائماً. **فالدالّةُ `definer`،
 * وتُرجع عدداً لا أسماء.**
 *
 * **والسقوطُ صامتٌ بأصفار** (D-179): قبل تشغيل الهجرة يغيب السطرُ من
 * الترويسة ولا تظهر شاشةُ خطأ.
 */
export async function getTitlePulse(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<{ hearts: number; votes: number; avg: number }> {
  const empty = { hearts: 0, votes: 0, avg: 0 };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("title_pulse", {
      t_id: tmdbId,
      m_type: mediaType,
    });
    if (error || !data) return empty;
    const row = (data as { hearts: number; votes: number; avg_rating: number }[])[0];
    if (!row) return empty;
    return {
      hearts: Number(row.hearts) || 0,
      votes: Number(row.votes) || 0,
      avg: Number(row.avg_rating) || 0,
    };
  } catch {
    return empty;
  }
}

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
  /** تخصيص البروفايل (هجرة 51، D-129) — إخراجُ الصفحة للزائر */
  profile_prefs?: unknown;
  /* 🆕 **الخطّةُ والصفةُ في العرض العامّ** (D-633، الهجرة ١٤٠): الشارةُ
     تُرى على ملفِّ صاحبها، **و`plus_until` لا تدخل العرض** — الشارةُ
     تُرى والتاريخُ لا يُرى، فلا يعرف الناسُ متى ينتهي اشتراكُ غيرهم. */
  plan?: string | null;
  founder?: boolean | null;
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
      /* `hide_follow_lists` و`profile_prefs` كانا مقروءَين في الصفحة
         وغائبَين عن هذا السطر: العمودان أحدث من الاستعلام، فكان القفل
         لا يقفل والتخصيص لا يُقرأ. أُضيفا بعد تشغيل الهجرتين 43 و51،
         والاحتياط أدناه يمسكهما لو نُشر الكود قبل هجرةٍ لاحقة. */
      .select("id, nickname, username, avatar_url, cover_url, cover_pos, avatar_pos, favorite_genres, hide_name, bio, is_private, hide_follow_lists, profile_prefs, plan, founder")
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

/**
 * 🆕 **تصنيفاتُ مكتبةِ عضوٍ أزوره** (D-648) — خريطةُ `media-tmdbId` ← معرّفات.
 *
 * 🔑 **واستعلامٌ ثانٍ لا عمودٌ في `user_public_follows`**: تغييرُ جدولِ
 * عودةِ دالّةٍ قائمةٍ يوجب `drop`، **ولا `drop` بالإذن الدائم** — **وهي
 * سابقةُ `is_anime` في هذا المستودع بعينها** (D-182: «عمودٌ جديدٌ لا
 * يُقحم في استعلامٍ قائمٍ يحمل غيره»).
 *
 * ⚠️ **والفشلُ خريطةٌ فارغة** لا استثناء: **تجميعُ الشبكة زينةُ ترتيبٍ
 * لا شرطُ عرض** — فتُقرأ أبجديّةً بلا مجموعاتٍ ولا تنكسر الصفحة.
 */
export async function getFollowGenresOf(userId: string): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("user_follow_genres", { target: userId });
    if (error || !data) return out;
    for (const r of data as { tmdb_id: number; media_type: string; genres: number[] | null }[]) {
      if (r.genres?.length) out.set(`${r.media_type}-${r.tmdb_id}`, r.genres);
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * 🆕 **ملخّصُ مشاهدةِ عضوٍ أزوره بالدقائق** (D-649) — `user_watch_stats`.
 *
 * 🔴 **ولماذا دالّةٌ ثانيةٌ و`watch_summary` قائمة**: تلك تقرأ
 * `auth.uid()` وحدَه — **فزائرٌ يفتح إحصائياتِ غيره كان سيرى أرقامَ
 * نفسِه**، وهو بعينه ما تمنعه D-217. **وهذه تأخذ الهدفَ صراحةً
 * وتحرسه بـ`can_view_profile`** (الهجرة ١٤٢).
 *
 * ⚠️ **والفشلُ أصفارٌ فارغة**: صفحةُ الإحصائيات تقول «لا شيء بعد» ولا
 * تنكسر — **وحسابٌ خاصٌّ يمرّ من هنا بلا صفوفٍ أصلاً** (الحارسُ في SQL).
 */
export async function getWatchStatsOf(
  userId: string,
): Promise<{ byShow: Map<number, { watched: number; minutes: number }>; episodes: number; minutes: number }> {
  const empty = { byShow: new Map<number, { watched: number; minutes: number }>(), episodes: 0, minutes: 0 };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("user_watch_stats", { target: userId });
    if (error || !data) return empty;
    const byShow = new Map<number, { watched: number; minutes: number }>();
    let episodes = 0;
    let minutes = 0;
    for (const r of data as { show_tmdb_id: number; watched: number; minutes: number }[]) {
      const w = Number(r.watched);
      const m = Number(r.minutes);
      byShow.set(r.show_tmdb_id, { watched: w, minutes: m });
      episodes += w;
      minutes += m;
    }
    return { byShow, episodes, minutes };
  } catch {
    return empty;
  }
}

/**
 * 🆕 **أفلامُ عضوٍ أزوره: عدداً ودقائق** (D-649) — `user_movie_stats`.
 *
 * ⚠️ **و`user_watched_movie_ids` لا تكفي**: تُرجع معرّفاتٍ لا دقائق،
 * **ووقتُ مشاهدةٍ بلا أفلامِه نصفُ رقمٍ يرتدي زيَّ كلٍّ** (D-217).
 */
export async function getMovieStatsOf(
  userId: string,
): Promise<{ watched: number; minutes: number }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("user_movie_stats", { target: userId });
    if (error || !data) return { watched: 0, minutes: 0 };
    const row = (Array.isArray(data) ? data[0] : data) as
      | { watched: number; minutes: number }
      | undefined;
    return { watched: Number(row?.watched ?? 0), minutes: Number(row?.minutes ?? 0) };
  } catch {
    return { watched: 0, minutes: 0 };
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
/**
 * 🆕 **`list_review` خامسُها — الخيطُ الثالث** (الهجرة ١٠٦).
 *
 * **كلامُ الناس على القوائم كان يُكتب ولا يُرى إلا من فتح القائمة**
 * (D-327): لا في خطّ النشاط ولا في جرس صاحبها — **فأغلى ما في السطح
 * الجديد كان أخفاه**، وهو حرفاً عطلُ «أرخصُ ميزةٍ هي التي بُنيت ولم
 * تُوصَل» (D-262).
 *
 * ⚠️ **والشيفرةُ تسبق هجرتَها** (D-028): قبل ١٠٦ لا يعود صفٌّ بهذا
 * النوع أصلاً، **والخطرُ المعاكس** — صفُّ قائمةٍ يصل إلى واجهةٍ لا تعرفه
 * فيُرسم برابط `/movie/null` — **هو ما يُحرس منه هنا وفي الرسم.**
 */
export type FeedKind = "rate" | "movie" | "episodes" | "add" | "list_review";

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
  /** 🆕 **أعلن كاتبُ الرأي أن فيه حرقاً** (D-315، الهجرة ١٠٠) */
  hasSpoiler: boolean;
  /* 🆕 **صفُّ قائمةٍ لا صفُّ عمل** (الهجرة ١٠٦): وجهتُه `/lists/<id>`
     **وليس له `tmdb_id` أصلاً** — فحضورُ `listId` هو ما يبدّل الوجهة
     والعنوان، **وغيابُه يترك كلَّ صفٍّ قائمٍ كما هو** (D-063). */
  listId?: string | null;
  /** slug قائمةِ لوبز إن كانت منسّقة — الاسمُ يُترجَم عند العرض (D-328) */
  listSlug?: string | null;
  /* 🆕 **غلافُ القائمة — عريضٌ لا ملصق** (D-425، الهجرة ١١٩): مسارُ
     `backdrop` من TMDB، **وحقلٌ باسمه لا `poster_path` يحمل مقاسين**
     (D-224/D-312). **وغيابُه يعيد الصفَّ إلى فراغه القديم حرفاً.** */
  listCover?: string | null;
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
    /* 🆕 **والزائرُ يقرأ نشاطَ المجتمع كلِّه** (D-628، طلبُ أحمد: «يشوف
       كل الأنشطة»): كان `!me → []` فيرى الزائرُ تبويباً ميتاً — وخطُّ
       «المتابَعين» وحدَه ما يحتاج هويّةً، فيُقلب الزائرُ إلى «الكل»
       (الهجرة ١٣٥ فتحت `community_activity` له). */
    const effMode = me ? mode : "all";

    // نشاط المتابَعين أو المجتمع من دالة definer — الجداول ليست مفتوحة
    // القراءة، والدالّة تُرجع الأعمدة العامة وحدها مع إخفاء الاسم منفَّذاً
    // في SQL (supabase/activity_v2.sql و supabase/community_feed.sql)
    let { data: actRows, error } = await supabase.rpc(
      effMode === "all" ? "community_activity" : "following_activity_v2",
    );
    /* **ارتدادٌ حين تكون الدالّة غائبةً لا حين يفشل الاستعلام** (D-187):
       `community_activity` مكتوبةٌ في `supabase/community_feed.sql` منذ
       الهجرة ٢٧ **ولم تُشغَّل قطّ** — فكان «الكل» يعود فارغاً بصمت بينما
       «من أتابع» مليء، وهو أسوأ من عطلٍ ظاهر لأنه يُقرأ «لا أحد يكتب».
       فالارتدادُ يُبقي التبويب حيّاً بخطّ المتابَعين حتى تُشغَّل، **ثم
       يسقط من نفسه** يوم توجد. (نفس شكل حارس D-185: لا يُصدَّق الغياب
       قبل دليل.) */
    if (error && mode === "all") {
      ({ data: actRows, error } = await supabase.rpc("following_activity_v2"));
    }
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
      /* 🆕 D-315 — يغيب قبل الهجرة ١٠٠ فيُقرأ `false` */
      has_spoiler?: boolean;
      /* 🆕 **ذيلُ الهجرة ١٠٦** — يغيب قبلها فلا يتغيّر شيء (D-028) */
      list_id?: string | null;
      list_name?: string | null;
      list_slug?: string | null;
      /* 🆕 **ذيلُ الهجرة ١١٩** — يغيب قبلها فيُقرأ `null` (D-179) */
      list_cover?: string | null;
    };
    // صفٌّ بلا عنوان لا يُرسم — الملصق والعنوان يأتيان من `follows`، فإن
    // غاب الصفّ هناك (استيرادٌ ناقص مثلاً) لم يبقَ ما يُعرض
    const rows = (actRows as ActivityRow[]).filter((r) => r.title || r.review || r.list_id);
    if (!rows.length) return [];

    /* الإعجابات في ندائين متوازيين — أعدادٌ و«هل أعجبتُ به» بلا أي
       معرّف مُعجِب. صفُّ التقييم من `review_likes` (رأيٌ واحد برقمٍ واحد
       أينما ظهر)، وحدثُ المشاهدة من `activity_likes` بمفتاحٍ فيه **يوم**
       — لأن صفّ الخطّ نفسه مفتاحُه اليوم منذ D-123 (D-124). */
    /* ⚠️ **وصفُّ القائمة خارج البابين** (الهجرة ١٠٦): مفتاحُ الإعجاب
       `(شخص، عمل، وسيط)` **ولا عملَ في صفِّ قائمة** — فسؤالُه يعني
       نداءً بمعرّفٍ صفريّ يعود فارغاً دائماً. **ولا إعجابَ على مراجعة
       قائمةٍ اليوم** (لا جدولَ له)، **وزرٌّ لا يكتب شيئاً أسوأ من
       غيابه** (نصُّ D-123 حرفاً). */
    const rated = rows.filter((r) => !r.list_id && (r.kind ?? "rate") === "rate");
    const acted = rows.filter((r) => !r.list_id && (r.kind ?? "rate") !== "rate");
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
      /* **النوعُ من الصفّ لا من العمود وحدَه**: صفُّ القائمة يأتي من
         `community_activity` بلا عمود `kind` (شكلُها القديم يُطبَّع إلى
         `rate` هنا منذ D-123)، **فحضورُ `list_id` هو ما يسمّيه.** */
      const kind: FeedKind = r.list_id ? "list_review" : (r.kind ?? "rate");
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
        /* **وتقييمُ القائمة رقمٌ كتقييم العمل** — سلّمٌ واحدٌ من عشرة
           (D-002/D-327)، فيُرسم في موضعه نفسِه بلا فرعٍ في الواجهة. */
        rating: kind === "rate" || kind === "list_review" ? r.rating ?? null : null,
        review: review || null,
        title: r.list_id ? r.list_name ?? r.title : r.title,
        poster_path: r.poster_path,
        updated_at: when,
        day,
        episodeCount: Number(r.episode_count ?? 0),
        topSeason: Number(r.top_season ?? 0),
        likes: counts.get(k) ?? 0,
        likedByMe: mine.has(k),
        /* 🆕 D-315 — إعلانُ الكاتب يسافر مع الصفّ إلى الخطّ */
        hasSpoiler: Boolean(r.has_spoiler),
        /* 🆕 الهجرة ١٠٦ — الوجهةُ والاسمُ المترجَم يسافران مع الصفّ */
        listId: r.list_id ?? null,
        listSlug: r.list_slug ?? null,
        /* 🆕 الهجرة ١١٩ — غلافُ القائمة يسافر مع صفِّها (D-425) */
        listCover: r.list_cover ?? null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * 🆕 **«أعمالُ أصدقائك الآن» — صفُّ ملصقاتٍ لا خطُّ كلام** (البند ٧).
 *
 * ================= ولماذا صفٌّ وقد وُجد الخطّ =================
 *
 * **خطُّ النشاط يحكي، وهذا الصفُّ يعرض** (D-224: معنيان فسطحان). الخطُّ
 * في `/people` سطورٌ تُقرأ — **وسؤالُ الرئيسية «ماذا أشاهد؟» لا «ماذا
 * قالوا؟»**، **وجوابُه ملصقٌ يُفتح بضغطة.** **والدليلُ الاجتماعيُّ أقوى
 * مرشّحٍ نملكه** وكان محبوساً في صفحةٍ واحدة (D-262: أرخصُ ميزةٍ هي التي
 * بُنيت ولم تُوصَل).
 *
 * ================= وثمنُه نداءُ الخطّ نفسِه =================
 *
 * `following_activity_v2` **مجمَّعةٌ أصلاً صفّاً لكلِّ (شخص + عمل + يوم)**
 * (D-123) — **فلا استعلامَ جديدَ ولا جدول**، **ولا نداءاتِ إعجاباتٍ**:
 * الصفُّ لا يعرض رقماً فلا يسأل عنه (D-205).
 *
 * ⚠️ **والعملُ الواحد مرّةً واحدة** ولو تحرّك عند ثلاثة — **صفٌّ فيه
 * البطاقةُ نفسُها ثلاث مرّات يُقرأ عطلاً** (D-299). **وبلا ملصقٍ لا
 * بطاقة** (D-063)، **وأنا لستُ صديقَ نفسي** فصفّي يسقط.
 */
export interface FriendWatchRow {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  at: string;
}

export async function getFriendsWatching(limit = 12): Promise<FriendWatchRow[]> {
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return [];
    const { data, error } = await supabase.rpc("following_activity_v2");
    if (error || !data) return [];
    const out: FriendWatchRow[] = [];
    const seen = new Set<string>();
    for (const r of data as {
      id: string;
      tmdb_id: number;
      media_type: "tv" | "movie";
      title: string | null;
      poster_path: string | null;
      at?: string;
      updated_at?: string;
    }[]) {
      if (r.id === uid) continue;
      if (!r.tmdb_id || !r.title || !r.poster_path) continue;
      const key = `${r.media_type}-${r.tmdb_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        tmdb_id: r.tmdb_id,
        media_type: r.media_type === "tv" ? "tv" : "movie",
        title: r.title,
        poster_path: r.poster_path,
        at: r.at ?? r.updated_at ?? "",
      });
      if (out.length >= limit) break;
    }
    return out;
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
/* `cache()`: يُستدعى من الشريط العلويّ ومن الرئيسية ومن البريد في الطلب
   الواحد — كان RPC يُدفع مرّتين لكلّ فتحةٍ للرئيسية (شقيقُه getUnreadSignals
   مغلَّفٌ أصلاً للسبب نفسه). */
export const getUnreadShares = cache(async (): Promise<number> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("unread_shares");
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
});

/**
 * عدّاد شارة الجرس وحده (**D-125**).
 *
 * يُنادى في كل صفحة (الترويسة عامّة)، فيحمل **رقماً لا أسطراً**: الأسطر
 * تُطلب عند فتح الورقة بفعلٍ من العميل (نمط `myBlocksList`). والدالّة
 * غائبة قبل الهجرة ٤٧؟ صفرٌ صامت — الجرس بلا شارة لا شاشة خطأ.
 */
/**
 * متى رأى القارئ خطَّه آخر مرّة (D-149).
 *
 * `null` تعني «لم يفتحه قطّ» — وكلُّ حدثٍ حينها جديد، وهو الصحيح: من لم
 * يفتح الخطّ لم يرَ شيئاً منه. والدالّة غائبة قبل الهجرة ٥٧؟ `null`
 * صامتة، فيعود الترتيب إلى خوارزمية D-134 وحدها بلا شاشة خطأ.
 */
export async function getFeedSeenAt(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_feed_seen");
    if (error || !data) return null;
    const t = new Date(data as string).getTime();
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/* 🆕 **مغلَّفةٌ بـ`cache()`** (D-434): صارت لها قارئان في الطلب الواحد —
   الشريطُ العلويّ وترويسةُ الرئيسية الجديدة — **ونداءان لرقمٍ واحد في
   الصفحة نفسِها كذبٌ على الميزانية لا اقتصادٌ فيها.** */
export const getUnreadSignals = cache(async (): Promise<number> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("unread_signals");
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
});

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
    /* هويّاتُ الأطراف تُعرف من صفوف المشاركات نفسها لا من الردود — فطلبُ
       الردود وطلبُ الملفّات مستقلّان ويخرجان معاً: موجتان لا ثلاث. */
    const ids = new Set<string>();
    for (const s of shareRows) ids.add(otherOf.get(s.id)!);
    for (const s of listShareRows) ids.add(s.sender_id === me.id ? s.recipient_id : s.sender_id);
    const [{ data: replyRows }, { data: people }] = await Promise.all([
      shareIds.length
        ? supabase
            .from("share_replies")
            .select("id, share_id, author_id, body, created_at")
            .in("share_id", shareIds)
            .order("created_at", { ascending: true })
            .limit(2000)
        : Promise.resolve({ data: [] }),
      supabase
        .from("public_profiles")
        .select("id, nickname, username, avatar_url, hide_name")
        .in("id", [...ids]),
    ]);
    type ReplyRow = {
      id: string;
      share_id: string;
      author_id: string;
      body: string;
      created_at: string;
    };
    const replies = (replyRows ?? []) as ReplyRow[];
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
    /* 🆕 **الرقمان من دالّة `definer` لا من الجدول** (D-631، بلاغُ أحمد:
       «ما أقدر أشوف عدد المتابعين» من متصفّحٍ خفيّ): سياسةُ
       `user_follows` لدور `authenticated` وحدَه، **ولا يُفتح الجدولُ
       لـanon**: عدّادان يُعرضان علناً لا يبرّران تعدادَ شبكةِ المتابعات
       كلِّها عبر REST. **والدالّةُ تُرجع الرقمين وحدَهما وتحترم
       `can_view_profile`** — الهجرة ١٣٨. */
    const { data, error } = await supabase.rpc("follow_stats", { target: userId });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) {
      return {
        followers: Number((row as { followers?: number }).followers) || 0,
        following: Number((row as { following?: number }).following) || 0,
      };
    }
    /* **قارئٌ متسامح** (D-179): قبل تشغيل ١٣٨ لا دالّةَ — فيرتدّ إلى
       الاستعلام القديم، **وهو يعمل للعضو كما كان دائماً.** */
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

/**
 * **مَن أتابعهم، مجموعةَ معرّفاتٍ بنداءٍ واحدٍ مخزَّن** (D-225).
 *
 * **ولماذا لا `getFollowRelation` لكل صفّ:** خطُّ النشاط فيه عشرون كاتباً،
 * **وثلاثةُ استعلاماتٍ لكلٍّ منهم ستّون استعلاماً لرسمةٍ واحدة** — وهي
 * قاعدةُ «نداءٌ واحد لكل قسم، ولا نداء لكل صفّ» (D-164) حرفاً.
 *
 * **و«طلبتُ متابعته» ليست هنا عمداً:** حالةٌ ثالثة تعني استعلاماً ثانياً
 * على `follow_requests` لكل رسمة، **وقائمةُ الخطّ لا تحتاج التمييز**:
 * من ضغط «تابِع» على حسابٍ خاصّ يرى التوست الصحيح من الفعل نفسه
 * (`requestOrFollowUser` تُرجع الحالة). **والملفُّ العامّ يبقى صاحبَ
 * الزرّ ثلاثيّ الحالة.**
 */
export const getFollowingIds = cache(async (): Promise<Set<string>> => {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return new Set();
    const { data } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .limit(1000);
    return new Set((data ?? []).map((r) => String(r.following_id)));
  } catch {
    return new Set();
  }
});

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
//  تقييم الحلقات (episode_ratings.sql, D-139)
// ============================================================

export interface EpisodeRatingRow {
  season_number: number;
  episode_number: number;
  rating: number;
  review: string | null;
  updated_at: string;
}

/**
 * تقييمات شخصٍ في مسلسلٍ واحد — مفتاحُها `s-e` للبحث السريع عند الرسم.
 *
 * تُقرأ عبر definer لا بفتح الجدول: `episode_ratings` صفوفُ صاحبها،
 * والبوّابة `can_view_profile` داخل الدالّة. و`userId` غيابُه يعني
 * «أنا» — أكثر الاستدعاءات.
 *
 * **الدالّة غائبة؟ خريطةٌ فارغة** (نمط D-113): صفحة المسلسل تعمل بلا
 * نجومٍ بدل أن تسقط، فالكود يسبق الهجرة أحياناً.
 */
export async function getEpisodeRatings(
  showTmdbId: number,
  userId?: string,
): Promise<Map<string, EpisodeRatingRow>> {
  const out = new Map<string, EpisodeRatingRow>();
  try {
    const supabase = await createClient();
    const who = userId ?? (await getUser())?.id;
    if (!who) return out;
    const { data, error } = await supabase.rpc("episode_ratings_of", {
      p_user: who,
      p_show: showTmdbId,
    });
    if (error || !data) return out;
    for (const r of data as EpisodeRatingRow[]) {
      out.set(`${r.season_number}-${r.episode_number}`, r);
    }
    return out;
  } catch {
    return out;
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
    const uid = await getUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from("person_follows")
      .select("person_id, name, profile_path")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as ArtistLite[];
  } catch {
    return [];
  }
}

/**
 * فنّانو **شخصٍ آخر** — لقسم «فنّانوك» في بروفايله (D-129).
 *
 * دالّة definer لا استعلامٌ على الجدول: `person_follows` صفوفُ صاحبها
 * وحده بحكم RLS، فقراءتها هنا تعود بفراغٍ صامت. والبوّابة داخل الدالّة
 * (`can_view_profile`) لا هنا — الحساب الخاص لا يُفتح بترتيب صفحة.
 *
 * **الدالّة غائبة؟ مصفوفةٌ فارغة** (نمط D-113): القسم يختفي بلا شاشة
 * خطأ، فالكود يسبق الهجرة أحياناً.
 */
/**
 * عنصرٌ في صفّ «مفضّلاتي» بالبروفايل (D-152).
 *
 * `media_type` بنوعه الضيّق لا `string` كبقية صفوف هذا الملفّ: الصفوف
 * تمرّ على `localizeRows` (D-048) وهي تشترطه. والقاعدة تضمنه أصلاً بقيد
 * `check (media_type in ('tv','movie'))` على `user_list_items`.
 */
export interface FavoriteLite {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string | null;
  poster_path: string | null;
}

/**
 * مفضّلات صاحب بروفايلٍ أزوره (D-152).
 *
 * توأم `getProfileArtists` لا نسخته: نفس الشكل — دالّة definer تأخذ
 * صاحب الصفحة وتحرسه `can_view_profile` — والمختلف الصفوف وحدها.
 * و`getMyFavorites` تبقى لحالها: تلك **مجموعةُ مفاتيحك أنت** لتلوين
 * القلوب، وهذه **صفوفُ صاحب الصفحة** لترسم صفّاً.
 *
 * وسقوطُه يعيد صفّاً فارغاً فيغيب القسم بصمت — لا شاشةَ خطأ في صفحةٍ
 * عامّة لم يطلب صاحبُها شيئاً.
 */
export async function getProfileFavorites(userId: string): Promise<FavoriteLite[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("profile_favorites", { p_user: userId });
    if (error || !data) return [];
    return data as FavoriteLite[];
  } catch {
    return [];
  }
}

export async function getProfileArtists(userId: string, limit = 60): Promise<ArtistLite[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("profile_artists", {
      p_user: userId,
      p_limit: limit,
    });
    if (error || !data) return [];
    return data as ArtistLite[];
  } catch {
    return [];
  }
}

// ================= الطبقة الاجتماعية =================

/* **`PersonLite` و`displayNameOf` انتقلا إلى `people.ts`** (D-193) —
   ملفٌّ نقيٌّ يقرؤه مكوّنُ العميل أيضاً، لأن هذا الملفَّ يستورد عميلَ
   الخادم فيسقط البناء إن دخل حزمةَ المتصفّح. **ويُعاد تصديرُهما من هنا**
   كي لا يتغيّر سطرٌ في مئات الاستدعاءات القائمة. */
export type { PersonLite } from "./people";
export { displayNameOf } from "./people";

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
  /** وثائقيّ — علَمٌ يحمله صفُّ القائمة نفسه منذ الهجرة ٦٠ (D-165).
      **وقد يصل `false` لصفٍّ كُتب قبل إعادة ملء البِركة**، فالقارئ لا
      يفترض أنه يقين — انظر `filterRail`. */
  is_doc?: boolean;
}

/**
 * قائمة IMDb المثبَّتة (D-135) — المصدر الأول لمجموعات TOP 250.
 *
 * تُقرأ من `imdb_chart` الذي بُني من ملفّات IMDb المفتوحة، فبِركةُ
 * المرشّحين صارت IMDb كلّها لا أربعمئة عملٍ من TMDB. **والجدول فارغ أو
 * غائب؟ مصفوفةٌ فارغة** — والمستدعي يسقط إلى مسار D-132 القديم، فلا
 * تنكسر القوائم قبل أن تُشغَّل الهجرة أو تُملأ المسوّدة.
 */
/* `cache()`: يُطلب من أكثر من رفٍّ في /news بنفس المعاملات — ٢٥٠ صفّاً لا
   تُنقل مرّتين. (التخبئة بالمعاملات، فاختلافُها لا يخلط النتائج.) */
export const getImdbChart = cache(async (
  kind: "movie" | "tv" | "anime",
  limit = 250,
  /** جهةٌ داخل الصنف — للأنمي وحده اليوم: صنفُه يحمل أفلاماً ومسلسلاتٍ
      معاً منذ الهجرة ٦٠، ورفّاه منفصلان في الواجهة (D-169). */
  media?: "tv" | "movie",
): Promise<ChartRow[]> => {
  try {
    const supabase = await createClient();
    let q = supabase
      .from("imdb_chart")
      .select("tmdb_id, media_type, title, poster_path, rating, votes, is_doc")
      .eq("kind", kind);
    if (media) q = q.eq("media_type", media);
    const { data, error } = await q.order("rank", { ascending: true }).limit(limit);
    if (error || !data) return [];
    return data as ChartRow[];
  } catch {
    return [];
  }
});

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

/* ============================================================
   **أقسامُ تبويب «الناس»** (D-263 · الهجرة ٨١)
   ============================================================
   **ثلاثُ دوالِّ `security definer`** تقرأ باحترام `hide_name` والحظر،
   **ولا سياسةَ قراءةٍ خامسة**. والصفُّ يصل بأعمدةٍ `snake_case` فيُحوَّل
   هنا — **الواجهةُ لا ترى أسماءَ القاعدة** (نمطُ `getTalkRooms`).

   ⚠️ **والحارسُ في SQL لا هنا**: `auth.uid() is null` تعني صفراً من
   الصفوف، **فزائرٌ لا يرى شيئاً بلا فرعٍ في الواجهة.** */

/**
 * **صفُّ لوحة النشاط — والمقاييسُ الثلاثةُ تصل منفصلةً عمداً.**
 *
 * `total` مجموعُها، **و`prevTotal` مجموعُ النافذة السابقة** — فقسمُ
 * «الصاعدون» **طرحٌ في الواجهة لا نداءٌ ثانٍ** (D-198).
 * **ولا عمودَ نقاط**: الرقمُ المعروض يُراجَع بجمع مكوّناته (D-219).
 */
export interface PeopleLeaderRow extends PersonLite {
  posts: number;
  reviews: number;
  total: number;
  prevTotal: number;
}

/**
 * **نداءٌ واحدٌ يخدم قسمين** (D-198): «الأكثر مشاركة» و«الصاعدون».
 *
 * ⚠️ **والسقفُ عشرون لا خمسة** رغم أن كلَّ قسمٍ يعرض خمسة: الدالّةُ
 * ترتّب **بالمجموع**، **والصاعدُ قد يكون العاشر مجموعاً وهو الأوّل
 * فرقاً** — فسقفٌ بخمسةٍ كان يجعل القسم الثاني نسخةً من الأوّل بترتيبٍ
 * آخر. **والقصُّ في الواجهة بعد الفرزين** (وسقفُ الدالّة نفسُها ٢٠).
 *
 * **⚖️ والنافذةُ أسبوعٌ تقويميٌّ يبدأ السبت منذ الهجرة ٨٣** (D-265، طلبُ
 * أحمد «خلها يتصفر كل سبت» — **نقضٌ صريحٌ لجوابه في D-264**).
 * **فلا طولَ يُختار ولا معاملَ `p_days`**: المرساةُ في SQL بتوقيت
 * الرياض، **والواجهةُ تطلب العددَ وحده.**
 */
export async function getPeopleLeaderboard(limit = 20): Promise<PeopleLeaderRow[]> {
  try {
    const supabase = await createClient();
    /* **وحارسُ العبور حُذف** بعد أن شُغِّلت الهجرة ٨٣ وتحقّقت
       (`board_overloads=1` و`week_starts` ينتهي بسبت) — **حارسٌ مؤقّتٌ
       يُنسى يصير كذبةً عن حالة القاعدة** (D-151). */
    const { data, error } = await supabase.rpc("people_leaderboard", { p_limit: limit });
    if (error || !data) return [];
    return (data as {
      user_id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean | null;
      posts: number;
      reviews: number;
      total: number;
      prev_total: number;
    }[]).map((r) => ({
      id: String(r.user_id),
      nickname: r.nickname,
      username: r.username,
      avatar_url: r.avatar_url,
      hide_name: Boolean(r.hide_name),
      posts: Number(r.posts ?? 0),
      reviews: Number(r.reviews ?? 0),
      /* ⚖️ **وسقط `likes_in`** (D-312، الهجرة ٩٧) — بلا قارئٍ منذ D-285 */
      total: Number(r.total ?? 0),
      prevTotal: Number(r.prev_total ?? 0),
    }));
  } catch {
    return [];
  }
}

/**
 * **«أعضاء مميّزون» — نافذةُ تسعين يوماً** (D-270 · الهجرة ٨٥، طلبُ أحمد:
 * «ضِف بأوّل شي Featured Members»).
 *
 * **واختار محسوبين لا مختارين بيده** («الأكثر نشاطاً على المدى الطويل»)،
 * **وقيل له قبل الاختيار إن الوجوهَ ستتكرّر مع «الأكثر مشاركة»** — واختار.
 * **وحجّتُه صحيحةٌ فعلاً**: من تصدّر تسعين يوماً بنى عادةً، ومن تصدّر
 * سبتاً واحداً قد يكون مرّ (D-224: القرارُ يُقرأ بحجّته لا بعنوانه).
 *
 * ⚠️ **ودالّةٌ ثانيةٌ لا معاملٌ في `people_leaderboard`**: تلك صارت أسبوعاً
 * تقويميّاً يبدأ السبت (D-265) **و`p_days` أُسقطت عمداً يومَها** —
 * **وإعادتُها لتخدم نافذةً بمعنًى آخر تُرجع الكذبةَ التي أُسقطت**: دالّةٌ
 * اسمُها «لوحةُ الأسبوع» تُسأل عن تسعين يوماً.
 *
 * **والشكلُ نفسُه بالضبط** (`PeopleLeaderRow`) **كي يقرأها المكوّنُ نفسُه**:
 * `PeopleLeaderboard` بثلاثة أوضاع لا ثلاثةُ مكوّنات (D-145).
 * **و`prevTotal` تعود صفراً دائماً** — لا «صاعدين» على مدى تسعين يوماً،
 * **والحقلُ يبقى ليبقى الشكلُ واحداً** وهو أرخصُ من نوعٍ ثانٍ.
 */
export async function getPeopleFeatured(days = 90, limit = 3): Promise<PeopleLeaderRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("people_featured", {
      p_days: days,
      p_limit: limit,
    });
    if (error || !data) return [];
    return (data as {
      user_id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean | null;
      posts: number;
      reviews: number;
      total: number;
      prev_total: number;
    }[]).map((r) => ({
      id: String(r.user_id),
      nickname: r.nickname,
      username: r.username,
      avatar_url: r.avatar_url,
      hide_name: Boolean(r.hide_name),
      posts: Number(r.posts ?? 0),
      reviews: Number(r.reviews ?? 0),
      /* ⚖️ **وسقط `likes_in`** (D-312) — كأختها أعلاه */
      total: Number(r.total ?? 0),
      prevTotal: 0,
    }));
  } catch {
    return [];
  }
}

/** **أعلى التعليقات إعجاباً** (D-263 · D-264 — ثلاثةٌ لا واحد) */
export interface PeopleTopReviewRow extends PersonLite {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string | null;
  posterPath: string | null;
  /**
   * 🆕 **الغلافُ الحقيقيّ لخلفيّة البطاقة** (D-313، الهجرة ٩٨) —
   * `null` للصفوف القديمة **فتعود البطاقةُ لملصقها الممدود** (D-179).
   */
  backdropPath: string | null;
  review: string;
  rating: number;
  likes: number;
  createdAt: string;
  /** 🆕 **إعلانُ كاتبه** (D-315) */
  hasSpoiler: boolean;
}

/**
 * **والنافذةُ ثلاثون يوماً لا الأبد**: «أعلى تعليق» بلا نافذةٍ يتجمّد على
 * صفٍّ واحدٍ إلى الأبد فيصير زينةً لا خبراً (حجّةُ الهجرة ٨١).
 * **ولا إعجابَ ولا صفّ** — الدالّةُ تشترط `join` على الإعجابات.
 *
 * **⚠️ و`p_limit` معاملٌ منذ الهجرة ٨٢ وكان `limit 1` في جسم الدالّة**
 * (D-264، طلبُ أحمد «أظهر ٣ بدل واحد»): **حدٌّ متجمّدٌ في القاعدة ليس
 * حارساً، هو قرارٌ أُخذ عن الواجهة** — والحارسُ الحقيقيّ هو السقفُ
 * الأعلى (٢٠) لا الرقمُ المختار.
 */
export async function getPeopleTopReviews(
  days = 30,
  limit = 3,
): Promise<PeopleTopReviewRow[]> {
  try {
    const supabase = await createClient();
    /* **وحارسُ العبور حُذف** بعد أن شُغِّلت الهجرة ٨٢ وتحقّقت
       (`top_review_overloads=1`) — D-151. */
    const { data, error } = await supabase.rpc("people_top_review", {
      p_days: days,
      p_limit: limit,
    });
    if (error || !data) return [];
    return (data as {
      user_id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean | null;
      tmdb_id: number;
      media_type: string;
      title: string | null;
      poster_path: string | null;
      backdrop_path?: string | null;
      review: string | null;
      rating: number | null;
      likes: number;
      created_at: string;
      has_spoiler?: boolean;
    }[])
      /* **وصفٌّ بلا نصّ لا يُرسم**: الدالّةُ تشترطه، **والحارسُ هنا
         احتياطٌ لا تكرار** — قارئٌ متسامح (D-179). */
      .filter((r) => Boolean(r.review))
      .map((r) => ({
        id: String(r.user_id),
        nickname: r.nickname,
        username: r.username,
        avatar_url: r.avatar_url,
        hide_name: Boolean(r.hide_name),
        tmdbId: Number(r.tmdb_id),
        mediaType: r.media_type === "tv" ? "tv" : "movie",
        title: r.title,
        posterPath: r.poster_path,
        backdropPath: r.backdrop_path ?? null,
        review: String(r.review),
        rating: Number(r.rating ?? 0),
        likes: Number(r.likes ?? 0),
        createdAt: String(r.created_at),
        hasSpoiler: Boolean(r.has_spoiler),
      }));
  } catch {
    return [];
  }
}

/* ⚠️ **`getPeopleWatching` و`PeopleWatchingRow` حُذفا** (D-270، طلبُ أحمد
   بالحرف: «"Added to their libraries" ما نبغى»). **وكانا يعملان بلا عطل**
   — والحذفُ حكمُ صاحبِ المنتج على القسم لا حكمٌ على الشيفرة.
   **ودالّةُ `people_watching` تبقى في القاعدة حتى تُشغَّل الهجرة ٨٦**:
   **يُحذف القارئُ أوّلاً ثم المقروء** (D-028 معكوسةً)، **وإسقاطُها اليوم
   يُفرغ القسمَ في الإنتاج قبل أن تصل الشيفرةُ التي لا تناديه.** */

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
  /** 🆕 D-315 — يغيب قبل الهجرة ١٠٠ فيُقرأ `false` */
  has_spoiler?: boolean;
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
  /** 🆕 **إعلانُ كاتبه** (D-315) — يغيب قبل الهجرة ١٠٠ فيُقرأ `false` */
  has_spoiler?: boolean;
  /** عدد الإعجابات، وهل أعجبتُ بها، وهل هي مراجعتي */
  likes: number;
  likedByMe: boolean;
  isMine: boolean;
}

export interface ReviewReply extends PersonLite {
  /** معرّفُ الردّ — و`id` الموروثُ من `PersonLite` هو معرّفُ كاتبه */
  replyId: string;
  /** صاحبُ الرأي المردود عليه — مفتاحُ الخيط */
  reviewUserId: string;
  /** ردٌّ على ردّ؟ عمقٌ واحد فقط (الهجرة ٦٢ تمنع الثالث) */
  parentId: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
}

/**
 * ردودُ عملٍ واحد كلُّها في نداءٍ واحد (D-193، الهجرة ٦٢).
 *
 * **والدالّةُ هي من يحترم الإخفاءَ والحظرَ والمُبلَّغَ عنه** — لا الواجهة
 * (D-011/D-145). فلو قرأها سطحٌ ثانٍ يوماً قرأها بنفس الحدود.
 *
 * ونداءٌ واحد لكل الخيوط لا خيطاً خيطاً: صفحة `‎/talk` تعرض كلَّ آراء
 * العمل، وعشرون رأياً بعشرين نداءً هو ما نمنعه في كل قارئ (D-128).
 */
export async function getTitleReplies(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<ReviewReply[]> {
  try {
    const supabase = await createClient();
    const [{ data, error }, me] = await Promise.all([
      supabase.rpc("title_replies", { p_tmdb: tmdbId, p_type: mediaType }),
      getUser(),
    ]);
    if (error || !data) return [];
    return (data as {
      id: string;
      review_user_id: string;
      parent_id: string | null;
      author_id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean;
      body: string;
      created_at: string;
    }[]).map((r) => ({
      /* ⚠️ **و`id` هنا معرّفُ الكاتب لا معرّفُ الردّ** — لأن `ReviewReply`
         يمدّ `PersonLite`، و`PersonLite.id` معناه «صاحبُ الصفّ» في كل
         مكوّنٍ يقرؤه (`Avatar` · `displayNameOf` · زرُّ الحظر). ومعرّفُ
         الردّ نفسِه في `replyId`. **الاسمُ الملتبس يُسمّى ولا يُصلَح
         بالاصطلاح**: تغييرُ معنى `PersonLite.id` هنا كان سيكسر كلَّ
         مستدعٍ آخر. */
      id: r.author_id,
      nickname: r.nickname,
      username: r.username,
      avatar_url: r.avatar_url,
      hide_name: r.hide_name,
      replyId: r.id,
      reviewUserId: r.review_user_id,
      parentId: r.parent_id,
      body: r.body,
      createdAt: r.created_at,
      isMine: !!me && me.id === r.author_id,
    }));
  } catch {
    return [];
  }
}

/* **⚠️ `TalkStat` و`getTalkStats` حُذفتا** (D-266 — دَينُ D-214 يُقفَل):
   **سقط قارئُهما الوحيد في D-257** حين صار للغرفة مصدرُها
   (`title_talk_rooms`) وسقط التجميعُ بالعمل. **ومفتاحٌ بلا قارئ يُحذف لا
   يُترك**: بقاؤه يوحي بسطحٍ ثانٍ يستعمله، **فيُنسخ عنه من يريد عدّاداً
   بدل أن يقرأ القرار.**
   ⚠️ **ودالّةُ `title_talk_stats` باقيةٌ في القاعدة** — حذفُها هجرةٌ لا
   تستحقّ دفعةً وحدها، **وتُضمّ إلى أوّل هجرةٍ قادمة** (مكتوبٌ في `05`). */

/* ============================================================
 *  النقاشُ كيانٌ مستقلّ (D-257، الهجرة ٧٨)
 *
 *  **تصحيحُ أحمد بنصّه: «عندك لبس — النقاش ليس الريفيو، يختلف».**
 *  فما تحت هذين القارئين ليس `ratings` ولا `review_replies`، **هو
 *  `title_posts`** — جدولٌ لا نجمةَ فيه ولا صاحبَ للغرفة.
 * ============================================================ */

/**
 * **مشاركةٌ في غرفة نقاش** — وهي `ThreadReply` نفسُها زائدَ `depth`.
 *
 * **ولماذا نفسُ الشكل:** صفُّ الردّ في Loopz واحدٌ (`ReplyItem`، D-242)،
 * **وشكلٌ ثانٍ لنفس الصفّ يعني مكوّناً ثانياً يفترق عند أوّل إصلاح.**
 * **والعمقُ وحدَه جديد** لأن هذا الخيطَ شجرةٌ لا قائمة (طلبُ أحمد:
 * «تكون مثل Reddit لا مثل تويتر»).
 */
export interface TalkPost {
  postId: string;
  authorId: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  hide_name: boolean;
  parentId: string | null;
  /** ٠ للجذر، وسقفُه ٣ — **يحسبه المُشغِّل في القاعدة** لا العميل */
  depth: number;
  /**
   * ⚠️ **فارغٌ لنشرة Loopz** (D-261): متنُها يُصاغ عند العرض من `data`.
   * **ويبقى `string` لا `string | null`** كي لا يُجبَر كلُّ قارئٍ قائمٍ
   * على حارسٍ لا يحتاجه — **والقاعدةُ تضمن أن `kind` هو الفارق**.
   */
  body: string;
  createdAt: string;
  isMine: boolean;
  /** 🆕 D-261 — `null` لكلام البشر، و`"episode"` لنشرة Loopz */
  kind: string | null;
  /** حقائقُ النشرة (`BulletinData`) — تُصاغ جملةً في `i18n.ts` */
  data: Record<string, unknown> | null;
  /**
   * 🆕 **أعلن صاحبُه أن فيه حرقاً** (D-268، هجرة ٨٤).
   *
   * ⚠️ **وهو غيرُ `spoiler` تحته**: تلك تحجب **نصّاً ثانياً** في نشرة
   * Loopz والمتنُ الظاهر يبقى، **وهذه تحجب المتنَ نفسَه.**
   * **ولا يجتمعان على صفّ.**
   */
  hasSpoiler: boolean;
  /** النثرُ المحجوب بلغتيه — `{ ar?, en? }` */
  spoiler: Record<string, unknown> | null;
  /**
   * 🆕 **صورةُ المشاركة عموداً حقيقيّاً** (D-312، الهجرة ٩٧) — سكنت
   * `data.img` يومَ D-298 لأن العمودَ كان يوجب `drop` خارجَ الإذن،
   * **وحقيبةُ `jsonb` لمعنيين بابُ العطل الصامت** (D-224). **والدالّةُ
   * تُرجع `coalesce`** فصفوفُ النافذة الانتقالية لا تفقد صورتَها.
   */
  imagePath: string | null;
  /** 🆕 **معرّفُ Giphy وحدَه — لا رابط** (D-362): الرابطُ يُركَّب من قالبٍ
      ثابتٍ في الواجهة، **فما يُخزَّن حروفٌ وأرقامٌ لا عنوان.** */
  gifId: string | null;
}

/**
 * **خيطُ غرفةٍ كاملاً بنداءٍ واحد** (الهجرة ٧٨).
 *
 * **والشجرةُ تُبنى في الواجهة لا في SQL**: السقفُ ٣٠٠ صفّاً ومعها
 * `parent_id`، **وترتيبُ شجرةٍ في SQL يكلّف `recursive` لأمرٍ تفعله
 * الواجهةُ في تمريرةٍ واحدة** (D-240).
 *
 * **وسقوطُها صامت** قبل تشغيل الهجرة: غرفةٌ فارغةٌ وصندوقُ كتابةٍ يعمل.
 */
export async function getTitleThread(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<TalkPost[]> {
  try {
    const supabase = await createClient();
    const [{ data, error }, me] = await Promise.all([
      supabase.rpc("title_thread", { t_id: tmdbId, m_type: mediaType }),
      getUser(),
    ]);
    if (error || !data) return [];
    return (data as {
      id: string;
      parent_id: string | null;
      depth: number;
      author_id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean;
      body: string | null;
      created_at: string;
      /* 🆕 D-261 — **تغيب قبل تشغيل الهجرة ٨٠ فتُقرأ `undefined`**،
         والحارسُ `?? null` يجعل الصفَّ يُقرأ كلامَ إنسانٍ كما كان */
      kind?: string | null;
      data?: Record<string, unknown> | null;
      spoiler?: Record<string, unknown> | null;
      /* **وتغيب قبل الهجرة ٨٤** فتُقرأ `false` — والمتنُ يظهر كما كان */
      has_spoiler?: boolean | null;
      /* **وتغيب قبل الهجرة ٩٧** فتُقرأ `null` — والقارئُ يعود لـ`data` */
      image_path?: string | null;
    }[]).map((r) => ({
      postId: String(r.id),
      authorId: String(r.author_id),
      nickname: r.nickname,
      username: r.username,
      avatar_url: r.avatar_url,
      hide_name: r.hide_name,
      parentId: r.parent_id,
      depth: Number(r.depth ?? 0),
      body: r.body ?? "",
      createdAt: r.created_at,
      isMine: !!me && me.id === r.author_id,
      kind: r.kind ?? null,
      data: r.data ?? null,
      spoiler: r.spoiler ?? null,
      hasSpoiler: Boolean(r.has_spoiler),
      imagePath: r.image_path ?? null,
      /* 🆕 D-362 — **يُقرأ متسامحاً وغيابُه `null`** (D-179) */
      gifId: (r as { gif_id?: string | null }).gif_id ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * **بطاقةُ غرفةٍ حيّة** — والغرفةُ `(tmdb_id, media_type)` لا صفٌّ في
 * جدول (قرارُ أحمد: «غرفةٌ واحدة لكل عمل، عنوانُها مولَّد»).
 */
export interface TalkRoom {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string | null;
  posterPath: string | null;
  /** **خلفيّةُ البطاقة** (طلبُ أحمد: «الخلفية تكون من غلاف الفلم») */
  backdropPath: string | null;
  /** **كلامُ الناس وحدَه** — النشراتُ لا تُحسب (D-311، الهجرة ٩٦) */
  posts: number;
  /** 🆕 **مشاركاتُ أسبوعِ السبت الجاري** (D-311) — لسطح D-291 الصادق */
  postsWeek: number;
  lastAt: string;
  /** أحدثُ خمسةِ متكلّمين — **أشخاصٌ لا مشاركات** */
  faces: PersonLite[];
  /**
   * 🆕 **`data` أحدثِ نشرةِ حلقةٍ نشرها Loopz في الغرفة** (D-273 · الهجرة
   * ٨٧) — `s` و`e` و`name_ar` و`name_en`، **وهي هي حقولُ الهجرة ٨٠**
   * فيقرؤها `bulletinLine` نفسُه ولا تُفكَّك هنا.
   *
   * ⚠️ **ومعناها «آخرُ ما نشرناه هنا» لا «الحلقةُ التي يناقشونها»** —
   * والثانيةَ لا نعلمها (D-216). **و«يتحدّث دوريّاً» يقع مجّاناً**:
   * الدالّةُ تقرأ الأحدث، فأيُّ نشرٍ يزيح ما قبله بلا cron.
   */
  bulletin: Record<string, unknown> | null;
}

/**
 * **الغرفُ الحيّة مرتَّبةً بأحدث مشاركة** (`title_talk_rooms`).
 *
 * **ولا غرفةَ فارغة**: الغرفةُ تولد بأوّل مشاركةٍ وتموت بآخرها،
 * **وجدولُ غرفٍ فارغةٍ سجلٌّ لا قارئ له** (D-224).
 *
 * ⚠️ **والاسمُ `title_talk_rooms` لا `title_rooms`** — الثاني مشغولٌ
 * بغرف المجتمعات التلقائية (`getTitleRooms` أدناه)، **وردّت القاعدةُ
 * المحاولةَ بنفسها**: اسمٌ يبدو حرّاً قد يكون بيتَ ميزةٍ أخرى.
 */
/**
 * 🆕 **غرفي المثبَّتة** (D-301، الهجرة ٩٢) — **مفاتيحُ لا صفوف.**
 *
 * **ولا دالّةَ `definer`**: الصفوفُ صفوفي، **وسياسةُ القراءة «صفوفي أنا»
 * تكفي** — **ودالّةُ `definer` تُكتب حين يُقرأ ما ليس لك** (٩٠ كانت تعدّ
 * إعجاباتِ الناس كلِّهم). **وأرخصُ دالّةٍ هي التي لا تُكتب** (D-266).
 *
 * **والمفتاحُ `mediaType-tmdbId`** — صيغةُ `likeKey` نفسُها في هذه
 * الصفحة، **فلا صيغةَ ثانيةٌ تفترق يوماً** (D-237/D-261).
 *
 * **وسقوطُه صامتٌ**: قبل تشغيل ٩٢ تعود مجموعةٌ فارغة **فتُرسم البطاقاتُ
 * بلا تثبيت ولا ينكسر شيء** (D-151/D-179).
 */
/**
 * 🆕 **الغرفُ المثبَّتة إداريّاً — يراها الجميع** (D-314، الهجرة ٩٩).
 *
 * **دالّةُ `definer` لا سياسة**: سياسةُ قراءةٍ عامّةٌ كانت ستكسر ثابتَ
 * «أربع سياسات مفتوحة» (D-013) لأجل صفوفٍ قليلة. **والمفتاحُ
 * `mediaType-tmdbId`** — صيغةُ `likeKey` نفسُها (D-237).
 * **وسقوطُه صامتٌ** (D-179): قبل ٩٩ مجموعةٌ فارغةٌ ولا شيء ينكسر.
 */
export async function getGlobalRoomPins(): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("global_room_pins");
    if (error || !data) return out;
    for (const r of data as { tmdb_id: number; media_type: string }[]) {
      out.add(`${r.media_type}-${r.tmdb_id}`);
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * 🆕 **هل أنا إدارة؟** (D-314) — سؤالُ زرٍّ واحدٍ في تبويب «نقاش»:
 * `is_admin or is_system` تحسمه القاعدةُ لا الواجهة (D-011)،
 * **والجوابُ هنا للرسم وحدَه** — الحارسُ الحقيقيُّ في جسم دالّة
 * الكتابة. **وسقوطُه `false`** — زرٌّ يغيب خيرٌ من زرٍّ يكذب.
 */
export async function getAmAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("am_admin");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * 🆕 **روابطُ المنصّات المباشرة لعملٍ وبلد** (D-608) — نداءٌ واحدٌ يعيد
 * كلَّ منصّات الصفحة (لا N+1)، والدالّةُ في القاعدة تعيد الموثَّقَ
 * (`verified`) وحدَه — **فالمعطَّلُ يختفي في الطلب التالي بلا كاشٍ
 * يُبطَل** (الصفحةُ ديناميكيّةٌ أصلاً والقراءةُ فهرسٌ فريد).
 * **والفشلُ خريطةٌ فارغة**: بطاقةٌ بلا رابطٍ تفتح ورقةَ الخيارات،
 * ولا شاشةَ خطأ لميزةٍ ثانويّة.
 */
export async function getProviderLinks(
  tmdbId: number,
  mediaType: "tv" | "movie",
  country: string,
): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("provider_links_for", {
      p_tmdb: tmdbId,
      p_media: mediaType,
      p_country: country,
    });
    if (error || !data) return out;
    for (const r of data as { provider_id: number; destination_url: string }[]) {
      out[r.provider_id] = r.destination_url;
    }
    return out;
  } catch {
    return out;
  }
}

export async function getMyRoomPins(): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("title_room_pins")
      .select("tmdb_id, media_type");
    if (error || !data) return out;
    for (const r of data as { tmdb_id: number; media_type: string }[]) {
      out.add(`${r.media_type}-${r.tmdb_id}`);
    }
    return out;
  } catch {
    return out;
  }
}

export async function getTalkRooms(limit = 40): Promise<TalkRoom[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("title_talk_rooms", { p_limit: limit });
    if (error || !data) return [];
    return (data as {
      tmdb_id: number;
      media_type: string;
      title: string | null;
      poster_path: string | null;
      backdrop_path: string | null;
      posts: number;
      posts_week?: number;
      last_at: string;
      faces: PersonLite[] | null;
      bulletin?: Record<string, unknown> | null;
    }[]).map((r) => ({
      tmdbId: Number(r.tmdb_id),
      mediaType: r.media_type === "tv" ? "tv" : "movie",
      title: r.title,
      posterPath: r.poster_path,
      backdropPath: r.backdrop_path,
      posts: Number(r.posts),
      /* **قارئٌ متسامح** (D-179): قبل الهجرة ٩٦ لا عمودَ له فيصل صفراً */
      postsWeek: Number(r.posts_week ?? 0),
      lastAt: String(r.last_at),
      faces: Array.isArray(r.faces) ? r.faces.slice(0, 5) : [],
      /* **قارئٌ متسامح** (D-179): قبل الهجرة ٨٧ لا عمودَ لها فتصل
         `undefined` — **والبطاقةُ تُرسم بلا سطر ولا شاشةَ خطأ.** */
      bulletin: r.bulletin ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * 🆕 **العملُ الذي يدور حوله الكلام — اختيارٌ لا نداء** (D-291).
 *
 * **تُمرَّر لها الغرفُ المجلوبةُ أصلاً**، **فلا نداءَ ثانٍ ولا هجرة**
 * (D-194: ما يُدفع مرّةً لا يُدفع مرّتين).
 *
 * ================= 🆕 D-311 — الأسبوعُ صار رقماً يُملك =================
 *
 * **كان الشرطان: حيّةٌ خلال سبعةِ أيام ثم الأعلى مشاركاتٍ كلَّ العمر** —
 * لأن `title_talk_rooms` لم تكن تملك عدَّ نافذة، **وكاد العنوانُ يقول
 * «هذا الأسبوع» فوق رقمٍ عمرُه سنة** (D-219) فسقطت العبارةُ يومَها.
 * **والآن `posts_week` من الهجرة ٩٦**: الاختيارُ بالعدّ الأسبوعيّ
 * نفسِه — **`postsWeek > 0` يغني عن ساعة الحائط** (فسقط `Date.now()`
 * ومعه سببُ التحذير الأصليّ)، **وغرفةٌ كلامُها القديمُ كثيرٌ وأسبوعُها
 * صفرٌ لا تتصدّر لوحةً تقول «هذا الأسبوع».**
 *
 * **وعند التساوي تفوز الأحدث**: `reduce` تُبقي الأولى **والصفوفُ تصل
 * مرتّبةً بـ`last_at` تنازليّاً** — **تعادلٌ يُحسم بمعنًى لا بالصدفة.**
 */
export function pickTalkedAboutRoom(rooms: TalkRoom[]): TalkRoom | null {
  const live = rooms.filter((r) => r.postsWeek > 0);
  if (!live.length) return null;
  return live.reduce((best, r) => (r.postsWeek > best.postsWeek ? r : best));
}

/**
 * **عدّادُ ردودِ النشرات — نداءٌ واحد للخطّ كلِّه** (D-236/D-164).
 *
 * **وسقوطُه صامت**: قبل تشغيل الهجرة ٧٣ تعود الخريطةُ فارغةً فتُخفى
 * الأرقام ويبقى الخطُّ مقروءاً — **آمنٌ عند الغياب** (D-151).
 */
/**
 * 🆕 **إعجاباتُ مشاركات الغرفة — عددُها وحالتي، في نداءٍ واحد** (D-289،
 * الهجرة ٩٠، طلبُ أحمد: «لازم فيه لايك عند كل ردّ»).
 *
 * **نداءٌ واحدٌ للغرفة كلِّها لا لكلِّ صفّ** (D-164/D-205) — والغرفةُ قد
 * تحمل عشراتِ المشاركات. **و«هل أعجبتُ أنا» تأتي مع العدد** لأنهما
 * سؤالان عن صفٍّ واحد (D-198).
 *
 * ⚠️ **والسقوطُ صامتٌ ومقصود**: قبل تشغيل ٩٠ تعود الخريطتان فارغتين،
 * **فيُرسم الزرُّ بصفرٍ لا ينكسر شيء** (D-028/D-179).
 */
/**
 * 🆕 **ردودُ آراءِ الناس — النصفُ الغائب من ترجيح D-283** (الهجرة ٨٩).
 *
 * **صيغةُ أحمد كانت «كل لايك ينقص نصف ساعة وكل ردّ ساعة»**، وشُحن نصفُها
 * في D-283 **لأن عدّادَ الردود كان لنشراتنا وحدها** (`news_reply_counts`).
 * **وهذه تُكمله** — والمفتاحُ صيغةُ `commentViewKey` نفسُها فلا صيغةَ
 * خامسة (D-237).
 *
 * ⚠️ **وسقوطُها صامتٌ ومقصود** (D-179): قبل ٨٩ تعود خريطةً فارغة
 * **فيبقى الترتيبُ زمنيّاً بالإعجابات وحدَها** — لا ينكسر شيء.
 */
export async function getReviewReplyCounts(keys: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(keys)].slice(0, 200);
  if (!unique.length) return out;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("review_reply_counts", { keys: unique });
    if (error || !data) return out;
    for (const r of data as { post_key: string; replies: number }[]) {
      out.set(String(r.post_key), Number(r.replies));
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * 🆕 **أكثرُ القوائم حفظاً — أعلى ٣ في آخر ٧ أيام** (D-289، الهجرة ٩٠،
 * طلبُ أحمد: «ضيف أكثر الليستات إضافةً للمكاتب أو حفظاً، وأظهر أعلى ٣
 * آخر ٧ أيام»).
 *
 * **والدالّةُ هي من تحرس** (D-011): العامّةُ وحدَها، و`hide_name`،
 * والحظر، **وحسابُ النظام خارجَها** — **لا الواجهة.**
 * **والملصقاتُ الثلاثةُ تأتي مع الصفّ** فلا نداءَ ثانٍ لصورها (D-164).
 */
export interface SavedListRow {
  listId: string;
  name: string;
  ownerId: string;
  nickname: string | null;
  username: string | null;
  avatarUrl: string | null;
  hideName: boolean;
  saves: number;
  posters: string[];
}

export async function getTopSavedLists(days = 7, limit = 3): Promise<SavedListRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("top_saved_lists", {
      p_days: days,
      p_limit: limit,
    });
    if (error || !data) return [];
    return (data as {
      list_id: string;
      name: string;
      owner_id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean;
      saves: number;
      posters: string[] | null;
    }[]).map((r) => ({
      listId: String(r.list_id),
      name: String(r.name ?? ""),
      ownerId: String(r.owner_id),
      nickname: r.nickname,
      username: r.username,
      avatarUrl: r.avatar_url,
      hideName: Boolean(r.hide_name),
      saves: Number(r.saves) || 0,
      posters: (r.posters ?? []).filter(Boolean),
    }));
  } catch {
    /* **سقوطٌ صامتٌ قبل الهجرة ٩٠** — والقسمُ لا يُرسم أصلاً بلا صفوف */
    return [];
  }
}

/**
 * 🆕 **قوائمُ تناسبك — التقاطعُ مع مكتبتك** (D-324، الهجرة ١٠٢).
 *
 * **ونفسُ شكل `getTopSavedLists` حرفاً** (D-145): الدالّتان تُغذّيان صفَّين
 * متجاورين في تبويبٍ واحد، **وشكلان مختلفان لصفّين متجاورين هما كيف
 * يفترق مكوّناهما يوماً**. والعددُ في `saves` هنا معناه «كم منها عندك»،
 * **والعنوانُ فوق الصفّ هو ما يقول ذلك** (D-219).
 *
 * ⚠️ **وسقوطُها صامتٌ**: قبل تشغيل الهجرة يعود الصفُّ فارغاً فلا يُرسم —
 * **ولا شاشةَ خطأٍ لأجل صفٍّ زينة** (درسُ ٥٨/٦٠).
 */
export async function getForYouLists(limit = 12): Promise<SavedListRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("for_you_lists", { p_limit: limit });
    if (error || !data) return [];
    return (data as {
      list_id: string;
      name: string;
      owner_id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean;
      saves: number;
      posters: string[] | null;
    }[]).map((r) => ({
      listId: String(r.list_id),
      name: String(r.name ?? ""),
      ownerId: String(r.owner_id),
      nickname: r.nickname,
      username: r.username,
      avatarUrl: r.avatar_url,
      hideName: Boolean(r.hide_name),
      saves: Number(r.saves) || 0,
      posters: (r.posters ?? []).filter(Boolean),
    }));
  } catch {
    return [];
  }
}

export async function getPostLikes(
  ids: string[],
): Promise<{ counts: Record<string, number>; mine: string[] }> {
  const unique = [...new Set(ids)].slice(0, 300);
  const empty = { counts: {} as Record<string, number>, mine: [] as string[] };
  if (!unique.length) return empty;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("post_like_counts", { ids: unique });
    if (error || !data) return empty;
    const counts: Record<string, number> = {};
    const mine: string[] = [];
    for (const r of data as { post_id: string; n: number; mine: boolean }[]) {
      counts[String(r.post_id)] = Number(r.n) || 0;
      if (r.mine) mine.push(String(r.post_id));
    }
    return { counts, mine };
  } catch {
    return empty;
  }
}

/**
 * 🆕 **أصواتُ الغرفة — نداءٌ واحدٌ لكلِّ مشاركاتها** (D-305، الهجرة ٩٤).
 *
 * نمطُ `getPostLikes` حرفاً: **المفاتيحُ معرّفاتُ الخيط نفسِه** فلا
 * تُنادى قبله، **والسقوطُ صامتٌ** — غرفةٌ بلا أرقامٍ خيرٌ من غرفةٍ لا
 * تُفتح (D-179). **و`mine` رقمٌ لا قائمة**: الصوتُ ثلاثُ حالاتٍ
 * (١ / -١ / لا شيء) **وقائمةُ عضويّةٍ تحمل حالتين فقط.**
 */
export async function getPostVotes(
  ids: string[],
): Promise<{ scores: Record<string, number>; mine: Record<string, number> }> {
  const unique = [...new Set(ids)].slice(0, 300);
  const empty = { scores: {} as Record<string, number>, mine: {} as Record<string, number> };
  if (!unique.length) return empty;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("post_vote_scores", { ids: unique });
    if (error || !data) return empty;
    const scores: Record<string, number> = {};
    const mine: Record<string, number> = {};
    for (const r of data as { post_id: string; score: number; mine: number }[]) {
      scores[String(r.post_id)] = Number(r.score) || 0;
      if (r.mine) mine[String(r.post_id)] = Number(r.mine);
    }
    return { scores, mine };
  } catch {
    return empty;
  }
}

export async function getNewsReplyCounts(keys: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(keys)].slice(0, 200);
  if (!unique.length) return out;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("news_reply_counts", { keys: unique });
    if (error || !data) return out;
    for (const r of data as { post_key: string; replies: number }[]) {
      out.set(String(r.post_key), Number(r.replies));
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * **ردودُ نشرةٍ واحدة** (D-239، الهجرة ٧٣) — مستهلكُ `news_post_thread`.
 *
 * **وهي الثغرةُ التي أغلقتها هذه الدفعة:** الردُّ كان يُكتب منذ D-236
 * **ولا يراه أحدٌ بعد إرساله** — الدالّةُ مكتوبةٌ في الهجرة وبلا قارئ.
 * **وسطحُ كتابةٍ بلا سطحِ قراءةٍ ليس ميزةً ناقصة، هو وعدٌ مكسور.**
 *
 * **والدالّةُ هي من تحترم الإخفاءَ والحظر** لا الواجهة (D-011/D-145)،
 * **وسقوطُها صامت** قبل تشغيل ٧٣: خيطٌ فارغٌ وصندوقُ كتابةٍ يعمل.
 */
export interface NewsReply {
  replyId: string;
  /** كاتبُ الردّ */
  authorId: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  hide_name: boolean;
  /** ردٌّ على ردّ؟ عمقٌ واحد فقط (حارسُ الهجرة ٧٣) */
  parentId: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
}

/**
 * **وجهي واسمي** (D-242) — لصفِّ الكتابة وللنسخة التفاؤلية.
 *
 * **ولماذا يُقرأ في الصفحة لا في المكوّن:** المكوّنُ عميل، **ونداءٌ منه
 * يعني وميضاً**: يُرسم الصفُّ بلا وجهٍ ثم يقفز. والصفحةُ تعرفه قبل أن
 * تُرسل الحرفَ الأوّل.
 */
export const getMyProfileLite = cache(
  async (): Promise<{ name: string; avatar: string | null } | null> => {
    try {
      const user = await getUser();
      if (!user) return null;
      const supabase = await createClient();
      const { data } = await supabase
        .from("profiles")
        .select("nickname, username, avatar_url, hide_name")
        .eq("id", user.id)
        .maybeSingle();
      const hidden = !!data?.hide_name;
      return {
        name: hidden ? "" : (data?.nickname ?? data?.username ?? ""),
        avatar: hidden ? null : (data?.avatar_url ?? null),
      };
    } catch {
      return null;
    }
  },
);

export async function getNewsThread(postKey: string): Promise<NewsReply[]> {
  const key = String(postKey ?? "").trim();
  if (!key) return [];
  try {
    const supabase = await createClient();
    const [{ data, error }, me] = await Promise.all([
      supabase.rpc("news_post_thread", { p_key: key }),
      getUser(),
    ]);
    if (error || !data) return [];
    return (
      data as {
        id: string;
        parent_id: string | null;
        author_id: string;
        nickname: string | null;
        username: string | null;
        avatar_url: string | null;
        hide_name: boolean;
        body: string;
        created_at: string;
      }[]
    ).map((r) => ({
      replyId: r.id,
      authorId: r.author_id,
      nickname: r.nickname,
      username: r.username,
      avatar_url: r.avatar_url,
      hide_name: !!r.hide_name,
      parentId: r.parent_id,
      body: r.body,
      createdAt: r.created_at,
      isMine: !!me && me.id === r.author_id,
    }));
  } catch {
    return [];
  }
}

/**
 * **نشرةٌ واحدة بمفتاحها** — للصفحة التي تحمل خيطَها.
 *
 * ⚠️ **ولا دالّةَ SQL جديدة لها عن قصد:** كانت ستكون الهجرةَ ٧٥،
 * **وصفحةٌ لا تعمل حتى تُشغَّل هجرةٌ ليست صفحة**. والمقصُّ يبقي ٣٠٠
 * منشورٍ على الأكثر (`prune_news_posts`)، **فقراءةُ الثلاثمئة والبحثُ
 * فيها سقفٌ معروفٌ لا نموّ**: نداءٌ واحدٌ لفتحةِ صفحةٍ واحدة.
 * **يوم يكبر الأرشيفُ تُكتب الدالّة** — ولا تُكتب قبل أن تلزم.
 */
/**
 * 🆕 **نشراتُ Loopz عن عملٍ بعينه** (D-300، طلبُ أحمد: «يُفضّل في صفحة
 * الفلم يكون فيه تبويب أخبار أو تحديث ويُكتب فيه»).
 *
 * 🆕 **والقصُّ صار في القاعدة** (D-312، الهجرة ٩٧): كان الترشيحُ هنا —
 * «اقرأ ثلاثمئةً ورشّح» — **وسقفُ الدالّة ٦٠ أصلاً، فكان يُرشَّح ممّا
 * وصل لا ممّا وُجد**: خبرُ عملٍ خرج من آخر ستّين نشرةً كان يغيب عن
 * تبويبه وهو في الجدول. **والدالّةُ الثالثةُ الوسائط تعرف العملَ**
 * (D-164: المرشَّحون يُقصّون قبل أن يُنادى لهم) — **ولا `drop`
 * للقديمة**: توقيعٌ ثانٍ لا بديل.
 *
 * **وهي خلف `Suspense` في الصفحة** فلا تؤخّر رسمَها (D-071).
 */
export async function getTitleLoopzNews(
  tmdbId: number,
  mediaType: "tv" | "movie",
  limit = 20,
): Promise<LoopzNewsItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("loopz_news", {
      p_limit: limit,
      p_tmdb: tmdbId,
      p_media: mediaType,
    });
    if (error || !data) return [];
    /* **بلا تطبيع كأختها `getLoopzNews`** — الدالّتان تُرجعان الأعمدةَ
       الثمانية نفسَها حرفاً */
    return data as LoopzNewsItem[];
  } catch {
    return [];
  }
}

export async function getNewsPost(postKey: string): Promise<LoopzNewsItem | null> {
  const key = String(postKey ?? "").trim();
  if (!key) return null;
  const all = await getLoopzNews(300);
  return all.find((n) => n.key === key) ?? null;
}

/**
 * **عدُّ مشاهداتِ المنشورات** (D-237) — نداءٌ واحد للخطّ كلِّه (D-164).
 *
 * **وسقوطُه صامتٌ** كأخيه في ٧٣: قبل الهجرة ٧٤ لا دالّةَ، **فتعود خريطةٌ
 * فارغة وتُخفى الخانةُ ويبقى الخطُّ مقروءاً**. **ورقمٌ غائبٌ خيرٌ من صفحةٍ
 * ساقطة** — والعدّادُ زينةٌ لا ركن.
 */
export async function getPostViewCounts(keys: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(keys)].slice(0, 200);
  if (!unique.length) return out;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("post_view_counts", { keys: unique });
    if (error || !data) return out;
    for (const r of data as { post_key: string; views: number }[]) {
      out.set(String(r.post_key), Number(r.views));
    }
    return out;
  } catch {
    return out;
  }
}

/** مراجعات عمل معيّن مع أصحابها */
/* `cache()`: generateMetadata وصفحةُ المراجعة يطلبانها معاً — ٤ RPC بدل ٢. */
export const getTitleReviews = cache(async (
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<TitleReview[]> => {
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
});

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

/** نوع الغرفة (هجرة 53): غرفةُ شخصٍ يملكها، أو غرفةُ عملٍ لا يملكها أحد */
export type CommunityKind = "user" | "title";

/** مجتمعٌ كما يظهر في الدليل والبحث */
export interface CommunityLite {
  id: string;
  name: string;
  is_private: boolean;
  /** `null` لغرفة العمل — لا مالكَ لها، وهذا ما يفكّ عنها قيدَ الفرادة */
  owner_id: string | null;
  /** صورة المجتمع — يرفعها المالك (هجرة 41)؛ ولغرفة العمل ملصقُه */
  photo_url?: string | null;
  member_count: number;
  /** علاقتي به — يأتي من search_communities فقط */
  my_status?: "member" | "requested" | "none";
  /** هجرة 53 — غياب الحقل يعني قاعدةً لم تُهاجَر بعد، فالافتراض `user` */
  kind?: CommunityKind;
  tmdb_id?: number | null;
  media_type?: "tv" | "movie" | null;
  archived?: boolean;
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
  owner_id: string | null;
  photo_url: string | null;
  /** هجرة 53 — غرفةُ عملٍ تُقرأ قبل الانضمام وترويستُها تربط بالعمل */
  kind: CommunityKind;
  tmdb_id: number | null;
  media_type: "tv" | "movie" | null;
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
      .select("id, name, is_private, owner_id, photo_url, kind, tmdb_id, media_type")
      .eq("id", id)
      .maybeSingle();
    if (!c) return null;
    // `owner_id` قد يكون null (غرفة عمل) — والمساواة به تكذب لو تُركت
    const isOwner = !!c.owner_id && c.owner_id === me.id;

    const [memberRows, msgRows, reqRows, myReq, inviteRows, countRow] = await Promise.all([
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
      // العدد الحقيقي (هجرة 53): قائمة الأعضاء محروسةٌ بالعضوية، فكان
      // غيرُ العضو — وهو من يقرأ غرفة العمل الآن — يرى «٠ أعضاء»
      supabase.rpc("community_member_count", { p_community: id }),
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
      kind: (c.kind as CommunityKind) ?? "user",
      tmdb_id: c.tmdb_id ?? null,
      media_type: (c.media_type as "tv" | "movie" | null) ?? null,
      invitedIds: (inviteRows.data ?? []).map((r) => r.user_id),
      isOwner,
      isMember,
      requested: !!myReq.data,
      member_count: Math.max(Number(countRow?.data ?? 0), members.length),
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

/**
 * غرف الأعمال الحيّة — صفٌّ في دليل المجتمعات (هجرة 53).
 *
 * الترتيب في SQL بالكلام لا بالعدد، والمؤرشفة مستبعدةٌ هناك — فما يصل
 * إلى هنا غرفٌ فيها نفَس. القاعدة غير المهاجَرة تُرجع خطأً فنعود بلا
 * شيء: قسمٌ يختفي أهون من صفحةٍ تسقط.
 */
export async function getTitleRooms(limit = 12): Promise<CommunityLite[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("title_rooms", { p_limit: limit });
    if (error || !data) return [];
    return (data as CommunityLite[]).map((c) => ({
      ...c,
      member_count: Number(c.member_count),
    }));
  } catch {
    return [];
  }
}

/** غرفةُ عملٍ بعينه **إن وُجدت** — صفحة العمل تسأل قبل أن تَعِد */
export async function getTitleRoomOf(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<{ id: string; member_count: number; archived: boolean } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("title_room_of", {
      p_tmdb: tmdbId,
      p_type: mediaType,
    });
    if (error || !data) return null;
    const row = (data as { id: string; member_count: number; archived: boolean }[])[0];
    if (!row) return null;
    return { id: row.id, member_count: Number(row.member_count), archived: !!row.archived };
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

/* 🗑️ سقطت `getTopRated` و`getMostWatched`: نداءان بلا قارئٍ واحدٍ في
   الشيفرة كلِّها (قاعدةُ D-214) — ودالّتا SQL (`top_rated_period`،
   `most_watched_period`) باقيتان في القاعدة لمن يعيد البابَ يوماً. */

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
    const uid = await getUserId();
    if (!uid) return [];
    // شرط المستخدم صريح في الاستعلام: RLS يحمي فعلاً، لكن الاستعلام الذي
    // «يقرأ الجدول كله ويثق أن السياسة سترشّح» ينكسر بصمتٍ كارثي لو
    // تبدّلت سياسة يوماً — الدفاع طبقتان لا واحدة
    const [eps, movies] = await Promise.all([
      supabase
        .from("watched_episodes")
        .select("show_tmdb_id, season_number, episode_number, watched_at, runtime")
        .eq("user_id", uid)
        .order("watched_at", { ascending: false })
        .limit(limit),
      supabase
        .from("watched_movies")
        .select("movie_tmdb_id, watched_at, runtime")
        .eq("user_id", uid)
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
  /**
   * غلافُ القائمة الذي اختاره صاحبها من خلفيّات أعمالها (D-208،
   * `list_cover.sql`) — **اختياريّ قبل تشغيل الهجرة**: غيابُه يعني «لا
   * غلاف» فتعرض البطاقةُ ملصقاتها كما كانت (قاعدة D-152).
   */
  cover_backdrop?: string | null;
  cover_tmdb_id?: number | null;
  cover_media_type?: "tv" | "movie" | null;
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
    /** الغلافُ المختار (D-208) — غائبٌ قبل تشغيل هجرة ٦٣ فلا يُعرض شيء */
    cover_backdrop?: string | null;
    cover_tmdb_id?: number | null;
    cover_media_type?: "tv" | "movie" | null;
    /** 🆕 هويّةُ قائمةِ لوبز — الاسمُ يُترجَم عند العرض (دَينُ D-328) */
    source_slug?: string | null;
    /** 🆕 قائمةُ تشغيلٍ في «تابِع المشاهدة» (D-505) — غائبٌ قبل هجرة ١٢٢ */
    is_playlist?: boolean | null;
  };
  items: ListItem[];
  ratings: Record<string, number>;
} | null> {
  if (!/^[0-9a-f-]{36}$/i.test(listId)) return null;
  try {
    const supabase = await createClient();
    const BASE = "id, name, subtitle, is_public, user_id, kind, source_slug";
    /* أعمدةُ الغلاف تُطلب أوّلاً، **والسقوطُ إلى الأساس لا إلى الخطأ**:
       قبل تشغيل هجرة ٦٣ يردّ PostgREST «عمودٌ مجهول» فتصير الصفحةُ ٤٠٤
       — وصفحةُ قائمةٍ تختفي لأن ميزةَ زينةٍ لم تُهاجَر بعدُ عطلٌ لا
       تدرّج. الاستعلامُ الثاني لا يقع إلا في تلك الحالة وحدها. */
    let { data: list } = await supabase
      .from("user_lists")
      .select(`${BASE}, cover_backdrop, cover_tmdb_id, cover_media_type, is_playlist`)
      .eq("id", listId)
      .maybeSingle();
    if (!list) {
      ({ data: list } = await supabase
        .from("user_lists")
        .select(BASE)
        .eq("id", listId)
        .maybeSingle());
    }
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
  /** غلافُ القائمة يسافر مع الرابط (D-208) — غائبٌ قبل هجرة ٦٣ */
  cover_backdrop?: string | null;
  items: ListItem[];
}

/* `cache()`: generateMetadata والصفحةُ يجريان في الطلب نفسه، وكلاهما يطلب
   القائمة — وحمولةُ items كاملةً كانت تُنقل مرّتين. */
export const getPublicList = cache(async (listId: string): Promise<PublicList | null> => {
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
});

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
  /* 🆕 **أرقامُ البطاقة** (D-329، الهجرة ١٠٥ — طلبُ أحمد: «أهم شي من هنا
     أشوف عدد العاملين لها مفضلة وتقييمها»). **اختياريّةٌ لأن مستدعياً
     قديماً قد يصل قبل الهجرة** (D-028)، **والصفرُ لا يُطبع** (D-219). */
  saves?: number;
  reviews?: number;
  rating?: number | null;
  /* 🆕 **وجهُ الصاحب** (D-335، طلبُ أحمد: «صورة الشخص الي عملها تظهر
     دائرة صغيرة واسمه») — من `public_profiles` فمخفي الاسم يصل صورتُه
     `null` من الباب نفسِه (D-011). */
  owner_avatar?: string | null;
  /* 🆕 **هويّةُ قائمةِ لوبز** (دَينُ D-328) — بها يُترجَم الاسمُ عند
     العرض بلغة القارئ (`curatedName`)، **والنصُّ المخزَّن يبقى كما هو**.
     غيابُها = قائمةُ عضوٍ عاديّة. */
  source_slug?: string | null;
  /* 🆕 **الحفظُ من البطاقة نفسِها** (بلاغُ أحمد: «زر الحفظ ونجمة التقييم
     وينهم؟» — بطاقةُ لوبز لها علامةُ حفظٍ في الزاوية وبطاقةُ العضو لا).
     **وحكمان لا واحد**: `can_save` تقول «هذه ليست قائمتي وأنا مسجَّل»
     (نفسُ شرط `list_saves`)، و`saved` حالتُها الابتدائية — **وكلاهما
     يُقرأ في `shapeListCards` مرّةً للصفحة لا لكلِّ بطاقة** (D-206). */
  can_save?: boolean;
  /* 🆕 **بابُ التقييم على البطاقة** (D-352): **قائمةٌ عامّةٌ ليست لي ولي
     حساب** — نفسُ شرط `list_reviews.with check` حرفاً (D-327)، **وزرٌّ
     يفشل عند الضغط وعدٌ كاذب** (D-217). */
  can_review?: boolean;
  /** رأيي القائم في هذه القائمة — يملأ ورقةَ النجمة فيكون تعديلاً */
  my_review?: { rating: number; body: string | null; hasSpoiler: boolean } | null;
  /** ⚠️ `saved_by_me` لا `saved` — و`saves` فوقها عددُ الناس: **اسمان
      متقاربان لمعنيين متباعدين هو كيف يُقرأ عدّادٌ حالةً** (D-219). */
  saved_by_me?: boolean;
}

/**
 * تشكيل بطاقات القوائم — العدّ وأربعة ملصقات وسطر الصاحب، في طلبين
 * مهما كثرت القوائم. مُشترَكٌ بين ثلاثة أبواب: «قوائم من المجتمع» في
 * اكتشف (D-063)، والمحفوظة في قوائمي، وقوائم الشخص في ملفّه (D-068) —
 * بطاقةٌ واحدة تعني منطقاً واحداً لا ثلاث نسخٍ تتباعد.
 */
async function shapeListCards(
  lists: {
    id: string;
    user_id: string;
    name: string;
    kind: string | null;
    source_slug?: string | null;
  }[],
  withOwner: boolean,
): Promise<PublicListCard[]> {
  const supabase = await createClient();
  const me = await getUser().catch(() => null);
  const ids = lists.map((l) => l.id);
  const [items, owners, stats, savedRows, myReviews] = await Promise.all([
    supabase
      .from("user_list_items")
      .select("list_id, poster_path, added_at")
      .in("list_id", ids)
      .order("added_at", { ascending: false })
      .limit(1000),
    withOwner
      ? supabase
          .from("public_profiles")
          .select("id, nickname, username, avatar_url, hide_name")
          .in("id", [...new Set(lists.map((l) => l.user_id))])
      : Promise.resolve({ data: [] as { id: string; nickname: string | null; username: string | null; avatar_url: string | null; hide_name: boolean | null }[] }),
    /* 🆕 **نداءٌ واحدٌ لأرقام البطاقات كلِّها** (D-329/D-205): الحفظُ
       والتقييمُ لثلاثٍ وستّين بطاقةً في استدعاءٍ واحد، **لا استعلامين
       لكلِّ واحدة**. وسقوطُه لا يُسقط البطاقة — **الرقمُ الغائبُ لا
       يُطبع** (D-063). */
    supabase.rpc("list_card_stats", { p_ids: ids }).then(
      (r) => r,
      () => ({ data: null }),
    ),
    /* 🆕 **«أحفظتُها أنا؟» — استعلامٌ واحدٌ لبطاقات الصفحة كلِّها**:
       سياسةُ `list_saves` «صفوفي أنا» فالقراءةُ مقصورةٌ عليّ أصلاً،
       **وبطاقةٌ تسأل عن نفسها هي ستّون استعلاماً** (D-205/D-206). */
    me
      ? supabase.from("list_saves").select("list_id").eq("user_id", me.id).in("list_id", ids)
      : Promise.resolve({ data: [] as { list_id: string }[] }),
    /* 🆕 **«ما رأيي أنا فيها؟» — استعلامٌ واحدٌ للصفحة كلِّها** (D-352):
       سياسةُ `list_reviews` «صفوفي أنا» فالقراءةُ مقصورةٌ عليّ أصلاً،
       **وورقةُ النجمة تُملأ بلا نداءٍ عند الفتح** (D-205/D-206). */
    me
      ? supabase
          .from("list_reviews")
          .select("list_id, rating, body, has_spoiler")
          .eq("user_id", me.id)
          .in("list_id", ids)
      : Promise.resolve({ data: [] as { list_id: string; rating: number; body: string | null; has_spoiler: boolean }[] }),
  ]);
  const savedSet = new Set(
    ((savedRows?.data ?? []) as { list_id: string }[]).map((r) => String(r.list_id)),
  );
  const mineOf = new Map(
    ((myReviews?.data ?? []) as {
      list_id: string;
      rating: number;
      body: string | null;
      has_spoiler: boolean;
    }[]).map((r) => [
      String(r.list_id),
      { rating: Number(r.rating), body: r.body ?? null, hasSpoiler: !!r.has_spoiler },
    ]),
  );
  const statOf = new Map(
    ((stats?.data ?? []) as {
      list_id: string;
      saves: number;
      reviews: number;
      avg_rating: number | null;
    }[]).map((r) => [
      String(r.list_id),
      {
        saves: Number(r.saves) || 0,
        reviews: Number(r.reviews) || 0,
        rating: r.avg_rating === null ? null : Number(r.avg_rating),
      },
    ]),
  );

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
  const faceOf = new Map(
    (owners.data ?? []).map((p) => [p.id, p.hide_name ? null : (p.avatar_url ?? null)]),
  );

  return lists
    .map((l) => {
      const e = byList.get(l.id) ?? { count: 0, posters: [] };
      const st = statOf.get(l.id);
      return {
        saves: st?.saves ?? 0,
        reviews: st?.reviews ?? 0,
        rating: st?.rating ?? null,
        id: l.id,
        name: l.name,
        kind: l.kind ?? null,
        owner: withOwner ? (nameOf.get(l.user_id) ?? null) : null,
        owner_avatar: withOwner ? (faceOf.get(l.user_id) ?? null) : null,
        item_count: e.count,
        posters: e.posters,
        source_slug: l.source_slug ?? null,
        /* **الحفظُ فعلُ من لا يملكها وحدَه** — نفسُ شرط `list_saves`
           حرفاً (قائمةٌ ليست لي)، **وحدٌّ في الواجهة وحدَها ليس حدّاً**
           (D-302) فالقاعدةُ تحرسه أيضاً. وزائرٌ بلا حساب لا زرَّ له. */
        can_save: !!me && l.user_id !== me.id,
        saved_by_me: savedSet.has(l.id),
        /* **والتقييمُ شرطُه شرطُ الحفظ نفسُه ومعه العلانية** — والبطاقاتُ
           هنا كلُّها من قوائمَ عامّة (مصادرُها تشترطها). */
        can_review: !!me && l.user_id !== me.id,
        my_review: mineOf.get(l.id) ?? null,
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
      .select("id, user_id, name, kind, source_slug, updated_at")
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
      .select("id, user_id, name, kind, source_slug, updated_at")
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
      .select("id, user_id, name, kind, source_slug, updated_at")
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
      .select("id, user_id, name, kind, source_slug, updated_at")
      .eq("is_public", true)
      .neq("user_id", user.id)
      /* 🔴 🆕 **وقوائمُ لوبز ليست «من المجتمع»** (D-367، بلاغُ أحمد
         بلقطة: «Top 250 Shows · Loopz» تحت عنوان «قوائم من المجتمع»).
         **المجتمعُ هم الأعضاء** — **وعنوانٌ يَعِد بناسٍ فيأتي بنا كذبٌ
         صغير** (D-219/D-181). **ولا تُفقد البطاقة**: للوبز رفوفُها
         الثلاثة فوقُ، فهي تعود إلى بيتها لا إلى العدم.
         ⚠️ **وهذا ترشيحٌ في الدالّة لا في الصفحة — عكسَ D-152 وبحجّتها
         نفسِها**: ذاك كان حكمَ سطحٍ («رآها هذا القارئُ فوق»)، **وهذا
         حكمُ هويّة**: صاحبُ القائمة هو حسابُ لوبز النظاميّ —
         **وما تكونه القائمةُ يسكن المصدر، وما يراه القارئُ يسكن
         الصفحة.**
         ⚠️ **والمالكُ لا `source_slug`**: أوّلُ محاولةٍ رشّحت المولَّدةَ
         وحدَها **فبقيت «طريقك إلى Avengers: Doomsday» في الخطّ** — قائمةُ
         لوبز كُتبت بيدٍ لا بمولِّد (D-317) **فلا `source_slug` لها**.
         **والصفةُ العارضة تُخطئ حيث تصيب الهويّة** (D-144): يُسأل «مَن
         صاحبُها؟» لا «كيف وُلدت؟». */
      .neq("user_id", LOOPZ_ID)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!lists?.length) return [];
    return await shapeListCards(lists, true);
  } catch {
    return [];
  }
}

/**
 * 🆕 **خريطةُ المجموعات المنسّقة: slug → معرّفُ قائمتها** (D-328).
 *
 * **نداءٌ واحدٌ للصفحة كلِّها** (D-205): تبويبُ القوائم يعرض ثلاثةً
 * وستّين بطاقة، **ولو سألت كلُّ واحدةٍ عن قائمتها لصارت الصفحةُ ثلاثةً
 * وستّين استعلاماً.** **والغيابُ يعني «لم تُولَّد بعد»** فتُفتح معاينتُها
 * كما كانت — **ولا شاشةَ خطأٍ لبطاقةٍ تعمل** (D-181).
 */
/* `cache()`: خريطةٌ عامّةٌ تُطلب من أكثر من رفٍّ في /news في الطلب الواحد. */
export const getCuratedListIds = cache(async (): Promise<Map<string, string>> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("curated_list_ids");
    if (error || !data) return new Map();
    return new Map(
      (data as { source_slug: string; list_id: string }[]).map((r) => [
        String(r.source_slug),
        String(r.list_id),
      ]),
    );
  } catch {
    return new Map();
  }
});

/**
 * 🆕 **كم عملاً في قائمةِ لوبز فعلاً** (الهجرة ١٠٧ — بلاغُ أحمد: بطاقةُ
 * «أفضل ٢٥٠ أنمي» تقول ٢٥٠ **وفيها مئةٌ وأربعون**).
 *
 * **والرقمُ كان يُقرأ من الاسم لا من القائمة**: `u.topLimit ?? 250` وعدٌ
 * لا عدّ — **وعتبةُ العشرين ألف صوت** (D-323) أسقطت من الأنمي مئةً وعشرة
 * فصار العنوانُ يَعِد ما لا يجده من يفتح. **ورقمٌ يكذب أسوأُ من لا رقم**
 * (D-219) — وهو نفسُ حكم D-216 في المقام.
 *
 * ⚠️ **ولماذا دالّةٌ لا عدٌّ في الكود:** الصفوفُ اثنتان وأربعون قائمةً
 * فيها آلافُ العناصر — **وجلبُها كلِّها لرسم رقمٍ على بطاقةٍ إسراف**
 * (D-205). **والغيابُ يعيد السلوكَ القديم** (رقمُ القاموس) فلا تسقط
 * بطاقةٌ قبل تشغيل الهجرة (D-028).
 */
/**
 * 🆕 **هويّةُ قائمةٍ واحدة للزائر بلا حساب** (دَينُ D-328، الهجرة ١٠٧).
 *
 * **القارئُ المسجَّل يأخذ `source_slug` مع صفّ القائمة** (`getList`)،
 * **والزائرُ يقرأ عبر `public_list` وحدَها** (D-053) — **وهي لا تحمله**.
 * فرابطُ «Top 250 Movies» المُشارَك كان يفتح صفحةً عنوانُها عربيٌّ لقارئٍ
 * إنجليزيّ. **ونداءٌ خفيفٌ واحدٌ في التوازي أرخصُ من تعديل دالّةِ قراءةٍ
 * مُشغَّلة** (قاعدة «سياساتُ القراءة في `security*.sql` وحدها»).
 *
 * **والغيابُ يعني «ليست منسّقة»** فيبقى الاسمُ المخزَّن (D-063).
 */
/* `cache()`: generateMetadata وصفحةُ القائمة يسألانها معاً. */
export const getCuratedSlug = cache(async (listId: string): Promise<string | null> => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(listId)) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("curated_slug_of", { p_id: listId });
    if (error || !data) return null;
    return String(data) || null;
  } catch {
    return null;
  }
});

/**
 * 🆕 **رأيي أنا في قوائمَ بمعرّفاتها** (D-352) — لبطاقات لوبز التي تبني
 * نفسَها من القاموس لا من `shapeListCards`. **استعلامٌ واحدٌ لاثنتين
 * وأربعين بطاقة** (D-205)، وسياسةُ «صفوفي أنا» تكفيه حارساً.
 */
export async function getMyListReviews(
  ids: string[],
): Promise<Map<string, { rating: number; body: string | null; hasSpoiler: boolean }>> {
  try {
    if (!ids.length) return new Map();
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return new Map();
    const { data } = await supabase
      .from("list_reviews")
      .select("list_id, rating, body, has_spoiler")
      .eq("user_id", user.id)
      .in("list_id", ids);
    return new Map(
      ((data ?? []) as { list_id: string; rating: number; body: string | null; has_spoiler: boolean }[]).map(
        (r) => [
          String(r.list_id),
          { rating: Number(r.rating), body: r.body ?? null, hasSpoiler: !!r.has_spoiler },
        ],
      ),
    );
  } catch {
    return new Map();
  }
}

export async function getCuratedCounts(ids: string[]): Promise<Map<string, number>> {
  try {
    if (!ids.length) return new Map();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("curated_list_counts", { p_ids: ids });
    if (error || !data) return new Map();
    return new Map(
      (data as { list_id: string; items: number }[]).map((r) => [
        String(r.list_id),
        Number(r.items) || 0,
      ]),
    );
  } catch {
    return new Map();
  }
}

/**
 * 🆕 **أرقامُ بطاقاتٍ بمعرّفاتها وحدَها** (D-335، ذيلُ D-329 — طلبُ أحمد:
 * بطاقةُ «Top 250» تُظهر التقييمَ وعددَ الحافظين كبطاقات الأعضاء).
 *
 * **ولماذا قارئٌ ثانٍ و`shapeListCards` تجلبها؟** لأن بطاقةَ المجموعة
 * المنسّقة **تبني ملصقاتِها وعنوانَها من قاموس `universes` لا من صفوف
 * القائمة** (الاسمُ يُترجم عند العرض — D-147/D-273)، **وجلبُ ألف صفِّ
 * عنصرٍ لرسم رقمين إسرافٌ** (D-205). فنداءُ الدالّة ١٠٥ وحدَه —
 * **والقائمةُ التي لا رقمَ لها لا صفَّ لها** فيُقرأ غيابُها صمتاً (D-063).
 */
export async function getListCardStats(
  ids: string[],
): Promise<Map<string, { saves: number; rating: number | null }>> {
  try {
    if (!ids.length) return new Map();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_card_stats", { p_ids: ids });
    if (error || !data) return new Map();
    return new Map(
      (data as { list_id: string; saves: number; avg_rating: number | null }[]).map((r) => [
        String(r.list_id),
        {
          saves: Number(r.saves) || 0,
          rating: r.avg_rating === null ? null : Number(r.avg_rating),
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

/**
 * 🆕 **مراجعاتُ قائمةٍ وتقييمُها** (D-327، الهجرة ١٠٣ — طلبُ أحمد).
 *
 * **ثلاثةُ قرّاءٍ لا واحد، وكلٌّ لسؤاله**: كلامُ الناس (definer، محروسٌ
 * بـ`can_view_profile` وبعَلَم الإخفاء) · متوسّطُهم (رقمان لا صفوف) ·
 * ورأيي أنا (سياسةُ «صفوفي أنا» تكفيه فلا دالّة). **وأرخصُ دالّةٍ هي
 * التي لا تُكتب** (D-301).
 */
export interface ListReviewRow {
  userId: string;
  nickname: string | null;
  username: string | null;
  avatarUrl: string | null;
  hideName: boolean;
  rating: number;
  body: string | null;
  updatedAt: string;
  hasSpoiler: boolean;
}

export async function getListReviews(listId: string, limit = 50): Promise<ListReviewRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_reviews_of", {
      p_list: listId,
      p_limit: limit,
    });
    if (error || !data) return [];
    return (data as {
      id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean;
      rating: number;
      body: string | null;
      updated_at: string;
      has_spoiler: boolean;
    }[]).map((r) => ({
      userId: String(r.id),
      nickname: r.nickname,
      username: r.username,
      avatarUrl: r.avatar_url,
      hideName: Boolean(r.hide_name),
      rating: Number(r.rating) || 0,
      body: r.body,
      updatedAt: String(r.updated_at),
      hasSpoiler: Boolean(r.has_spoiler),
    }));
  } catch {
    /* **سقوطٌ صامتٌ قبل الهجرة ١٠٣** — والقسمُ لا يُرسم بلا صفوف */
    return [];
  }
}

export async function getListReviewStats(
  listId: string,
): Promise<{ avg: number | null; count: number }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_review_stats", { p_list: listId });
    const row = (data as { avg_rating: number | null; reviews: number }[] | null)?.[0];
    if (error || !row) return { avg: null, count: 0 };
    return { avg: row.avg_rating === null ? null : Number(row.avg_rating), count: Number(row.reviews) || 0 };
  } catch {
    return { avg: null, count: 0 };
  }
}

/** رأيي أنا في قائمةٍ — لتعبئة الصندوق بما كتبتُه سابقاً (D-047) */
export async function getMyListReview(
  listId: string,
): Promise<{ rating: number; body: string | null; hasSpoiler: boolean } | null> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("list_reviews")
      .select("rating, body, has_spoiler")
      .eq("user_id", user.id)
      .eq("list_id", listId)
      .maybeSingle();
    if (!data) return null;
    return {
      rating: Number(data.rating) || 0,
      body: (data.body as string | null) ?? null,
      hasSpoiler: Boolean(data.has_spoiler),
    };
  } catch {
    return null;
  }
}

/**
 * 🆕 **قلوبُ مراجعات القوائم وردودُها — عدداً وحالة** (D-370، الهجرة ١١٣).
 *
 * **مصفوفةٌ لا معرّفٌ واحد** (D-205): صفحةُ القائمة تمرّر واحدةً،
 * **وخطُّ المجتمع يمرّر قوائمَ صفوفِه كلَّها في نداءٍ واحد** — وهو ما
 * يجعل ذيلَ صفِّ القائمة ممكناً بلا رحلةٍ لكلِّ صفّ.
 *
 * **والمفتاحُ `listId|userId`** لأن الرأيَ نفسَه مفتاحُه اثنان (D-327)،
 * **وخريطةٌ بمفتاحٍ ناقصٍ تعطي صفّاً كلامَ صفٍّ آخر** (D-237).
 *
 * **والسقوطُ صامتٌ قبل الهجرة**: خريطةٌ فارغة تعني «لا قلوبَ ولا ردود»
 * — **والذيلُ يُرسم بصفرٍ لا بشاشة خطأ** (D-063).
 */
export interface ListReviewSocial {
  likes: number;
  replies: number;
  likedByMe: boolean;
}

export function listReviewKey(listId: string, reviewUserId: string): string {
  return `${listId}|${reviewUserId}`;
}

export async function getListReviewSocial(
  listIds: string[],
): Promise<Map<string, ListReviewSocial>> {
  try {
    const ids = [...new Set(listIds.filter(Boolean))];
    if (!ids.length) return new Map();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_review_social", { p_lists: ids });
    if (error || !data) return new Map();
    return new Map(
      (data as {
        list_id: string;
        review_user_id: string;
        likes: number;
        replies: number;
        liked_by_me: boolean;
      }[]).map((r) => [
        listReviewKey(String(r.list_id), String(r.review_user_id)),
        {
          likes: Number(r.likes) || 0,
          replies: Number(r.replies) || 0,
          likedByMe: Boolean(r.liked_by_me),
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

/**
 * 🆕 **ردودُ مراجعات قائمةٍ واحدة** (D-370) — **نداءٌ واحدٌ للقائمة
 * كلِّها لا لكلِّ رأي** (D-205)، **والترشيحُ في الذاكرة** كما في صفحة
 * التعليق (`getTitleReplies` بحرفها).
 *
 * **والنوعُ `ReviewReply` نفسُه** لأن الصفَّ الذي يرسمه واحد
 * (`ThreadReplies`) — **ونوعٌ ثانٍ بحقولٍ متطابقة يفترق عند أوّل تعديل.**
 */
export async function getListReviewReplies(listId: string): Promise<ReviewReply[]> {
  try {
    const supabase = await createClient();
    const [{ data, error }, me] = await Promise.all([
      supabase.rpc("list_review_replies_of", { p_list: listId }),
      getUser(),
    ]);
    if (error || !data) return [];
    return (data as {
      id: string;
      review_user_id: string;
      parent_id: string | null;
      author_id: string;
      nickname: string | null;
      username: string | null;
      avatar_url: string | null;
      hide_name: boolean;
      body: string;
      created_at: string;
    }[]).map((r) => ({
      /* ⚠️ **و`id` معرّفُ الكاتب لا معرّفُ الردّ** — نفسُ حجّة
         `getTitleReplies`: `PersonLite.id` معناه «صاحبُ الصفّ» في كلِّ
         مكوّنٍ يقرؤه. */
      id: r.author_id,
      nickname: r.nickname,
      username: r.username,
      avatar_url: r.avatar_url,
      hide_name: r.hide_name,
      replyId: r.id,
      reviewUserId: r.review_user_id,
      parentId: r.parent_id,
      body: r.body,
      createdAt: r.created_at,
      isMine: !!me && me.id === r.author_id,
    }));
  } catch {
    return [];
  }
}

/**
 * 🆕 **بطاقاتُ قوائمَ بمعرّفاتها، بترتيبها كما جاءت** (D-326).
 *
 * **ولماذا وُلدت:** رفّا «تناسبك» و«الأكثر حفظاً» يأتيان من دالّتَي
 * ترتيبٍ لا تحملان عددَ الأعمال — **فبنيتُ لهما محوّلاً يضع صفراً في
 * خانة العدّ، فطبعت البطاقةُ «Empty» فوق ثلاثة ملصقات** (بلاغُ أحمد).
 * **ورقمٌ يقول «فارغة» فوق صورةٍ تقول العكس يكذب مرّتين** (D-219).
 *
 * **والعلاجُ ليس تمريرَ العدد في الدالّتين** بل أن تمرّ البطاقةُ من
 * `shapeListCards` كأخواتها الثلاث (D-068: بطاقةٌ واحدة تعني منطقاً
 * واحداً لا أربع نسخٍ تتباعد) — **العددُ والملصقاتُ وسطرُ الصاحب من
 * مصدرٍ واحد.**
 *
 * ⚠️ **والترتيبُ يُحفظ كما وصل**: ترتيبُ الرفِّ هو معناه («الأكثر حفظاً»
 * و«الأقربُ إلى مكتبتك»)، **و`in (...)` عند Postgres لا يَعِد بترتيب**.
 */
export async function getListCardsByIds(ids: string[]): Promise<PublicListCard[]> {
  if (!ids.length) return [];
  try {
    const supabase = await createClient();
    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, user_id, name, kind, source_slug")
      .in("id", ids.slice(0, 30))
      .eq("is_public", true);
    if (!lists?.length) return [];
    const cards = await shapeListCards(lists, true);
    const byId = new Map(cards.map((c) => [c.id, c]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as PublicListCard[];
  } catch {
    return [];
  }
}

/**
 * 🆕 **معرّفاتُ ما حفظتَه** (D-326، بلاغُ أحمد: «هذي أنا حافظها عندي،
 * المفروض ما تظهر»).
 *
 * **وحجّتُه حجّةُ الصفّ نفسِه:** «تناسبك» و«الأكثر حفظاً» **سطحا اكتشاف**،
 * **وما حفظتَه صار عندك** — بابُه «قوائمي» في المكتبة. **واقتراحُ ما
 * تملكه ليس اكتشافاً** (نفسُ حجّة إخراج قوائمك من `for_you_lists`).
 */

export async function getMySavedListIds(): Promise<Set<string>> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return new Set();
    const { data } = await supabase
      .from("list_saves")
      .select("list_id")
      .eq("user_id", user.id);
    return new Set((data ?? []).map((r) => String(r.list_id)));
  } catch {
    return new Set();
  }
}

/** قائمةٌ محفوظةٌ بعناصرها — لبطاقة «تابِع المشاهدة» (D-496) */
export interface SavedListBrief {
  id: string;
  name: string;
  sourceSlug: string | null;
  items: ListItem[];
}

/**
 * 🆕 **القوائمُ المحفوظةُ بعناصرها — لمتابعتها كما يُتابَع المسلسل**
 * (D-496، طلبُ أحمد: «تظهر في كونتنيو واتشينج مثل المسلسل»).
 *
 * **ثلاثةُ استعلاماتٍ مهما كثرت القوائم**: المحفوظةُ، ثم أسماؤها، ثم
 * عناصرُها دفعةً واحدة (`in`) — **لا استعلامَ لكلِّ قائمة** (D-205).
 *
 * ⚠️ **وسقفان يمنعان هذا من أن يصير استعلامَ كتالوج**: ستُّ قوائمَ
 * وأربعُمئةِ عنصرٍ إجمالاً. **و«أفضل ٢٥٠» ليست شيئاً «تُتابعه» فيلماً
 * فيلماً** — والمرشِّحُ في الرئيسية يُسقط الطويلةَ صراحةً.
 *
 * ⚠️ **وتُستدعى في الجسم المتدفّق لا في الموجة الأولى**: أوّلُ بايتٍ
 * للرئيسية لا ينتظر قائمةً محفوظة.
 */
export async function getSavedListsBrief(limit = 6): Promise<SavedListBrief[]> {
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return [];

    const { data: saves } = await supabase
      .from("list_saves")
      .select("list_id")
      .eq("user_id", uid)
      .limit(limit);
    const ids = [...new Set((saves ?? []).map((r) => String(r.list_id)))];
    if (ids.length === 0) return [];

    const [listsRes, itemsRes] = await Promise.all([
      supabase.from("user_lists").select("id, name, source_slug").in("id", ids),
      supabase
        .from("user_list_items")
        .select("list_id, tmdb_id, media_type, title, poster_path, added_at, sort_order")
        .in("list_id", ids)
        .limit(400),
    ]);

    const byList = new Map<string, ListItem[]>();
    for (const r of (itemsRes.data ?? []) as (ListItem & { list_id: string })[]) {
      const arr = byList.get(r.list_id) ?? [];
      arr.push(r);
      byList.set(r.list_id, arr);
    }

    return ((listsRes.data ?? []) as { id: string; name: string; source_slug: string | null }[])
      .map((l) => ({
        id: l.id,
        name: l.name,
        sourceSlug: l.source_slug,
        /* **ترتيبُ القائمة هو ترتيبُ مشاهدتها** (D-390): `sort_order`
           أوّلاً، **والغائبُ يتبع تاريخَ الإضافة** كما في صفحتها. */
        items: (byList.get(l.id) ?? []).sort(
          (a, b) =>
            (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9) ||
            a.added_at.localeCompare(b.added_at),
        ),
      }))
      .filter((l) => l.items.length > 0);
  } catch {
    return [];
  }
}

/**
 * 🆕 **أيُّ قوائمك رايتُها مرفوعة** (D-563، بلاغُ أحمد: «عجبني زر On
 * و Off، أبغاه موجود في كل اللستات — مو لازم أدخل بالداخل وأعمل
 * ستارت واتشينج»).
 *
 * **معرِّفاتٌ لا صفوف**: البطاقةُ مرسومةٌ أصلاً من `my_lists()`،
 * **والناقصُ حرفٌ واحدٌ لكلِّ قائمة** — **فمجموعةُ معرِّفاتٍ أرخصُ من
 * تغيير نوعِ إرجاعِ دالّةٍ حيّة** (وتغييرُ نوعِ الإرجاع يوجب
 * `drop function` — وهو ما رفضناه في D-561 لنفس السبب).
 *
 * **وتحتمل الهجرةَ غائبة**: قبل ١٢٢ يردّ `eq("is_playlist")` عمودًا
 * مجهولاً **فتعود المجموعةُ فارغة** — فتُقرأ كلُّ البطاقات «متوقّفة»
 * ولا تنكسر صفحة.
 */
export const getMyPlaylistIds = cache(async (): Promise<string[]> => {
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return [];
    const { data, error } = await supabase
      .from("user_lists")
      .select("id")
      .eq("user_id", uid)
      .eq("is_playlist", true);
    if (error || !data) return [];
    return (data as { id: string }[]).map((r) => String(r.id));
  } catch {
    return [];
  }
});

/**
 * 🆕 **قوائمُ التشغيل — قوائمُك أنت التي رفعتَ عليها الراية** (D-505،
 * طلبُ أحمد: «يعمل لليست بلاي ليست وتظهر في كنتنيو واتش»).
 *
 * **ولماذا دالّةٌ ثانيةٌ لا معامِلٌ في `getSavedListsBrief`:** تلك تقرأ
 * **المحفوظَ من قوائم الآخرين** وتُرشَّح بحدسٍ (٦٠٪ في مكتبتك)، وهذه
 * تقرأ **قوائمَك أنت برايةٍ صريحة** — **والصريحُ لا يمرّ بحدسِ
 * الضمنيّ**: من رفع الرايةَ قال «أريدها هناك» فلا تُحجب عنه بنسبة.
 *
 * **وتحتمل الهجرةَ غائبة**: قبل ١٢٢ يعيد `eq("is_playlist")` خطأَ
 * عمودٍ مجهول، فتعود المصفوفةُ فارغةً ولا بطاقة — بلا شاشة خطأ.
 */
export async function getMyPlaylistsBrief(limit = 4): Promise<SavedListBrief[]> {
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return [];

    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, name, source_slug")
      .eq("user_id", uid)
      .eq("is_playlist", true)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!lists?.length) return [];

    const ids = lists.map((l) => String(l.id));
    const { data: items } = await supabase
      .from("user_list_items")
      .select("list_id, tmdb_id, media_type, title, poster_path, added_at, sort_order")
      .in("list_id", ids)
      .limit(400);

    const byList = new Map<string, ListItem[]>();
    for (const r of (items ?? []) as (ListItem & { list_id: string })[]) {
      const arr = byList.get(r.list_id) ?? [];
      arr.push(r);
      byList.set(r.list_id, arr);
    }

    return (lists as { id: string; name: string; source_slug: string | null }[])
      .map((l) => ({
        id: l.id,
        name: l.name,
        sourceSlug: l.source_slug,
        /* ترتيبُ القائمة هو ترتيبُ تشغيلها (D-390) — وبابُ تعديله قائمٌ
           أصلاً: «أعد الترتيب» في صفحة القائمة (`reorderList`). */
        items: (byList.get(l.id) ?? []).sort(
          (a, b) =>
            (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9) ||
            a.added_at.localeCompare(b.added_at),
        ),
      }))
      .filter((l) => l.items.length > 0);
  } catch {
    return [];
  }
}

/**
 * 🆕 **معرّفاتُ أفلامك التي تسكن قائمةً — لاستثنائها من «للمشاهدة»
 * الآليّة** (D-505، طلبُ أحمد بنصّه: «ليست اسمها تو واتش تدخل فيها كل
 * الأفلام اللي بدون ليست»). **فما وضعتَه في قائمةٍ قد أعلنتَ سياقَه** —
 * وطابورُ «بلا قائمة» لِما لم يُعلَن له سياق.
 *
 * استعلامان مهما كثرت القوائم (D-205)، **وقراءةُ العناصر بـ`pageAll`**
 * (D-470): مكتبةُ قوائمَ نشطةٌ تتجاوز ألفَ صفٍّ وPostgREST يقصّ بصمت.
 */
export async function getMyListedMovieIds(): Promise<Set<number>> {
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return new Set();

    const { data: lists } = await supabase
      .from("user_lists")
      .select("id")
      .eq("user_id", uid)
      .limit(200);
    const ids = (lists ?? []).map((l) => String(l.id));
    if (ids.length === 0) return new Set();

    const rows = await pageAll<{ tmdb_id: number }>((from, to) =>
      supabase
        .from("user_list_items")
        .select("tmdb_id")
        .in("list_id", ids)
        .eq("media_type", "movie")
        .order("tmdb_id", { ascending: true })
        .range(from, to),
    );
    return new Set(rows.map((r) => r.tmdb_id));
  } catch {
    return new Set();
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
      .select("id, user_id, name, kind, source_slug, updated_at")
      .eq("is_public", true)
      .eq("user_id", userId)
      /* المفضّلة قسمٌ بذاته في البروفايل (D-152) — ولولا هذا السطر
         لظهرت مرّتين في الصفحة نفسها لمن أعلنها. شيءٌ واحد، مكانٌ واحد.
         وهي باقيةٌ في `/lists` كما هي: تلك صفحةُ قوائمه لا بروفايله */
      .neq("kind", "favorites")
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
/* ⚖️ 🆕 **والسقفُ ٥٠٠ لا ثلاثين** (D-394، دَينُ D-374 المعلَن): كان
   الرفُّ يعرض ثلاثين **والعدّادُ فوقه يعدّ الكلَّ** — **فيتفارقان عند
   الحادية والثلاثين**، وهو رقمٌ يبلغه مستخدمٌ نشطٌ في شهر. **والصفوفُ
   خفيفةٌ** (اسمٌ وعدٌّ وثلاثةُ ملصقات) **فالسقفُ الجديد حارسُ عقلٍ لا
   حدُّ عرض** — **والدَّينُ يُشطب لا يُنقل.** */
/**
 * 🆕 **محفوظاتُ صاحبِ ملفٍّ أزوره** (D-588، طلبُ أحمد: «اعرض الليستات
 * الموجودة عنده كاملة — حتى الي معطيها قلب وماهي حقّته»).
 *
 * **وصفةُ `getSavedLists` نفسُها بقارئِ معرّفاتٍ آخر**: صفوفُ الربط
 * محجوبةٌ بسياسة «صفوفي أنا»، **فتُقرأ من `profile_saved_lists`
 * (الهجرة ١٣١) المحروسةِ بـ`can_view_profile`** — **والبطاقاتُ من
 * الطريق القائم** (`user_lists` المعلنة + `shapeListCards`)، فلا
 * نسخةَ ثانيةً من التشكيل (القاعدة ٦).
 */
export async function getSavedListsOf(userId: string): Promise<PublicListCard[]> {
  try {
    const supabase = await createClient();
    const { data: saves, error } = await supabase.rpc("profile_saved_lists", {
      p_user: userId,
    });
    if (error || !saves?.length) return [];
    const rows = saves as { list_id: string; saved_at: string }[];

    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, user_id, name, kind, source_slug")
      .in("id", rows.map((s) => s.list_id))
      .eq("is_public", true);
    if (!lists?.length) return [];

    // ترتيب الحفظ لا ترتيب القوائم — عُرفُ `getSavedLists` حرفاً
    const rank = new Map(rows.map((s, i) => [s.list_id, i]));
    const sorted = [...lists].sort(
      (a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9),
    );
    return await shapeListCards(sorted, true);
  } catch {
    return [];
  }
}

export async function getSavedLists(limit = 500): Promise<PublicListCard[]> {
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
      .select("id, user_id, name, kind, source_slug")
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

/**
 * 🆕 **كم قائمةً حفظتُ؟** (D-374، بلاغُ أحمد: «وفوق List المفروض ٣ بدل صفر»).
 *
 * **عدّادُ تبويب «القوائم» كان `lists.length` وحدَها** — أي قوائمي التي
 * أنشأتُها — **بينما اللوحُ تحته يعرض «قوائمُ محفوظة · ٣»**، **فالرقمُ
 * في رأس التبويب يكذّب ما تحته** (D-219: رقمٌ يُقرأ خطأً أسوأُ من لا
 * رقم).
 *
 * ⚠️ **ولماذا نداءٌ ثانٍ ولا يُقرأ من `getSavedLists`**: تلك مشروطةٌ
 * بفتح تبويبها منذ D-350 (أربعةُ استعلاماتٍ لتبويبٍ قد لا يُفتح) —
 * **والعدّادُ يجب أن يصدق وأنت في «أفلامي».** **فهو نمطُ `artistCount`
 * حرفاً**: نداءٌ خفيفٌ يجري دائماً (`head: true` بلا صفوف) **والثقيلُ
 * مشروطٌ بتبويبه** (D-128/D-350).
 */
export async function getSavedListsCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return 0;
    const { data: saves } = await supabase
      .from("list_saves")
      .select("list_id")
      .eq("user_id", uid)
      .limit(200);
    if (!saves?.length) return 0;
    /* 🔴 **والمعلنةُ وحدَها تُعدّ** — **وهذا ما قِيس على الموقع الحيّ**:
       أوّلُ نسخةٍ عدّت صفوفَ `list_saves` كلَّها فقالت «٤» فوق لوحٍ يعرض
       ثلاثاً، **لأن `getSavedLists` تُسقط ما لم يعد عامّاً** (صاحبُها
       أخفاه بعد حفظك إيّاه). **وشرطُ العدّاد شرطُ العرض حرفاً وإلّا
       انتقل الكذبُ من جهةٍ إلى جهة** (D-219). */
    const { count } = await supabase
      .from("user_lists")
      .select("id", { count: "exact", head: true })
      .in("id", saves.map((s) => s.list_id))
      .eq("is_public", true);
    return count ?? 0;
  } catch {
    /* **والصفرُ عند السقوط يُبقي العدّادَ كما كان** — لا شاشةَ خطأ (D-063) */
    return 0;
  }
}

/**
 * 🆕 **«ما يحفظه الناس» ببطاقة البطاقات نفسِها** (D-375، بلاغُ أحمد:
 * «شكل الليست في الأعضاء لازم تكون مثل شكلها في كل مكان، لها قلب ولها
 * نجمة تقييم بعددهم»).
 *
 * **وكانت الصفوفُ تُبنى باليد من عائد `top_saved_lists`** — بلا وجهِ
 * صاحبٍ ولا ♥ ولا ★ ولا زرِّ حفظ — **ونصُّ D-068 أن `shapeListCards` هي
 * المكانُ الوحيد الذي تُبنى فيه البطاقة**: بابٌ خامسٌ يبني بطاقتَه بيده
 * هو كيف تفترق البطاقتان.
 *
 * **واستعلامٌ خفيفٌ واحدٌ هو الثمن**: الدالّةُ ترتّب بالحفظ ولا تُرجع
 * `kind` ولا `source_slug`، **فتُقرأ صفوفُ القوائم الثلاث ثم تمرّ من
 * البوّابة** — **والترتيبُ يبقى ترتيبَ الحفظ** (D-215: الاستحقاقُ قبل
 * الترتيب، والترتيبُ هنا هو المعنى).
 */
export async function getTopSavedListCards(
  days = 7,
  limit = 3,
): Promise<PublicListCard[]> {
  try {
    const rows = await getTopSavedLists(days, limit);
    if (!rows.length) return [];
    const supabase = await createClient();
    const { data: lists } = await supabase
      .from("user_lists")
      .select("id, user_id, name, kind, source_slug")
      .in("id", rows.map((r) => r.listId))
      .eq("is_public", true);
    if (!lists?.length) return [];
    const rank = new Map(rows.map((r, i) => [r.listId, i]));
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

/* ⚠️ **قرّاءُ الأخبار المجمَّعة حُذفوا** (D-214، بطلب أحمد): `getNewsFeed`
   و`getNewsStale` و`refreshNewsNow` وجدولُهم `news_items` — **لم يبقَ لهم
   مستهلك** بعد أن صارت الأخبارُ من عندنا (D-211 → D-213).
   **وما بقي من ذلك العمل عمداً:** `src/lib/news.ts` — سجلُّ المصادر وقارئُ
   الفيدات، **وهو اليوم محرّكُ `report`** (D-213). */

// ============================================================
//  أخبارُنا نحن (D-211، هجرة ٦٥)
// ============================================================

export interface LoopzNewsItem {
  key: string;
  kind:
    | "trailer" | "date" | "season" | "status" | "season_date" | "theatrical"
    | "released" | "chart" | "provider" | "report";
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  data: Record<string, string | number> | null;
  published_at: string;
}

/**
 * أخبارُنا المولَّدة — **حقائقُ لا جُمَل**: الجملةُ تُركَّب في الواجهة من
 * قوالب `i18n`، فالخبرُ الواحد يُقرأ بلغتين بلا عمودٍ ثانٍ (D-211).
 *
 * والقراءةُ بدالّة `definer` لا بسياسةٍ مفتوحة — **فالسياساتُ المفتوحة
 * تبقى أربعاً**. والسقوطُ صامت: قبل تشغيل الهجرة قائمةٌ فارغة، لا خطأ.
 */
/* `cache()`: getNewsPost وصفحةُ الخبر يسحبان ٣٠٠ صفٍّ مرّتين للطلب الواحد. */
export const getLoopzNews = cache(async (limit = 30): Promise<LoopzNewsItem[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("loopz_news", { p_limit: limit });
    if (error || !data) return [];
    return data as LoopzNewsItem[];
  } catch {
    return [];
  }
});

/** «هل حان الرصدُ التالي؟» — يُسأل في القاعدة لا على ساعة الرسم */
export async function getNewsGenStale(minutes = 30): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("news_gen_stale", { p_minutes: minutes });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * دورةُ رصدٍ واحدة **بعد إرسال الصفحة** (`after`) — نفسُ نمط D-210
 * الذي اختاره أحمد: **التجديدُ بحركة المرور، بلا سرٍّ وبلا صفِّ cron**.
 */
export async function refreshLoopzNews(): Promise<number> {
  try {
    const { runNewsSlice } = await import("@/lib/loopzNews");
    const { runReportSlice } = await import("@/lib/newsReports");
    /* **دورتان لا واحدة، وأربعون عملاً لا ستّةٌ وعشرون** (D-215): الزيارةُ
       الواحدة كانت تفحص ٢٦ من ألف، **فالمرورُ الكامل أربعون زيارة**.
       والعملُ كلُّه **بعد إرسال الصفحة** (`after`) فلا يدفع القارئ ثمنه —
       وحدُّه الحقيقيّ مهلةُ الوظيفة لا صبرُ المستخدم. */
    let posts = 0;
    for (let i = 0; i < 2; i++) {
      const r = await runNewsSlice(40);
      posts += r.posts;
      /* شريحةٌ عادت فارغة تعني **لا مستحقَّ الآن** — فلا داعي لدورةٍ ثانية */
      if (r.checked === 0) break;
    }
    /* **ودفعةُ الصحافة معها**: الحدثُ من عندهم والجملةُ من عندنا (D-213) */
    const rep = await runReportSlice().catch(() => ({ saved: 0 }));
    return posts + rep.saved;
  } catch {
    return 0;
  }
}

/**
 * **هل حان وقتُ نشرةِ غرفةٍ؟** (D-261) — تُسأل في القاعدة لا على ساعة
 * الرسم، **بنمط `getNewsGenStale` حرفاً**.
 *
 * **وافتراضُها ثلاثُ ساعاتٍ لا عشرُ دقائق**، والفرقُ مقصود: دورةُ الأخبار
 * ترصد تغيّراً قد يقع أيَّ لحظة، **وحلقةُ مسلسلٍ تنزل مرّةً في الأسبوع**
 * — **وبوّابةٌ أسرعُ من الحدث تفحص فراغاً وتدفع ثمنه** (D-215).
 */
export async function getTalkBulletinStale(minutes = 180): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("talk_bulletin_stale", { p_minutes: minutes });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * **دورةُ نشرٍ واحدة بعد إرسال الصفحة** (`after`) — نفسُ نمط D-210/D-215:
 * **بحركة المرور، بلا سرٍّ وبلا صفِّ cron.**
 *
 * ⚠️ **ودورةٌ واحدة لا اثنتان** (بخلاف `refreshLoopzNews`): تلك تمرّ على
 * ألفِ عملٍ بحثاً عن تغيّر، **وهذه تكتب ثلاثاً بسقفٍ معلَن** — وتكرارُها
 * في الزيارة الواحدة يضاعف النشراتِ لا التغطية.
 */
export async function refreshTalkBulletins(): Promise<number> {
  try {
    const { runTalkBulletinSlice } = await import("@/lib/talkBulletins");
    const r = await runTalkBulletinSlice();
    return r.posted;
  } catch {
    return 0;
  }
}

/**
 * 🆕 **تفضيلاتُ المحتوى — قراءةٌ واحدةٌ للصفحة كلِّها** (D-545).
 *
 * ================= لماذا لا استعلامَ جديداً =================
 *
 * **بنصِّ المواصفة: «لا تستخدم استعلاماً منفصلاً لكلّ كارد؛ حمّل
 * التفضيلات مرّة واحدة».** **و`getProfile` مغلَّفةٌ بـ`cache`** فصفُّ
 * الملفّ يُقرأ مرّةً في الطلب مهما سأله من سأل — **والأعمدةُ الثلاثةُ
 * الجديدة تركب معه** (الهجرة ١٢٦). **فثمنُ هذه الدالّة صفر.**
 *
 * ================= والزائرُ يختار أيضاً =================
 *
 * **بلا حسابٍ فالكوكي** — نفسُ عائلة بقيّة التفضيلات (D-014)،
 * **ويُقرأ على الخادم قبل أوّل رسمة** فلا وميضَ ولا `hydration
 * mismatch`. **وعند الدخول يُدمج ولا يُفقد** (`mergeContentPrefs`،
 * تُنادى في `setContentPrefs`).
 *
 * ⚠️ **ولا يُخبَّأ ناتجُ توصيةٍ عبر المستخدمين**: **هذه الدالّة لا
 * تخبّئ شيئاً بذاتها**، و`getProfile` مخبَّأةٌ **بـ`cache()` من React
 * وهو تخبئةُ طلبٍ واحدٍ لا تخبئةٌ عامّة** — **فلا يعبر تفضيلُ أحدٍ إلى
 * طلبِ غيره** (شرطُ المواصفة: «امنع تسرّب كاش توصيات مستخدم إلى آخر»).
 */
export const getContentPrefs = cache(async (): Promise<ContentPrefs> => {
  const profile = await getProfile().catch(() => null);

  if (profile) {
    return sanitizeContentPrefs({
      genres: profile.favorite_genres ?? [],
      unwantedGenres: profile.unwanted_genres ?? [],
      languages: profile.preferred_languages ?? [],
      excludedLanguages: profile.excluded_languages ?? [],
    });
  }

  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return parseContentPrefs(store.get(CONTENT_PREFS_COOKIE)?.value);
  } catch {
    return EMPTY_CONTENT_PREFS;
  }
});
