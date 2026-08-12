"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { REGION_COOKIE, normalizeRegion } from "@/lib/region";
import { GENRES, type MediaType } from "@/lib/media";
import { THEMES } from "@/lib/themes";
import { sanitizeHomePrefs, type HomePrefs } from "@/lib/homePrefs";
import { sanitizeProfilePrefs, type ProfilePrefs } from "@/lib/profilePrefs";
import {
  isTabSurface,
  parseTabPrefs,
  serializeTabPrefs,
  surfaceCookie,
  type TabPref,
} from "@/lib/tabPrefs";
import { allow } from "@/lib/ratelimit";
import { intId, intIn, asMediaType, uuid, dateOrNull } from "@/lib/validate";
import { IMPORT_CAPS, type ImportPayload, type ResolveRequest, type ResolveResult } from "@/lib/importer";
import type { PersonLite, CommunityLite } from "@/lib/data";

/**
 * بوابة كل فعل: هوية المستخدم ثم حدّ معدّل الطلبات.
 *
 * الحدّ لكل مستخدم لا لكل عنوان IP، ولكل «دلو» من الأفعال ميزانيته:
 * الافتراضي يتّسع لأسرع نقرٍ بشري ويقطع الحلقات البرمجية، والأفعال
 * الثقيلة (تلك التي تولّد طلبات TMDB أو آلاف الصفوف) دلوها أضيق.
 */
async function requireUser(bucket = "act", limit = 30, windowMs = 10_000) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجّل الدخول");
  if (!allow(`${user.id}:${bucket}`, limit, windowMs)) {
    throw new Error("طلبات كثيرة متتالية — تمهّل لحظات / Too many requests, slow down.");
  }
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
  /** التموضع الرأسي للصورتين (٠–١٠٠) — انظر image_positions.sql */
  coverPos?: number;
  avatarPos?: number;
  theme?: string;
  favoriteGenres: number[];
  hideName?: boolean;
  homePrefs?: HomePrefs;
  /** تخصيص البروفايل (D-129) — غيابه يعني «اتركه كما هو» */
  profilePrefs?: ProfilePrefs;
  /** نبذةٌ قصيرة — غيابها يعني «اتركها كما هي» لا «امحُها» */
  bio?: string;
  /** حسابٌ خاص: المتابعة بطلب (follow_requests.sql) — غيابه يترك الحال */
  isPrivate?: boolean;
  /** قفل قائمتَي المتابعة في الملف العام (هجرة 43) */
  hideFollowLists?: boolean;
}) {
  const { supabase, user } = await requireUser("profile", 10, 60_000);

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
  // نسبةٌ مقصوصة على مداها لا قيمة حرّة: الرقم يدخل style مباشرةً عند الرسم
  const clampPos = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  if (input.coverPos !== undefined && Number.isFinite(input.coverPos))
    payload.cover_pos = clampPos(input.coverPos);
  if (input.avatarPos !== undefined && Number.isFinite(input.avatarPos))
    payload.avatar_pos = clampPos(input.avatarPos);
  if (input.theme !== undefined) {
    payload.theme = THEMES.some((t) => t.id === input.theme) ? input.theme : "amber";
  }
  if (input.hideName !== undefined) payload.hide_name = !!input.hideName;
  if (input.isPrivate !== undefined) payload.is_private = !!input.isPrivate;
  if (input.hideFollowLists !== undefined) payload.hide_follow_lists = !!input.hideFollowLists;
  /* النبذة تُنظَّف كما يُنظَّف سطر القائمة (D-044): المسافات تُطوى فلا تصير
     فقرةً، والحدّ ١٦٠ حرفاً مطابقٌ لقيد SQL — لا نتّكل على القيد وحده
     لأن رسالة خطأ قاعدة البيانات ليست رسالةً للمستخدم */
  if (input.bio !== undefined) {
    const bio = input.bio.replace(/\s+/g, " ").trim().slice(0, 160);
    payload.bio = bio || null;
  }
  // تُنقّى قبل الكتابة كما تُنقّى بعد القراءة: القيمة تمرّ عبر الشبكة
  if (input.homePrefs !== undefined) payload.home_prefs = sanitizeHomePrefs(input.homePrefs);
  if (input.profilePrefs !== undefined)
    payload.profile_prefs = sanitizeProfilePrefs(input.profilePrefs);

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    // 23505 = تعارض في فهرس فريد (اسم المستخدم محجوز)
    if (error.code === "23505")
      throw new Error("اسم المستخدم محجوز، جرّب غيره. / Username is taken, try another.");
    fail(error);
  }

  // الثيم في كوكي أيضاً: الـ layout يقرأه فورياً بلا رحلة قاعدة بيانات
  if (typeof payload.theme === "string") {
    const store = await cookies();
    store.set("theme", payload.theme, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: true,
    });
  }

  revalidatePath("/", "layout");
}

/** مزامنة كوكي الثيم لمن اختار ثيمه قبل اعتماد الكوكي — تُستدعى مرة من العميل */
export async function syncThemeCookie(value: string) {
  const theme = THEMES.some((t) => t.id === value) ? value : "amber";
  const store = await cookies();
  store.set("theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: true,
  });
}

/**
 * تبديل بلد المشاهدة.
 *
 * كوكي فقط، بلا عمودٍ في قاعدة البيانات: هذا تفضيل عرضٍ كالثيم واللغة
 * (D-014)، يقرؤه الخادم قبل أوّل رسمة، ولا يستحقّ هجرةً ولا صفّاً.
 */
export async function setWatchRegion(value: string) {
  const region = normalizeRegion(value);
  const store = await cookies();
  store.set(REGION_COOKIE, region, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/**
 * تفضيلاتُ تبويبات سطحٍ واحد — **الترتيب والإظهار في كتابةٍ واحدة**
 * (طلب أحمد ١١ أغسطس: «حطّ إمكانية أغيّر موقع التيوب… حتى في الديسكفري
 * والمكتبة حطّ خيار الإخفاء»).
 *
 * **كوكي لا عمود** — نفس حجّة `setWatchRegion` حرفاً بحرف (D-014): تفضيلُ
 * عرضٍ يقرؤه الخادم قبل أوّل رسمة، ولا يستحقّ هجرةً ولا صفّاً.
 *
 * *(حلّت محلّ `setHiddenCommunityTabs` من D-177 وحُذفت معها. وكوكيُّ
 * الإخفاء القديم `loopz_ctabs_hidden` **ما زال يُقرأ** مرّةً كترقيةٍ صامتة
 * في `parseTabPrefs` — يُقرأ ولا يُكتب، فمن أخفى تبويباً أمسِ لا يخسره.)*
 *
 * **ولا يُصدَّق ما يصل:** المصفوفة تمرّ بـ`parseTabPrefs` نفسِها التي
 * يمرّ بها الكوكي المقروء — فالمجهولُ يسقط، والناقصُ يُلحَق بحالته
 * الافتراضية، **والأخيرُ الظاهر لا يُخفى** مهما أرسل العميل.
 */
export async function setTabPrefs(surface: string, prefs: TabPref[]) {
  if (!isTabSurface(surface)) return;
  const clean = parseTabPrefs(surface, serializeTabPrefs(prefs));
  const store = await cookies();
  store.set(surfaceCookie(surface), serializeTabPrefs(clean), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
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
    if (user && allow(`${user.id}:pref`, 20, 60_000)) {
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
  input = { ...input, tmdbId: intId(input.tmdbId), mediaType: asMediaType(input.mediaType) };
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
  input = {
    tmdbId: intId(input.tmdbId),
    mediaType: asMediaType(input.mediaType),
    title: String(input.title ?? "").slice(0, 300),
    posterPath: safeImagePath(input.posterPath),
  };
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
  input = { tmdbId: intId(input.tmdbId), mediaType: asMediaType(input.mediaType) };
  const { supabase, user } = await requireUser();
  await supabase
    .from("follows")
    .delete()
    .match({ user_id: user.id, tmdb_id: input.tmdbId, media_type: input.mediaType });
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/${input.mediaType === "tv" ? "show" : "movie"}/${input.tmdbId}`);
}

/**
 * تصنيفُ ما لم يُصنَّف من متابعاتك: أنمي أو لا (D-182).
 *
 * **لماذا هنا لا عند المتابعة:** لو صنّفنا وقت الضغط على «تابع» لدفع
 * المستخدم ثمنَ نداءِ TMDB في أسخن فعلٍ في التطبيق، **ولاحتجنا مسارين
 * للتصنيف** — واحدٌ للجديد وآخرُ للقديم — يتفرّقان يوم يتغيّر التعريف.
 * فالمسارُ واحد: الصفُّ يولد `null`، وأوّلُ فتحٍ لتبويب الأنمي يصنّف ما
 * لم يُصنَّف. **ويتكرّر بلا ضرر** لأن `null` وحدها تُسأل.
 *
 * **والتعريف هو نفسه في المواضع الثلاثة** (`looksAnime`، و`is_anime`
 * في البِركة، وهنا): رسومٌ متحرّكة (نوع ١٦) **ولغةٌ أصلية يابانية** —
 * فلا يتفرّق التصنيف بين مكتبةٍ وقائمةٍ ورفّ (قاعدة D-089/D-135).
 *
 * ولا يلمس صفَّ أحدٍ غيرك: كلُّ كتابةٍ مقيّدةٌ بـ`user_id` — وبـ`in`
 * صريحة، فمصيدةُ `safeupdate` (حذفٌ أو تحديثٌ بلا `where`) لا تقترب.
 */
export async function classifyMyFollows(limit = 240): Promise<number> {
  const { supabase, user } = await requireUser();
  /* حارسٌ على المعدّل: الفعل يُطلق من المتصفّح، وتكرارُه بلا داعٍ ينفق
     حصةَ TMDB لا أكثر — فالحدُّ واسعٌ ويكفي */
  if (!allow(`${user.id}:anime`, 6, 60_000)) return 0;

  const { data } = await supabase
    .from("follows")
    .select("tmdb_id, media_type")
    .eq("user_id", user.id)
    .is("is_anime", null)
    .limit(Math.min(Math.max(limit, 1), 400));
  const rows = (data ?? []) as { tmdb_id: number; media_type: "tv" | "movie" }[];
  if (rows.length === 0) return 0;

  const { getMovie, getTv } = await import("@/lib/tmdb");
  /** رقم «رسوم متحرّكة» عند TMDB — واحدٌ للأفلام والمسلسلات */
  const ANIMATION_GENRE = 16;

  const verdict = new Map<string, boolean>();
  /* خمسٌ وعشرون متوازيةً كما في `imdbChart.ts` و`topChart.ts` — نفس
     الخادم ونفس السبب، وتفاصيلُ TMDB مخبّأةٌ فالزيارة الثانية بلا نداء */
  const CHUNK = 25;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await Promise.all(
      rows.slice(i, i + CHUNK).map(async (r) => {
        try {
          const d = (r.media_type === "tv"
            ? await getTv(r.tmdb_id)
            : await getMovie(r.tmdb_id)) as {
            genres?: { id: number }[];
            original_language?: string;
          } | null;
          if (!d) return;
          verdict.set(
            `${r.media_type}-${r.tmdb_id}`,
            (d.genres ?? []).some((g) => g.id === ANIMATION_GENRE) &&
              d.original_language === "ja",
          );
        } catch {
          /* لم نعرف؟ **يبقى `null`** — ويُسأل عنه في الفتحة القادمة.
             الكتابةُ بالشكّ تُخفي عملاً من تبويبه إلى الأبد بصمت. */
        }
      }),
    );
  }
  if (verdict.size === 0) return 0;

  /* أربعُ كتاباتٍ لا صفٌّ صف: (مسلسل/فيلم) × (أنمي/ليس أنمي) */
  for (const media of ["tv", "movie"] as const) {
    for (const value of [true, false]) {
      const ids = rows
        .filter(
          (r) =>
            r.media_type === media &&
            verdict.get(`${r.media_type}-${r.tmdb_id}`) === value,
        )
        .map((r) => r.tmdb_id);
      if (ids.length === 0) continue;
      await supabase
        .from("follows")
        .update({ is_anime: value })
        .eq("user_id", user.id)
        .eq("media_type", media)
        .in("tmdb_id", ids);
    }
  }

  revalidatePath("/library");
  return verdict.size;
}

export async function toggleEpisode(input: {
  showTmdbId: number;
  season: number;
  episode: number;
  runtime: number | null;
  watched: boolean;
}) {
  input = {
    ...input,
    showTmdbId: intId(input.showTmdbId),
    season: intIn(input.season, 0, 1000),
    episode: intIn(input.episode, 1, 20_000),
    runtime: input.runtime == null ? null : intIn(input.runtime, 0, 10_000),
  };
  // دلو خاص بتأشير الحلقات: أعلى فعلٍ تكراراً في التطبيق — إلغاء تأشير
  // عشرين حلقة بنقرات سريعة نمطٌ مشروع، والدلو الافتراضي كان يخنقه
  const { supabase, user } = await requireUser("ep", 120, 60_000);
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
  // لا revalidate لصفحة المسلسل: الواجهة تفاؤلية أصلاً، وكل ضغطة ✓ كانت
  // تعيد بناء الصفحة كاملة على الخادم (~15 استعلاماً وطلباً) بلا داعٍ
  revalidatePath("/");
  revalidatePath("/stats");
}

/**
 * تقييم حلقة (D-139) — **رأيٌ ومشاهدةٌ في نداءٍ واحد**.
 *
 * قرار أحمد: التقييم يعني المشاهدة. والكتابتان تجريان داخل دالّة
 * `set_episode_rating` في القاعدة لا هنا بنداءَين: نداءان من العميل قد
 * ينجح أوّلهما ويسقط ثانيهما، فتبقى حلقةٌ مقيَّمة وغير مشاهَدة — وهي
 * الحالة التي وُجد هذا التصميم لمنعها أصلاً.
 *
 * ونفس دلو `ep`: التقييم يقع في نفس دفقة تأشير الحلقات ولا يستحقّ حدّاً
 * أضيق منه.
 */
export async function rateEpisode(input: {
  showTmdbId: number;
  season: number;
  episode: number;
  /** ١..١٠ — و`null` تعني «اسحب تقييمي»، والمشاهدة تبقى */
  rating: number | null;
  review?: string | null;
  runtime?: number | null;
}) {
  const showTmdbId = intId(input.showTmdbId);
  const season = intIn(input.season, 0, 1000);
  const episode = intIn(input.episode, 1, 20_000);
  const { supabase } = await requireUser("ep", 120, 60_000);

  /* **الهجرة ٥٢ لم تُشغَّل؟ رسالةٌ للمستخدم لا رسالةُ Postgres.**
     `42883` = الدالّة غير موجودة. الكود قد يسبق الهجرة بدقائق (وقع هذا
     فعلاً: تعطّلت لوحة Supabase ساعةَ الشحن)، وفي تلك الدقائق يجب أن
     يقرأ المستخدم جملةً مفهومة لا «function set_episode_rating does not
     exist». وهذا **ليس فشلاً صامتاً**: التقييم لا يُحفظ ويُقال ذلك. */
  const guard = (error: { code?: string } | null) => {
    if (!error) return;
    if (error.code === "42883")
      throw new Error("تقييم الحلقات غير مفعّل بعد. / Episode ratings aren't enabled yet.");
    fail(error);
  };

  if (input.rating === null) {
    const { error } = await supabase.rpc("clear_episode_rating", {
      p_show: showTmdbId,
      p_season: season,
      p_episode: episode,
    });
    guard(error);
  } else {
    const { error } = await supabase.rpc("set_episode_rating", {
      p_show: showTmdbId,
      p_season: season,
      p_episode: episode,
      p_rating: intIn(input.rating, 1, 10),
      /* يُقصّ هنا كما يُقصّ في القاعدة: رسالةُ خطأٍ من Postgres ليست
         رسالةً للمستخدم (نفس قاعدة النبذة في D-044) */
      p_review: (input.review ?? "").trim().slice(0, 2000) || null,
      p_runtime: input.runtime == null ? null : intIn(input.runtime, 0, 10_000),
    });
    guard(error);
  }

  revalidatePath("/");
  revalidatePath("/ratings");
  revalidatePath("/stats");
}

// تأشير حلقة وكل ما قبلها كمشاهَد (اختيار الحلقة ٥٠ يعني مشاهدة ١..٥٠)
export async function watchUpTo(input: {
  showTmdbId: number;
  episodes: { season: number; episode: number; runtime: number | null }[];
}) {
  input = {
    showTmdbId: intId(input.showTmdbId),
    episodes: (input.episodes ?? []).slice(0, 5000).map((e) => ({
      season: intIn(e.season, 0, 1000),
      episode: intIn(e.episode, 1, 20_000),
      runtime: e.runtime == null ? null : intIn(e.runtime, 0, 10_000),
    })),
  };
  const { supabase, user } = await requireUser("ep", 120, 60_000);
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

  // نفس منطق toggleEpisode: التتابع السريع لا يعيد بناء صفحة المسلسل
  revalidatePath("/");
  revalidatePath("/stats");
}

// حفظ موضع التوقف في فيلم لاستئنافه لاحقاً
export async function saveMovieProgress(input: {
  movieTmdbId: number;
  positionMinutes: number;
  runtimeMinutes: number | null;
  title: string;
  posterPath: string | null;
}) {
  input = {
    ...input,
    movieTmdbId: intId(input.movieTmdbId),
    positionMinutes: intIn(input.positionMinutes, 0, 10_000),
    runtimeMinutes: input.runtimeMinutes == null ? null : intIn(input.runtimeMinutes, 1, 10_000),
    title: String(input.title ?? "").slice(0, 300),
    posterPath: safeImagePath(input.posterPath),
  };
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
  input = {
    ...input,
    showTmdbId: intId(input.showTmdbId),
    episodes: (input.episodes ?? []).slice(0, 5000).map((e) => ({
      season: intIn(e.season, 0, 1000),
      episode: intIn(e.episode, 1, 20_000),
      runtime: e.runtime == null ? null : intIn(e.runtime, 0, 10_000),
    })),
  };
  const { supabase, user } = await requireUser("ep", 120, 60_000);
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
  input = {
    ...input,
    movieTmdbId: intId(input.movieTmdbId),
    runtime: input.runtime == null ? null : intIn(input.runtime, 0, 10_000),
  };
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
    rows = rows.slice(0, 100).map((r) => ({
      tmdbId: intId(r.tmdbId),
      total: intIn(r.total, 0, 100_000),
      aired: intIn(r.aired, 0, 100_000),
      nextAirDate: dateOrNull(r.nextAirDate),
    }));
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

/** تاريخ عرض الفيلم يُخزَّن في صفّ المتابعة — فلا يُسأل TMDB عنه كل فتح */
export async function cacheMovieStats(rows: { tmdbId: number; releaseDate: string | null }[]) {
  if (!rows.length) return;
  try {
    rows = rows.slice(0, 100).map((r) => ({
      tmdbId: intId(r.tmdbId),
      releaseDate: dateOrNull(r.releaseDate),
    }));
    const { supabase, user } = await requireUser();
    const now = new Date().toISOString();
    await Promise.all(
      rows.slice(0, 100).map((r) =>
        supabase
          .from("follows")
          .update({ next_air_date: r.releaseDate, stats_updated_at: now })
          .match({ user_id: user.id, tmdb_id: r.tmdbId, media_type: "movie" }),
      ),
    );
  } catch {
    // تحسين أداء فقط
  }
}

/** الاسم المترجَم يُكتب مرة واحدة بدل ترجمته بطلبات TMDB في كل فتح */
export async function cacheFollowMeta(
  rows: { tmdbId: number; mediaType: MediaType; title: string; posterPath: string | null }[],
) {
  if (!rows.length) return;
  try {
    rows = rows.slice(0, 50).map((r) => ({
      tmdbId: intId(r.tmdbId),
      mediaType: asMediaType(r.mediaType),
      title: String(r.title ?? "").slice(0, 300),
      posterPath: safeImagePath(r.posterPath),
    }));
    const { supabase, user } = await requireUser();
    await Promise.all(
      rows.slice(0, 50).map((r) =>
        supabase
          .from("follows")
          .update({ title: r.title, poster_path: r.posterPath })
          .match({ user_id: user.id, tmdb_id: r.tmdbId, media_type: r.mediaType }),
      ),
    );
  } catch {
    // تحسين أداء فقط
  }
}

// ================= التقييمات والمراجعات =================

/**
 * تقييمي لعملٍ بعينه — يُقرأ **عند فتح ورقة التقييم لا مع الصفحة** (D-158).
 *
 * صفحةُ العمل تقرأ التقييم أصلاً، **لكن داخل مكوّنٍ مبثوثٍ خلف Suspense**
 * بعيداً عن `TitleActions`. وتمريرُه إليها كان يعني نقلَ القراءة إلى
 * المسار الحرج لتُدفع كلفتُها في **كل** فتحة صفحة، من أجل ورقةٍ تُفتح
 * أحياناً — وهو بالضبط ما رفضه جرسُ D-125: «الشارة رقمٌ من الخادم،
 * والأسطر تُحمَّل عند الفتح».
 *
 * ولا سياسة جديدة ولا جدول: قراءةٌ من `ratings` بمفتاحها الكامل
 * (user + tmdb + media)، فهرسيّةٌ وتخصّ صاحبها وحده (D-012).
 */
export async function myRatingFor(
  tmdbId: number,
  mediaType: MediaType,
): Promise<{ rating: number | null; review: string | null }> {
  try {
    const { getMyRating } = await import("@/lib/data");
    const row = await getMyRating(intId(tmdbId), asMediaType(mediaType));
    return { rating: row?.rating ?? null, review: row?.review ?? null };
  } catch {
    // فشلُ القراءة لا يمنع التقييم — الورقة تُفتح فارغةً والحفظ يعمل
    return { rating: null, review: null };
  }
}

export async function saveRating(input: {
  tmdbId: number;
  mediaType: MediaType;
  rating: number;
  review: string;
  title: string;
  posterPath: string | null;
}) {
  input = {
    ...input,
    tmdbId: intId(input.tmdbId),
    mediaType: asMediaType(input.mediaType),
    title: String(input.title ?? "").slice(0, 300),
    posterPath: safeImagePath(input.posterPath),
  };
  const { supabase, user } = await requireUser("rate", 20, 60_000);

  const rating = Math.max(1, Math.min(10, Math.round(Number(input.rating) || 1)));
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
  input = { tmdbId: intId(input.tmdbId), mediaType: asMediaType(input.mediaType) };
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

/**
 * المتابعة مع احترام الحساب الخاص (follow_requests.sql).
 *
 * الدالّة في القاعدة تقرأ `is_private` الهدف وتقرّر: الخاصّ طلبٌ معلّق،
 * والعامّ متابعةٌ فورية — وتُرجع أيّهما وقع فيعرف الزرّ حالته بلا قراءةٍ
 * ثانية. `followUser` القديمة تبقى للمسارات الداخلية التي لا تمرّ بالخاصّ.
 */
export async function requestOrFollowUser(
  targetId: string,
): Promise<"requested" | "following" | "noop"> {
  targetId = uuid(targetId);
  const { supabase, user } = await requireUser();
  if (targetId === user.id) throw new Error("لا يمكنك متابعة نفسك / You can't follow yourself");
  const { data, error } = await supabase.rpc("request_or_follow", { target: targetId });
  if (error) fail(error);
  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
  return (data as "requested" | "following" | "noop") ?? "noop";
}

/** سحبُ طلبي قبل قبوله — حذفُ صفٍّ أملكه (سياسة cancel or reject) */
export async function cancelFollowRequest(targetId: string) {
  targetId = uuid(targetId);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("follow_requests")
    .delete()
    .match({ requester_id: user.id, target_id: targetId });
  if (error) fail(error);
  revalidatePath("/u/[username]", "page");
}

/** قبول طلبٍ وارد — definer يُنشئ صفَّ متابعة الطالب لي */
export async function acceptFollowRequest(requesterId: string) {
  requesterId = uuid(requesterId);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("accept_follow_request", { requester: requesterId });
  if (error) fail(error);
  revalidatePath("/people");
  revalidatePath("/");
}

/** رفضُ طلبٍ وارد — حذفُ صفٍّ هدفُه أنا */
export async function rejectFollowRequest(requesterId: string) {
  requesterId = uuid(requesterId);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("follow_requests")
    .delete()
    .match({ requester_id: requesterId, target_id: user.id });
  if (error) fail(error);
  revalidatePath("/people");
}

/** إزالةُ متابِعٍ لي — definer يحذف صفّاً لا أملكه (طلب المالك) */
export async function removeFollowerUser(followerId: string) {
  followerId = uuid(followerId);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("remove_follower", { follower: followerId });
  if (error) fail(error);
  revalidatePath("/people");
  revalidatePath("/");
}

// ============================================================
//  متابعة الفنانين (person_follows.sql)
//
//  upsert لا insert: ضغطتان متسارعتان على الزرّ المتفائل لا تصنعان خطأ
//  مفتاحٍ مكرّر. والاسم والصورة يُحفظان مع الصفّ (D-048) كي يبقى مقروءاً
//  حين يسقط TMDB.
// ============================================================

export async function followArtist(input: {
  personId: number;
  name?: string | null;
  profilePath?: string | null;
}) {
  const personId = intId(input.personId);
  const { supabase, user } = await requireUser("follow-artist", 30, 60_000);
  const { error } = await supabase.from("person_follows").upsert(
    {
      user_id: user.id,
      person_id: personId,
      name: input.name ? String(input.name).slice(0, 200) : null,
      profile_path: safeImagePath(input.profilePath ?? null),
    },
    { onConflict: "user_id,person_id" },
  );
  if (error) fail(error);
  revalidatePath("/news");
}

export async function unfollowArtist(personId: number) {
  personId = intId(personId);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("person_follows")
    .delete()
    .match({ user_id: user.id, person_id: personId });
  if (error) fail(error);
  revalidatePath("/news");
}

// ============================================================
//  الحظر والإبلاغ عن حساب (blocks.sql / user_reports.sql)
//
//  الفعلان جاران في قائمة الملف لكنّهما مختلفان: الحظر يحميك أنت —
//  definer واحد يقطع الرسائل من الطرفين ويفكّ المتابعة في الاتجاهين؛
//  والبلاغ يحمي غيرَك — صفٌّ يصل لصاحب التطبيق وحده ولا يعلم به أحد.
// ============================================================

/** حظرُ حساب — block_user يفكّ المتابعة في الاتجاهين ويغلق الرسائل */
export async function blockUser(targetId: string) {
  targetId = uuid(targetId);
  const { supabase, user } = await requireUser("block", 10, 60_000);
  if (user.id === targetId) return;
  const { error } = await supabase.rpc("block_user", { target: targetId });
  if (error) fail(error);
  revalidatePath("/people");
  revalidatePath("/");
}

/** رفعُ الحظر — حذفُ صفّك؛ لا تعود المتابعة تلقائياً (قرار blocks.sql) */
export async function unblockUser(targetId: string) {
  targetId = uuid(targetId);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .match({ blocker_id: user.id, blocked_id: targetId });
  if (error) fail(error);
  revalidatePath("/people");
}

/** قائمة من حظرتُهم — لقسم «المحظورون» في الإعدادات */
/** نوع إشارة الجرس — الأربعة التي ترجعها `my_signals` (D-125) */
export type SignalKind = "follow" | "request" | "like_review" | "like_activity";

export interface Signal {
  kind: SignalKind;
  person: PersonLite;
  tmdbId: number | null;
  mediaType: "tv" | "movie" | null;
  title: string | null;
  at: string;
  isNew: boolean;
}

/**
 * أسطر الجرس — تُطلب عند فتح الورقة وحدها (**D-125**).
 *
 * الشارة تحمل رقماً من `getUnreadSignals` في كل صفحة؛ أما الأسماء
 * والعناوين فلا تُحمَّل إلا لمن فتح — نفس تقسيم `BlockedList`.
 */
export async function mySignals(): Promise<Signal[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("my_signals");
  if (error) fail(error);
  return ((data ?? []) as {
    kind: SignalKind;
    actor_id: string;
    nickname: string | null;
    username: string | null;
    avatar_url: string | null;
    hide_name: boolean | null;
    tmdb_id: number | null;
    media_type: "tv" | "movie" | null;
    title: string | null;
    at: string;
    is_new: boolean;
  }[]).map((r) => ({
    kind: r.kind,
    person: {
      id: r.actor_id,
      nickname: r.nickname,
      username: r.username,
      avatar_url: r.avatar_url,
      hide_name: r.hide_name,
    } as PersonLite,
    tmdbId: r.tmdb_id,
    mediaType: r.media_type,
    title: r.title,
    at: r.at,
    isNew: r.is_new,
  }));
}

/** ختمُ «رأيتُ الجرس» — يُنادى مرّةً عند الفتح فتسقط الشارة */
export async function markSignalsSeen() {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_signals_seen");
  if (error) fail(error);
}

/**
 * ختمُ «رأيتُ خطّي» (D-149) — يُنادى **بعد** رسم الصفحة لا قبله.
 *
 * الترتيب هو المعنى كلّه: لو خُتم قبل الرسم لسقط علوُّ الجديد في نفس
 * الزيارة التي جاء ليُريها. فالزيارة الحالية تراه عالياً، والتالية تراه
 * في مكانه — «مرّة وحدة ثم تنزل».
 *
 * وفشلُه صامت: ختمٌ لم يُكتب يعني صفّاً يعلو مرّةً زائدة، وهو أرخص من
 * رسالة خطأ على شاشةٍ لم يطلب صاحبها شيئاً.
 */
/** عدّادُ ما وصل بعد ختمك (D-151) — رقمٌ لا أسطر، وصفرٌ صامتٌ عند أي خلل */
export async function newFeedCount(): Promise<number> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("new_feed_count");
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}

export async function markFeedSeen() {
  try {
    const { supabase } = await requireUser();
    await supabase.rpc("mark_feed_seen");
  } catch {
    /* لا شيء — انظر أعلاه */
  }
}

export async function myBlocksList(): Promise<PersonLite[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("my_blocks");
  if (error) fail(error);
  return ((data ?? []) as { user_id: string; username: string | null; nickname: string | null; avatar_url: string | null; hide_name: boolean | null }[]).map((r) => ({
    id: r.user_id,
    username: r.username,
    nickname: r.nickname,
    avatar_url: r.avatar_url,
    hide_name: r.hide_name,
  })) as PersonLite[];
}

/** الإبلاغ عن حساب — كإبلاغ المراجعة: صامتٌ، مرّةٌ واحدة، سببٌ اختياريّ */
export async function reportUser(input: { targetId: string; reason?: string }) {
  const targetId = uuid(input.targetId);
  const { supabase, user } = await requireUser("report", 10, 60_000);
  if (user.id === targetId) return;
  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const { error } = await supabase.from("user_reports").upsert(
    { target_id: targetId, reporter_id: user.id, reason: reason || null },
    { onConflict: "target_id,reporter_id", ignoreDuplicates: true },
  );
  if (error) fail(error);
}

// ============================================================
//  المجتمعات (communities.sql)
// ============================================================

/**
 * إنشاء مجتمعي — واحدٌ لكل شخص (unique owner_id).
 *
 * الدالّة في القاعدة تُنشئ الصفّ وتُدخل المالك عضواً في نقلةٍ واحدة.
 * تعارضُ الفريد (23505) يعني «لديك مجتمعٌ بالفعل» — رسالةٌ للمستخدم لا
 * خطأُ قاعدةٍ خام.
 */
export async function createCommunity(input: {
  name: string;
  isPrivate: boolean;
}): Promise<string> {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
  if (name.length < 2) throw new Error("اسمٌ أقصر من حرفين / Name too short");
  const { supabase } = await requireUser("community", 5, 60_000);
  const { data, error } = await supabase.rpc("create_community", {
    p_name: name,
    p_private: !!input.isPrivate,
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("لديك مجتمعٌ بالفعل — لكل شخصٍ مجتمعٌ واحد / You already have a community");
    fail(error);
  }
  revalidatePath("/people");
  return data as string;
}

/** الانضمام: مباشرةً للعامّ، وطلبٌ للخاصّ — تُرجع أيّهما وقع */
export async function joinCommunity(id: string): Promise<"joined" | "requested" | "noop"> {
  id = uuid(id);
  const { supabase } = await requireUser("community", 20, 60_000);
  const { data, error } = await supabase.rpc("join_community", { p_community: id });
  if (error) fail(error);
  revalidatePath("/people");
  return (data as "joined" | "requested" | "noop") ?? "noop";
}

/** المغادرة — حذف عضويتي (المالك لا يغادر؛ يحذف مجتمعه) */
export async function leaveCommunity(id: string) {
  id = uuid(id);
  const { supabase, user } = await requireUser("community", 20, 60_000);
  const { error } = await supabase
    .from("community_members")
    .delete()
    .match({ community_id: id, user_id: user.id });
  if (error) fail(error);
  revalidatePath("/people");
}

/** سحبُ طلب انضمامي المعلّق لمجتمعٍ خاص */
export async function cancelCommunityRequest(id: string) {
  id = uuid(id);
  const { supabase, user } = await requireUser("community", 20, 60_000);
  const { error } = await supabase
    .from("community_join_requests")
    .delete()
    .match({ community_id: id, user_id: user.id });
  if (error) fail(error);
  revalidatePath("/people");
}

/** قبول طلب انضمام — المالك وحده (definer يتحقّق) */
export async function acceptCommunityRequest(communityId: string, userId: string) {
  communityId = uuid(communityId);
  userId = uuid(userId);
  const { supabase } = await requireUser("community", 30, 60_000);
  const { error } = await supabase.rpc("accept_join_request", {
    p_community: communityId,
    p_user: userId,
  });
  if (error) fail(error);
  revalidatePath("/people");
}

/** رفض طلب انضمام — سياسة الحذف تسمح للمالك */
export async function rejectCommunityRequest(communityId: string, userId: string) {
  communityId = uuid(communityId);
  userId = uuid(userId);
  const { supabase } = await requireUser("community", 30, 60_000);
  const { error } = await supabase
    .from("community_join_requests")
    .delete()
    .match({ community_id: communityId, user_id: userId });
  if (error) fail(error);
  revalidatePath("/people");
}

/** حذف مجتمعي — يفكّ العضويات والرسائل معه (on delete cascade) */
export async function deleteCommunity(id: string) {
  id = uuid(id);
  const { supabase, user } = await requireUser("community", 5, 60_000);
  const { error } = await supabase
    .from("communities")
    .delete()
    .match({ id, owner_id: user.id });
  if (error) fail(error);
  revalidatePath("/people");
}

/**
 * صورة المجتمع (هجرة 41) — يضعها المالك أو يمسحها.
 *
 * الرابط يمرّ على `safeImageUrl` كصورة الملف الشخصي تماماً: مخزننا وحده،
 * وإلا صار الملف العام منارةَ تسريب IP لخادمٍ غريب. والملكية تحرسها
 * سياسة «owner edits community» في SQL — الـmatch هنا صدقٌ مبكر لا حارس.
 */
export async function setCommunityPhoto(communityId: string, url: string | null) {
  communityId = uuid(communityId);
  const { supabase, user } = await requireUser("community", 10, 60_000);
  const clean = url === null ? null : safeImageUrl(url);
  if (url !== null && clean === null) throw new Error("رابط صورةٍ غير مقبول");
  const { error } = await supabase
    .from("communities")
    .update({ photo_url: clean })
    .match({ id: communityId, owner_id: user.id });
  if (error) fail(error);
  revalidatePath("/people");
}

/** رسالة في غرفة مجتمع — سياسة الإدراج تشترط العضوية */
export async function postCommunityMessage(communityId: string, body: string) {
  communityId = uuid(communityId);
  const clean = String(body ?? "").trim();
  if (clean.length < 1 || clean.length > 2000) {
    throw new Error("مدخل غير صالح / Invalid input");
  }
  const { supabase, user } = await requireUser("community-msg", 30, 60_000);
  const { error } = await supabase.from("community_messages").insert({
    community_id: communityId,
    author_id: user.id,
    body: clean,
  });
  if (error) fail(error);
  revalidatePath("/people");
}

/** بحث المجتمعات بالاسم — يمرّ عبر أكشن لأن العميل لا يستدعي data.ts */
export async function searchCommunities(q: string) {
  const term = String(q ?? "").trim().slice(0, 50);
  const { supabase } = await requireUser("community", 30, 60_000);
  const { data, error } = await supabase.rpc("search_communities", { q: term });
  if (error) fail(error);
  return ((data ?? []) as CommunityLite[]).map((c) => ({
    ...c,
    member_count: Number(c.member_count),
  }));
}

/**
 * غرفة عملٍ عند أوّل اهتمام (D-140، هجرة 53) — تُرجع معرّف الغرفة.
 *
 * **الاسم والملصق يُجلبان هنا على الخادم من TMDB، لا يُرسلهما العميل.**
 * غرفةُ العمل صفٌّ لا يملكه أحد ويراه كل الناس؛ ولو قَبِل الاسمَ من
 * المتصفّح لصار أوّلُ زائرٍ قادراً على تسمية غرفة «Interstellar» بما شاء
 * للأبد. النداءُ مخبّأٌ ساعةً في طبقة TMDB، ولا يقع إلا على من ضغط.
 */
export async function openTitleRoom(tmdbId: number, mediaType: "tv" | "movie") {
  const id = intId(tmdbId);
  const type = asMediaType(mediaType);
  const { supabase } = await requireUser("title-room", 10, 60_000);

  const { getTv, getMovie } = await import("@/lib/tmdb");
  let name = "";
  let poster: string | null = null;
  try {
    if (type === "tv") {
      const tv = await getTv(id);
      name = (tv.name ?? "").trim();
      poster = tv.poster_path;
    } else {
      const mv = await getMovie(id);
      name = (mv.title ?? "").trim();
      poster = mv.poster_path;
    }
  } catch {
    throw new Error("تعذّر جلب بيانات العمل / Could not load the title");
  }
  if (name.length < 2) throw new Error("تعذّر جلب بيانات العمل / Could not load the title");

  const { data, error } = await supabase.rpc("title_community", {
    p_tmdb: id,
    p_type: type,
    p_name: name,
    p_poster: poster ? `https://image.tmdb.org/t/p/w185${poster}` : null,
  });
  // 42883 = الدالّة غير موجودة — هجرة ٥٣ لم تُشغَّل بعد. جملةٌ عربية
  // للمستخدم لا رسالةَ Postgres (درس D-139).
  if (error) {
    if ((error as { code?: string }).code === "42883") {
      throw new Error("غرف الأعمال غير مفعّلة بعد / Title rooms are not enabled yet");
    }
    fail(error);
  }
  if (!data) throw new Error("تعذّر فتح الغرفة / Could not open the room");
  revalidatePath("/people");
  return data as string;
}

export async function followUser(targetId: string) {
  targetId = uuid(targetId);
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
  targetId = uuid(targetId);
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
  await requireUser("search", 15, 10_000);
  const { searchPeople } = await import("@/lib/data");
  return searchPeople(String(q ?? "").slice(0, 50));
}

/**
 * «أشخاص لمتابعتهم» لشاشة التهيئة (D-126).
 *
 * البذرة تُمرَّر من العميل لأن المتابعات لم تُكتب بعد: شاشة الانضمام
 * تحفظ كل شيء في خطوتها الأخيرة، فقراءة المكتبة هنا تقرأ فراغاً. والحدّ
 * والتصفية كلّها في `people_to_follow` — هذا غلافُ إذنٍ لا منطق.
 */
export async function suggestPeople(seedIds: number[], want = 6) {
  await requireUser("search", 15, 10_000);
  const { getPeopleToFollow } = await import("@/lib/data");
  const seeds = (Array.isArray(seedIds) ? seedIds : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 40);
  return getPeopleToFollow(seeds.length ? seeds : null, want);
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
  items = (items ?? []).slice(0, 24).map((it) => ({
    tmdbId: intId(it.tmdbId),
    mediaType: asMediaType(it.mediaType),
    progress: it.progress === "done" ? "done" : it.progress === "some" ? "some" : "none",
  }));
  const { supabase, user } = await requireUser("bulk", 8, 60_000);
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

/** وصفٌ قصير: سطرٌ واحد بلا أسطر جديدة، ١٢٠ حرفاً سقفاً في الكود وفي SQL */
function subtitleOf(v: unknown): string | null {
  const clean = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  return clean || null;
}

export async function createList(
  name: string,
  isPublic = false,
  subtitle?: string | null,
): Promise<string | null> {
  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) throw new Error("empty name");
  const { supabase, user } = await requireUser("list", 10, 60_000);

  // سقف معقول: يمنع إنشاء آلاف القوائم بحلقة برمجية
  const { count } = await supabase
    .from("user_lists")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= 50) throw new Error("too many lists");

  const { data, error } = await supabase
    .from("user_lists")
    .insert({ user_id: user.id, name: clean, is_public: !!isPublic, subtitle: subtitleOf(subtitle) })
    .select("id")
    .single();
  if (error) fail(error);

  revalidatePath("/lists");
  return data?.id ?? null;
}

/**
 * تعديل هويّة القائمة: الاسم والإعلان والوصف.
 *
 * `subtitle` غير مُمرَّرة تعني «لا تلمسه» لا «امحه»: زرّ معلنة/خاصة يستدعي
 * هذه الدالّة بثلاث وسائط فقط، ولو كان الغياب محواً لضاع وصف القائمة مع كل
 * تبديلٍ للإعلان. التمرير الصريح بسلسلةٍ فارغة هو المحو.
 */
export async function renameList(
  listId: string,
  name: string,
  isPublic: boolean,
  subtitle?: string | null,
) {
  listId = uuid(listId);
  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) throw new Error("empty name");
  const { supabase, user } = await requireUser();
  // شرط الملكية صريحٌ في الاستعلام لا في RLS وحدها، والصفوف المتأثرة
  // تُفحص: تعديلٌ لم يصب شيئاً (قائمة ليست لك) يفشل بصوت لا بصمت
  const { data, error } = await supabase
    .from("user_lists")
    .update({
      name: clean,
      is_public: !!isPublic,
      ...(subtitle === undefined ? {} : { subtitle: subtitleOf(subtitle) }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", listId)
    .eq("user_id", user.id)
    .select("id");
  if (error) fail(error);
  if (!data?.length) throw new Error("القائمة غير موجودة / List not found");
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}

/**
 * نوع القائمة: عادية / مرتّبة / ترتيب مشاهدة.
 *
 * العودة إلى «عادية» لا تمحو `sort_order` عمداً — من غيّر رأيه ثم عاد يجد
 * ترتيبه كما تركه بدل أن يعيد سحب خمسين عملاً.
 */
export async function setListKind(listId: string, kind: string) {
  listId = uuid(listId);
  const clean = ["regular", "ranked", "watch_order"].includes(kind) ? kind : "regular";
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_lists")
    .update({ kind: clean, updated_at: new Date().toISOString() })
    .eq("id", listId)
    .eq("user_id", user.id)
    .select("id");
  if (error) fail(error);
  if (!data?.length) throw new Error("القائمة غير موجودة / List not found");
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}

/**
 * حفظ الترتيب اليدوي — استدعاءٌ واحد لا تحديثٌ لكل عنصر.
 *
 * المفاتيح تُنخَّل قبل إرسالها: الدالّة في SQL تركّب مفتاح كل صفٍّ من
 * عموديه وتبحث عنه في المصفوفة، فالمفتاح المشوَّه لا يطابق شيئاً — والنخل
 * يمنع وصوله أصلاً. والملكية تحرسها RLS داخل الدالّة لا شرطٌ هنا.
 */
export async function reorderList(listId: string, keys: string[]) {
  listId = uuid(listId);
  const clean = (Array.isArray(keys) ? keys : [])
    .slice(0, 500)
    .map((k) => String(k ?? ""))
    .filter((k) => /^(tv|movie)-\d{1,9}$/.test(k));
  const { supabase } = await requireUser("list", 30, 60_000);
  const { error } = await supabase.rpc("reorder_list", { p_list: listId, p_keys: clean });
  if (error) fail(error);
  revalidatePath(`/lists/${listId}`);
}

/**
 * غلافُ القائمة — خلفيّةُ عملٍ من داخلها (D-208).
 *
 * **ولماذا لا تُعيد استخدام `setTitleArt`:** تلك تكتب في `title_art`
 * وتعني «هذا العملُ بالوجه الذي أريده» في كل سطوحي؛ وهذه تعني «هذه
 * القائمةُ بهذا الوجه». صورةٌ واحدة ومعنيان مختلفان — وخلطُهما كان
 * سيجعل اختيار غلافِ قائمةٍ يبدّل وجهَ العمل في المكتبة كلها.
 *
 * **والمصدرُ محصورٌ بأعمال القائمة** لأن الطلب كذلك حرفياً («صورة من
 * هيدرات الأفلام التي ضمن اللستة») — والحصرُ يقع في المنتقي لا هنا:
 * الفعلُ يتحقّق من شكل المسار والملكية، **ولا يستعلم TMDB أصلاً** فلا
 * موضع لتحقّقٍ ثالثٍ يكلّف نداءً في كل حفظ.
 *
 * تمريرُ `backdropPath = null` يمحو الغلاف ويعيد الملصقات — نفس نمط
 * «أعِد الأصل» في D-131، بلا زرٍّ ثالثٍ لفعلٍ عكسيّ واضح.
 */
export async function setListCover(input: {
  listId: string;
  tmdbId: number | null;
  mediaType: MediaType | null;
  backdropPath: string | null;
}) {
  const listId = uuid(input.listId);
  const backdrop = safeImagePath(input.backdropPath);
  /* لا خلفيةَ = لا نسب: الحقولُ الثلاثة تُمحى معاً فلا يبقى معرّفٌ
     معلّقٌ بلا صورة */
  const tmdbId = backdrop && input.tmdbId ? intId(input.tmdbId) : null;
  const mediaType = backdrop && input.mediaType ? asMediaType(input.mediaType) : null;

  const { supabase, user } = await requireUser("art", 30, 60_000);
  const { data, error } = await supabase
    .from("user_lists")
    .update({
      cover_backdrop: backdrop,
      cover_tmdb_id: tmdbId,
      cover_media_type: mediaType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listId)
    .eq("user_id", user.id)
    .select("id");
  if (error) fail(error);
  if (!data?.length) throw new Error("القائمة غير موجودة / List not found");

  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/library");
}

export async function deleteList(listId: string) {
  listId = uuid(listId);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_lists")
    .delete()
    .eq("id", listId)
    .eq("user_id", user.id)
    .select("id");
  if (error) fail(error);
  if (!data?.length) throw new Error("القائمة غير موجودة / List not found");
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
  input = {
    ...input,
    listId: uuid(input.listId),
    tmdbId: intId(input.tmdbId),
    mediaType: asMediaType(input.mediaType),
    title: String(input.title ?? "").slice(0, 300),
  };
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

// ============================================================
//  إنشاء قائمة من مجموعة أعمال — أعمال فنان، أو أجزاء سلسلة
//
//  محرّكٌ واحد لزرَّين: صفحة الفنان تمرّر أعماله، وصفحة الفيلم تمرّر أجزاء
//  سلسلته. القرار: **إن وُجدت قائمةٌ بنفس الاسم عندي أُضيف إليها الناقص**
//  بدل إنشاء مكرّرة — أرحم بمن ضغط الزرّ مرّتين، ويحترم ترتيبه اليدوي لأن
//  الإدراج يتجاهل المكرّر (`ignoreDuplicates`) فلا يمسّ صفّاً موجوداً.
// ============================================================

type NewItem = { tmdbId: number; mediaType: MediaType; title: string; posterPath: string | null };

/**
 * يُنشئ القائمة أو يجدها بالاسم، ثم يُدرج ما ينقص.
 *
 * القائمة الجديدة وحدها تأخذ نوعها و`sort_order` (ترتيب مشاهدةٍ للأجزاء)؛
 * الدمج في قائمةٍ قائمة لا يفرض عليها نوعاً ولا يعيد ترتيبها.
 */
async function upsertListWithItems(
  name: string,
  rawItems: NewItem[],
  kind: "regular" | "watch_order" | "ranked",
): Promise<{ listId: string; name: string; added: number; created: boolean }> {
  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) throw new Error("مدخل غير صالح / Invalid input");

  // تنقية وإزالة التكرار داخل الدفعة نفسها
  const seen = new Set<string>();
  const items = rawItems
    .map((r) => ({
      tmdbId: intId(r.tmdbId),
      mediaType: asMediaType(r.mediaType),
      title: String(r.title ?? "").slice(0, 300),
      posterPath: safeImagePath(r.posterPath),
    }))
    .filter((r) => {
      const k = `${r.mediaType}-${r.tmdbId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    // السقف 300 لا 100: قوائم TOP 250 (طلب أحمد) تحتاج ٢٥٠ عنصراً —
    // ويبقى حاجزاً ضد دفعةٍ عابثة بآلاف الصفوف
    .slice(0, 300);
  if (items.length === 0) {
    throw new Error("لا أعمال لإضافتها / Nothing to add");
  }

  const { supabase, user } = await requireUser("list", 10, 60_000);

  // قائمةٌ بنفس الاسم عندي؟ نُضيف إليها بدل التكرار
  const { data: existing } = await supabase
    .from("user_lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", clean)
    .order("created_at", { ascending: true })
    .limit(1);

  let listId = existing?.[0]?.id as string | undefined;
  const created = !listId;

  if (!listId) {
    const { count } = await supabase
      .from("user_lists")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= 50) throw new Error("too many lists");

    const { data, error } = await supabase
      .from("user_lists")
      .insert({ user_id: user.id, name: clean, kind })
      .select("id")
      .single();
    if (error) fail(error);
    listId = data!.id as string;
  }

  // القائمة الجديدة من نوع «ترتيب مشاهدة» تحمل ترتيب الدفعة؛ الدمج لا
  const rows = items.map((it, i) => ({
    list_id: listId!,
    tmdb_id: it.tmdbId,
    media_type: it.mediaType,
    title: it.title,
    poster_path: it.posterPath,
    ...(created && kind === "watch_order" ? { sort_order: i } : {}),
  }));

  // `ignoreDuplicates` يُبقي الصفوف الموجودة كما هي، ويعيد المُدرَج وحده
  const { data: inserted, error } = await supabase
    .from("user_list_items")
    .upsert(rows, { onConflict: "list_id,tmdb_id,media_type", ignoreDuplicates: true })
    .select("tmdb_id");
  if (error) fail(error);

  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  return { listId: listId!, name: clean, added: inserted?.length ?? 0, created };
}

/** زرّ صفحة الفنان: قائمة بأشهر ٢٠ عملاً له */
export async function createListFromPerson(personId: number) {
  personId = intId(personId);
  const { getPerson, getPersonCredits, isTvProgram, titleOf } = await import("@/lib/tmdb");
  const [person, works] = await Promise.all([
    getPerson(personId),
    getPersonCredits(personId),
  ]);
  const name = person?.name?.trim();
  if (!name) throw new Error("تعذّر تحميل الفنان / Could not load this person");

  /* البرامج خارج القائمة (طلب أحمد): ظهور توك شو ليس «عملاً» يُقتنى —
     قائمة توم هانكس كانت أغلبها برامج قبل هذا الفلتر */
  const items: NewItem[] = works.filter((w) => !isTvProgram(w)).slice(0, 20).map((w) => ({
    tmdbId: w.id,
    mediaType: w.media_type as MediaType,
    title: titleOf(w),
    posterPath: w.poster_path,
  }));
  return upsertListWithItems(name, items, "regular");
}

/** زرّ صفحة الفيلم: قائمة «ترتيب مشاهدة» بكل أجزاء السلسلة */
export async function createListFromCollection(collectionId: number) {
  collectionId = intId(collectionId);
  const { getCollection, titleOf } = await import("@/lib/tmdb");
  const collection = await getCollection(collectionId);
  const name = collection?.name?.trim();
  if (!name || !collection?.parts?.length) {
    throw new Error("لا أجزاء لهذه السلسلة / No parts found");
  }

  // ترتيب الأجزاء بتاريخ العرض — قائمةٌ بترتيب المشاهدة تبدأ من الأقدم
  const parts = [...collection.parts].sort((a, b) =>
    (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999"),
  );
  const items: NewItem[] = parts.map((p) => ({
    tmdbId: p.id,
    mediaType: "movie" as MediaType,
    title: titleOf(p),
    posterPath: p.poster_path,
  }));
  return upsertListWithItems(name, items, "watch_order");
}

/**
 * زرّ صفحة الفيلم: قائمة «ترتيب مشاهدة» بعالمٍ كامل (D-074).
 *
 * العالم قاموسٌ منسَّق (universes.ts) لأن TMDB لا يعرفه، وترتيبُ معرّفاته
 * هو ترتيب الأحداث — قرار أحمد: من يفتح القائمة يعرف من أين يبدأ ويلحق
 * ما فاته. الزرّ لا يحمل بيانات؛ الفعل يجلبها (D-052)، والمحرك واحد.
 */
export async function createListFromUniverse(slug: string) {
  const clean = String(slug ?? "").trim().toLowerCase();
  const { universeBySlug, universeName } = await import("@/lib/universes");
  const universe = universeBySlug(clean);
  if (!universe) throw new Error("عالمٌ غير معروف / Unknown universe");

  const [{ moviesByIds, resolveSetIds, awardWinners, titleOf }, { getLocale }] = await Promise.all([
    import("@/lib/tmdb"),
    import("@/lib/locale"),
  ]);

  /* مجموعات الجوائز: الفائزون بالأحدث أولاً — نوعها «ranked» لأن ترتيبها
     زمنيٌّ معنويّ لا ترتيب مشاهدة */
  if (universe.award) {
    const [rows, locale] = await Promise.all([
      awardWinners(universe.award),
      getLocale(),
    ]);
    if (!rows.length) throw new Error("تعذّر تحميل القائمة / Could not load this list");
    const items: NewItem[] = rows.map((r) => ({
      tmdbId: r.id,
      mediaType: (r.media_type === "tv" ? "tv" : "movie") as MediaType,
      title: titleOf(r),
      posterPath: r.poster_path,
    }));
    return upsertListWithItems(universeName(universe, locale), items, "ranked");
  }

  /* مجموعات TOP 250: العناصر من قوائم top_rated وقد تكون مسلسلات —
     والنوع «ranked»: هذه ترتيبُ جودةٍ لا ترتيبُ مشاهدة */
  if (universe.top) {
    /* **نفس ترتيب المعاينة حرفاً بحرف** (D-135): لم تعد الخطوات منسوخةً
       هنا وفي `api/franchise` برجاءِ ألّا ينساها أحد — كلاهما ينادي
       `topChartRows`. قائمةٌ محفوظة تخالف ما عايَنه المستخدم قبل ثانية
       أسوأ من ترتيبٍ رديء، والضمانةُ الآن بنيويّة لا تحريريّة. */
    const want = universe.topLimit ?? 250;
    const [rows, locale] = await Promise.all([
      (await import("@/lib/topChart")).topChartRows(universe.top, want),
      getLocale(),
    ]);

    const items: NewItem[] = rows.map((r) => ({
      tmdbId: r.id,
      mediaType: (r.media_type === "tv" ? "tv" : "movie") as MediaType,
      title: titleOf(r),
      posterPath: r.poster_path,
    }));
    if (!items.length) throw new Error("تعذّر تحميل القائمة / Could not load this list");
    return upsertListWithItems(universeName(universe, locale), items, "ranked");
  }

  // مجموعات collectionId تُحلّ من سلسلة TMDB بترتيب الإصدار
  const ids = await resolveSetIds(universe);
  const [movies, locale] = await Promise.all([
    moviesByIds(ids),
    getLocale(),
  ]);
  if (!movies.length) throw new Error("تعذّر تحميل أفلام العالم / Could not load this universe");

  const items: NewItem[] = movies.map((m) => ({
    tmdbId: m.id,
    mediaType: "movie" as MediaType,
    title: m.title,
    posterPath: m.poster_path,
  }));
  return upsertListWithItems(universeName(universe, locale), items, "watch_order");
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
  reviewUserId = uuid(reviewUserId);
  tmdbId = intId(tmdbId);
  mediaType = asMediaType(mediaType);
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
  // لا تجديد للرئيسية: الإعجاب يُنقر من صفحات العمل والناس، وكلاهما لا
  // يرسم بيانات الرئيسية — تجديدُ أغلى صفحةٍ مع كل قلب كان هدراً صافياً
  revalidatePath(`/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`);
}

/**
 * إعجابٌ بحدثِ مشاهدة، أو سحبه (**D-124**).
 *
 * توأمُ `toggleReviewLike` بجدولٍ آخر ومفتاحٍ فيه **يوم** — لأن صفّ الخطّ
 * نفسه مفتاحُه (فاعل، عمل، جهة، يوم) منذ D-123. ولا يُستدعى لصفٍّ يحمل
 * تقييماً: ذاك إعجابُ رأيٍ ويبقى في `review_likes` كي يبقى «أعجبني رأيك»
 * رقماً واحداً أينما ظهر.
 *
 * والحراسة كلها في القاعدة كسابقتها: المفتاح الأساسي يمنع التكرار،
 * والقيد يمنع الإعجاب بحدث النفس، والسياسة تمنع الكتابة باسم غيرك.
 *
 * **بلا `revalidatePath`:** الزرّ متفائلٌ ويملك عدّاده، والخطّ يُعاد
 * قراءته في أول تنقّلٍ طبيعي — وتجديد `/people` مع كل قلبٍ يعيد بناء
 * خطٍّ من ستّين صفّاً ثمناً لرقمٍ واحدٍ رُسم أصلاً.
 */
export async function toggleActivityLike(
  actorId: string,
  tmdbId: number,
  mediaType: "tv" | "movie",
  day: string,
  liked: boolean,
) {
  actorId = uuid(actorId);
  tmdbId = intId(tmdbId);
  mediaType = asMediaType(mediaType);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("bad day");
  const { supabase, user } = await requireUser();
  const key = {
    actor_id: actorId,
    tmdb_id: tmdbId,
    media_type: mediaType,
    day,
    liker_id: user.id,
  };

  const { error } = liked
    ? await supabase.from("activity_likes").delete().match(key)
    : await supabase.from("activity_likes").insert(key);

  if (error) fail(error);
}

/**
 * «شفته كله»: يعلّم كل الحلقات المعروضة دفعةً واحدة.
 *
 * **وتُرجع ما أضافته هي وحدها.** ضغطة ✓ صارت فوريّة بلا ورقة تأكيد
 * (D-047 المعدَّل)، والحماية انتقلت إلى زرّ تراجعٍ في الرسالة العابرة —
 * والتراجع لا يكون صادقاً إلا إذا حذف ما أُضيف في تلك الضغطة **دون** ما
 * كان المستخدم قد أشّره بنفسه قبلها. فتُقرأ الحلقات الموجودة أولاً،
 * ويُدرَج الناقص وحده، ويعود الناقص إلى الواجهة كي يعرف التراجع ما يحذف.
 *
 * والقراءة المسبقة ليست تكلفةً صافية: هي أيضاً تُقلّص الكتابة من «كل
 * الحلقات» إلى «ما ينقص».
 */
export async function markShowWatched(
  tmdbId: number,
): Promise<{ added: { s: number; e: number }[] }> {
  tmdbId = intId(tmdbId);
  const { supabase, user } = await requireUser("bulk", 8, 60_000);
  const { getTv } = await import("@/lib/tmdb");
  const { airedPerSeason } = await import("@/lib/progress");

  const tv = await getTv(tmdbId);
  const per = airedPerSeason(tv);
  const runtime = tv.episode_run_time?.[0] ?? null;
  const now = new Date().toISOString();

  const { data: seen } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .match({ user_id: user.id, show_tmdb_id: tmdbId })
    .limit(20_000);
  const have = new Set(
    (seen ?? []).map((r) => `${r.season_number}-${r.episode_number}`),
  );

  const rows: Record<string, unknown>[] = [];
  const added: { s: number; e: number }[] = [];
  for (const [season, count] of per) {
    for (let ep = 1; ep <= count; ep++) {
      if (have.has(`${season}-${ep}`)) continue;
      rows.push({
        user_id: user.id,
        show_tmdb_id: tmdbId,
        season_number: season,
        episode_number: ep,
        runtime,
        watched_at: now,
      });
      added.push({ s: season, e: ep });
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
  return { added };
}

/**
 * التراجع عن «شاهدتُه كله» — يحذف ما أضافته تلك الضغطة لا أكثر.
 *
 * ولذلك لا يُسمّى «إلغاء المشاهدة»: حذف كل حلقات مسلسلٍ بضغطةٍ واحدة
 * يمحو سجلّاً بناه صاحبه على سنوات، وهذا ليس تراجعاً بل إتلاف. الحذف
 * مُجمَّعٌ بالمواسم — صفٌّ لكل حلقة يعني مئتَي رحلة إلى قاعدة البيانات.
 */
export async function unmarkEpisodes(input: {
  showTmdbId: number;
  episodes: { s: number; e: number }[];
}) {
  const showTmdbId = intId(input.showTmdbId);
  const eps = (input.episodes ?? [])
    .slice(0, 5000)
    .map((x) => ({ s: intIn(x.s, 0, 1000), e: intIn(x.e, 1, 20_000) }));
  if (!eps.length) return;

  const { supabase, user } = await requireUser("ep", 120, 60_000);

  const bySeason = new Map<number, number[]>();
  for (const x of eps) {
    const list = bySeason.get(x.s);
    if (list) list.push(x.e);
    else bySeason.set(x.s, [x.e]);
  }

  for (const [season, numbers] of bySeason) {
    const { error } = await supabase
      .from("watched_episodes")
      .delete()
      .match({ user_id: user.id, show_tmdb_id: showTmdbId, season_number: season })
      .in("episode_number", numbers);
    if (error) fail(error);
  }

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/show/${showTmdbId}`);
}

/**
 * الإبلاغ عن مراجعة.
 *
 * بديلٌ عن «عدم الإعجاب» لا مكمّلٌ له (review_reports.sql): الديسلايك يقع
 * على رأي شخصٍ لا على عمل، والحكم على العمل موجودٌ أدقّ منه — تقييمٌ من
 * ١ إلى ١٠.
 *
 * ولا يعود عدّاداً: الدالّة لا تُرجع كم بلاغاً على المراجعة، ولا تكشف من
 * أبلغ. البلاغ فعلٌ صامتٌ يصل إلى صاحب التطبيق، وعدّادٌ ظاهر يحوّله إلى
 * وسام عار. والإخفاء عند العاشر يجري في مُشغِّل SQL لا هنا — كي يصحّ مهما
 * كان الباب الذي دخل منه البلاغ.
 *
 * وتكرارُه بلا أثر: المفتاح الأساسي يمنع بلاغين من شخصٍ واحد على مراجعة
 * واحدة، فالضغطة الثانية `ignoreDuplicates` لا خطأً في وجه المستخدم.
 */
export async function reportReview(input: {
  reviewUserId: string;
  tmdbId: number;
  mediaType: MediaType;
  reason?: string;
}) {
  const reviewUserId = uuid(input.reviewUserId);
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);

  const { supabase, user } = await requireUser("report", 10, 60_000);
  if (user.id === reviewUserId) return;

  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);

  const { error } = await supabase.from("review_reports").upsert(
    {
      review_user_id: reviewUserId,
      tmdb_id: tmdbId,
      media_type: mediaType,
      reporter_id: user.id,
      reason: reason || null,
    },
    { onConflict: "review_user_id,tmdb_id,media_type,reporter_id", ignoreDuplicates: true },
  );
  if (error) fail(error);
}

// ============================================================
//  الرسائل — مشاركة عملٍ مع صديق، وردٌّ عليه
//
//  الحارس في SQL لا هنا: الإدراج يشترط متابعةً متبادلة (are_mutual)
//  والقراءة لطرفَي الخيط وحدهما (shares.sql). فمنتقي الأشخاص لا يعرض
//  إلا المتابَعين المتبادلين، والقاعدة تردّ ما سواهم.
// ============================================================

/** المتابَعون المتبادلون — من أتابعه ويتابعني — لمنتقي «أرسِله لـ…» */
export async function myMutualFollows(): Promise<PersonLite[]> {
  const { supabase, user } = await requireUser();
  const [out, inc] = await Promise.all([
    supabase.from("user_follows").select("following_id").eq("follower_id", user.id).limit(200),
    supabase.from("user_follows").select("follower_id").eq("following_id", user.id).limit(200),
  ]);
  const following = new Set((out.data ?? []).map((r) => r.following_id));
  const mutual = [
    ...new Set((inc.data ?? []).map((r) => r.follower_id)),
  ].filter((id) => following.has(id));
  if (!mutual.length) return [];
  const { data: people } = await supabase
    .from("public_profiles")
    .select("id, nickname, username, avatar_url, hide_name")
    .in("id", mutual);
  return (people ?? []) as PersonLite[];
}

/** إرسال عملٍ إلى صديق مع سطرٍ اختياري — القاعدة تشترط المتابعة المتبادلة */
export async function sendShare(input: {
  recipientId: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string | null;
  posterPath: string | null;
  note?: string | null;
}) {
  const recipientId = uuid(input.recipientId);
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);
  const title = input.title ? String(input.title).slice(0, 300) : null;
  const posterPath = safeImagePath(input.posterPath);
  const note = (input.note ?? "").replace(/\s+/g, " ").trim().slice(0, 280) || null;

  const { supabase, user } = await requireUser("share", 20, 60_000);
  if (user.id === recipientId) {
    throw new Error("لا يمكنك إرسال عملٍ إلى نفسك / You can't send this to yourself");
  }

  const { error } = await supabase.from("title_shares").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    tmdb_id: tmdbId,
    media_type: mediaType,
    title,
    poster_path: posterPath,
    note,
  });
  if (error) fail(error);
  revalidatePath("/people");
}

/**
 * مشاركة قائمةٍ لصديق — صفٌّ منظَّم لا رابطٌ في نصٍّ حر (D-051/D-066).
 *
 * الاسم والعدّة يُقرآن هنا لا يُستلمان من العميل (روح D-052: الزرّ لا يحمل
 * البيانات)؛ والقاعدة تشترط المتابعة المتبادلة وأن تكون القائمة معلنةً
 * ولي — الخاصّة لا يفتحها المستلم أصلاً فمشاركتها وعدٌ كاذب.
 */
export async function sendListShare(input: {
  recipientId: string;
  listId: string;
  note?: string | null;
}) {
  const recipientId = uuid(input.recipientId);
  const listId = uuid(input.listId);
  const note = (input.note ?? "").replace(/\s+/g, " ").trim().slice(0, 280) || null;

  const { supabase, user } = await requireUser("share", 20, 60_000);
  if (user.id === recipientId) {
    throw new Error("لا يمكنك إرسال القائمة إلى نفسك / You can't send this to yourself");
  }

  const [{ data: list }, { count }] = await Promise.all([
    supabase
      .from("user_lists")
      .select("id, name, is_public")
      .match({ id: listId, user_id: user.id })
      .maybeSingle(),
    supabase
      .from("user_list_items")
      .select("*", { count: "exact", head: true })
      .eq("list_id", listId),
  ]);
  if (!list) throw new Error("القائمة غير موجودة / List not found");
  if (!list.is_public) {
    throw new Error("اجعل القائمة معلنةً أولاً / Make the list public first");
  }

  const { error } = await supabase.from("list_shares").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    list_id: listId,
    list_name: String(list.name ?? "").slice(0, 300) || null,
    item_count: count ?? null,
    note,
  });
  if (error) fail(error);
  revalidatePath("/people");
}

/** متابِعيّ — لمنتقي «من يرى مكتبتي» (D-070): من يتابعني، لا من أتابعه */

/**
 * أسماء متابعة شخصٍ ما — لورقتَي «متابِعون/متابَعون» في ملفه العام
 * (دفعة أحمد الثالثة). الصفوف عالمية القراءة (D-013) والأسماء من
 * public_profiles (إخفاء الاسم مقطوعٌ في العرض نفسه — D-011)؛ والقفل
 * (هجرة 43) يُفرغ الجواب لغير صاحب الحساب.
 */
export async function peopleFollowsOf(
  targetId: string,
  dir: "followers" | "following",
): Promise<PersonLite[]> {
  const { supabase, user } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) return [];

  if (user.id !== targetId) {
    try {
      const { data: prof } = await supabase
        .from("public_profiles")
        .select("hide_follow_lists")
        .eq("id", targetId)
        .maybeSingle();
      if ((prof as { hide_follow_lists?: boolean } | null)?.hide_follow_lists) return [];
    } catch {
      /* قبل تشغيل الهجرة 43 العمود غائب — الافتراض مفتوح كما كان دائماً */
    }
  }

  const edge = dir === "followers" ? "follower_id" : "following_id";
  const where = dir === "followers" ? "following_id" : "follower_id";
  const { data } = await supabase
    .from("user_follows")
    .select(edge)
    .eq(where, targetId)
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = [...new Set((data ?? []).map((r) => (r as Record<string, string>)[edge]))];
  if (!ids.length) return [];
  const { data: people } = await supabase
    .from("public_profiles")
    .select("id, nickname, username, avatar_url, hide_name")
    .in("id", ids);
  return ((people ?? []) as PersonLite[]);
}

export async function myFollowersList(): Promise<PersonLite[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("user_follows")
    .select("follower_id")
    .eq("following_id", user.id)
    .limit(200);
  const ids = [...new Set((data ?? []).map((r) => r.follower_id))];
  if (!ids.length) return [];
  const { data: people } = await supabase
    .from("public_profiles")
    .select("id, nickname, username, avatar_url, hide_name")
    .in("id", ids);
  return (people ?? []) as PersonLite[];
}

/** من أتابعهم — لورقة دعوة المجتمع (هجرة 42): «أضيف من اللي متابعهم» */
export async function myFollowingList(): Promise<PersonLite[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id)
    .limit(200);
  const ids = [...new Set((data ?? []).map((r) => r.following_id))];
  if (!ids.length) return [];
  const { data: people } = await supabase
    .from("public_profiles")
    .select("id, nickname, username, avatar_url, hide_name")
    .in("id", ids);
  return (people ?? []) as PersonLite[];
}

/* ===== دعوات المجتمعات (هجرة 42) ===== */

/** المالك يدعو شخصاً — سياسة الإدراج تتحقق من الملكية في SQL */
export async function inviteToCommunity(communityId: string, userId: string) {
  communityId = uuid(communityId);
  userId = uuid(userId);
  const { supabase, user } = await requireUser("community", 20, 60_000);
  if (userId === user.id) throw new Error("لا تدعُ نفسك");
  const { error } = await supabase
    .from("community_invites")
    .upsert({ community_id: communityId, user_id: userId });
  if (error) fail(error);
}

/** المالك يلغي دعوةً معلّقة */
export async function cancelCommunityInvite(communityId: string, userId: string) {
  communityId = uuid(communityId);
  userId = uuid(userId);
  const { supabase } = await requireUser("community", 20, 60_000);
  const { error } = await supabase
    .from("community_invites")
    .delete()
    .match({ community_id: communityId, user_id: userId });
  if (error) fail(error);
}

/** المدعوّ يقبل — الـRPC يتحقق من الدعوة ثم يُدخِله ويحذفها */
export async function acceptCommunityInvite(communityId: string) {
  communityId = uuid(communityId);
  const { supabase } = await requireUser("community", 20, 60_000);
  const { error } = await supabase.rpc("accept_community_invite", {
    p_community: communityId,
  });
  if (error) fail(error);
  revalidatePath("/people");
}

/** المدعوّ يرفض — يحذف صفّ دعوته */
export async function rejectCommunityInvite(communityId: string) {
  communityId = uuid(communityId);
  const { supabase, user } = await requireUser("community", 20, 60_000);
  const { error } = await supabase
    .from("community_invites")
    .delete()
    .match({ community_id: communityId, user_id: user.id });
  if (error) fail(error);
  revalidatePath("/people");
}

/** من منحتُهم رؤية مكتبتي — لقسم الإعدادات (D-070) */
export async function myLibraryGrants(): Promise<PersonLite[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("library_grants")
    .select("grantee_id, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = (data ?? []).map((r) => r.grantee_id);
  if (!ids.length) return [];
  const { data: people } = await supabase
    .from("public_profiles")
    .select("id, nickname, username, avatar_url, hide_name")
    .in("id", ids);
  const rank = new Map(ids.map((id, i) => [id, i]));
  return ((people ?? []) as PersonLite[]).sort(
    (a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9),
  );
}

/**
 * منحُ رؤية مكتبتي لشخصٍ أو سحبُها (D-070) — تُطوى في can_view_profile
 * فتفتح دوال الملف الخمس نفسها بلا بابٍ جديد (library_grants.sql).
 */
export async function setLibraryGrant(granteeId: string, grant: boolean) {
  granteeId = uuid(granteeId);
  const { supabase, user } = await requireUser("share", 30, 60_000);
  if (granteeId === user.id) {
    throw new Error("مكتبتك مرئيةٌ لك دائماً / Your library is always visible to you");
  }
  if (grant) {
    const { error } = await supabase
      .from("library_grants")
      .upsert({ owner_id: user.id, grantee_id: granteeId }, { onConflict: "owner_id,grantee_id" });
    if (error) fail(error);
  } else {
    const { error } = await supabase
      .from("library_grants")
      .delete()
      .match({ owner_id: user.id, grantee_id: granteeId });
    if (error) fail(error);
  }
}

/**
 * حفظ قائمة غيرك أو إلغاء حفظها — مرجعٌ حيّ لا نسخة (D-068).
 * الحارس في SQL: القائمة معلنةٌ وليست لي (list_saves.sql).
 */
export async function saveList(listId: string, save: boolean) {
  listId = uuid(listId);
  const { supabase, user } = await requireUser("share", 30, 60_000);
  if (save) {
    const { error } = await supabase
      .from("list_saves")
      .upsert({ user_id: user.id, list_id: listId }, { onConflict: "user_id,list_id" });
    if (error) fail(error);
  } else {
    const { error } = await supabase
      .from("list_saves")
      .delete()
      .match({ user_id: user.id, list_id: listId });
    if (error) fail(error);
  }
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
}

/** مجتمعاتي — غلاف فعلٍ لورقة «انشرها في مجتمعي» (rpc القائمة نفسها) */
export async function myCommunitiesList(): Promise<CommunityLite[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("my_communities");
  if (error) fail(error);
  return ((data ?? []) as CommunityLite[]).map((c) => ({
    ...c,
    member_count: Number(c.member_count),
  }));
}

/** ردٌّ قصير على خيط مشاركة — القاعدة تشترط بقاء المتابعة المتبادلة */
export async function replyToShare(shareId: string, body: string) {
  shareId = uuid(shareId);
  const clean = String(body ?? "").trim();
  if (clean.length < 1 || clean.length > 500) {
    throw new Error("مدخل غير صالح / Invalid input");
  }
  const { supabase, user } = await requireUser("share", 30, 60_000);
  const { error } = await supabase.from("share_replies").insert({
    share_id: shareId,
    author_id: user.id,
    body: clean,
  });
  if (error) fail(error);
  revalidatePath("/people");
}

/** تعليم كل الوارد مقروءاً — يُستدعى عند فتح تبويب الرسائل لا لكل صفّ */
export async function markSharesRead() {
  const { supabase, user } = await requireUser("share", 30, 60_000);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("title_shares")
    .update({ read_at: now })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  // مشاركات القوائم جزءٌ من الوارد نفسه — تُقرأ معه (D-066)
  await supabase
    .from("list_shares")
    .update({ read_at: now })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) fail(error);
  revalidatePath("/people");
}

/**
 * إخفاء خيطٍ من جهتي وحدها — لا حذف للصفّ.
 *
 * الطرف الآخر يبقى خيطه كما هو (shares.sql): حذف الصفّ كان سيمحو نصف
 * محادثةٍ لا أملكها وحدي. تحديثان يطابق أحدهما جهتي فقط.
 */
export async function hideShare(shareId: string) {
  shareId = uuid(shareId);
  const { supabase, user } = await requireUser("share", 30, 60_000);
  await supabase
    .from("title_shares")
    .update({ sender_hid: true })
    .match({ id: shareId, sender_id: user.id });
  await supabase
    .from("title_shares")
    .update({ recipient_hid: true })
    .match({ id: shareId, recipient_id: user.id });
  revalidatePath("/people");
}

/** تعليم كل الوارد من شخصٍ بعينه مقروءاً — عند فتح محادثته */
export async function markConversationRead(personId: string) {
  personId = uuid(personId);
  const { supabase, user } = await requireUser("share", 30, 60_000);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("title_shares")
    .update({ read_at: now })
    .eq("recipient_id", user.id)
    .eq("sender_id", personId)
    .is("read_at", null);
  // وقوائم الشخص نفسه — الخيط واحد (D-066)
  await supabase
    .from("list_shares")
    .update({ read_at: now })
    .eq("recipient_id", user.id)
    .eq("sender_id", personId)
    .is("read_at", null);
  if (error) fail(error);
  revalidatePath("/people");
}

/** إخفاء محادثةٍ كاملة من جهتي — كل مشاركاتها، والطرف الآخر يحتفظ بنسخته */
export async function hideConversation(personId: string) {
  personId = uuid(personId);
  const { supabase, user } = await requireUser("share", 30, 60_000);
  await supabase
    .from("title_shares")
    .update({ sender_hid: true })
    .match({ sender_id: user.id, recipient_id: personId });
  await supabase
    .from("title_shares")
    .update({ recipient_hid: true })
    .match({ recipient_id: user.id, sender_id: personId });
  // ومشاركات القوائم في الخيط نفسه — تُخفى معه من جهتي وحدها (D-066)
  await supabase
    .from("list_shares")
    .update({ sender_hid: true })
    .match({ sender_id: user.id, recipient_id: personId });
  await supabase
    .from("list_shares")
    .update({ recipient_hid: true })
    .match({ recipient_id: user.id, sender_id: personId });
  revalidatePath("/people");
}

/**
 * البطاقة الحمراء: إيقاف عملٍ اكتفيتَ منه.
 *
 * لا يُحذف ولا يُعلَّم مشاهداً — يبقى في المكتبة بشريطٍ أحمر ويختفي من
 * صفوف الرئيسية. علامةٌ على صفّ المتابعة نفسه لا جدول جديد.
 */
export async function setDropped(tmdbId: number, mediaType: MediaType, dropped: boolean) {
  tmdbId = intId(tmdbId);
  mediaType = asMediaType(mediaType);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("follows")
    .update({ dropped: !!dropped })
    .match({ user_id: user.id, tmdb_id: tmdbId, media_type: mediaType });
  if (error) fail(error);
  revalidatePath("/");
  revalidatePath("/library");
}

/**
 * «أوقف المتابعة» من قائمة «المزيد» في صفحة العمل — نفس فعل البطاقة الحمراء.
 *
 * الإيقاف علامةٌ على صفّ المتابعة، فإن لم يكن العمل في المكتبة أُضيف أوّلاً
 * ثم أُوقف (`upsert` بعلامة الإيقاف) كي تُوقفه من صفحته مباشرةً بلا خطوة
 * إضافة. والاستئناف يرفع العلامة ويُبقيه في المكتبة.
 */
/**
 * «غير مهتم» — العمل لا يعود يظهر في «مقترح لك» (dismissed_titles.sql).
 *
 * upsert لا insert: الضغط مرّتين (أو من جهازين) لا يرفع خطأ تكرار.
 * والتراجع حذفٌ بسيط — صفوفك تحرسها سياسة `own dismissed`.
 */
export async function dismissTitle(input: { tmdbId: number; mediaType: MediaType }) {
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);
  const { supabase, user } = await requireUser("dismiss", 30, 60_000);
  const { error } = await supabase
    .from("dismissed_titles")
    .upsert(
      { user_id: user.id, tmdb_id: tmdbId, media_type: mediaType },
      { onConflict: "user_id,tmdb_id,media_type" },
    );
  if (error) fail(error);
  revalidatePath("/news");
}

export async function undoDismissTitle(input: { tmdbId: number; mediaType: MediaType }) {
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);
  const { supabase, user } = await requireUser("dismiss", 30, 60_000);
  const { error } = await supabase
    .from("dismissed_titles")
    .delete()
    .match({ user_id: user.id, tmdb_id: tmdbId, media_type: mediaType });
  if (error) fail(error);
  revalidatePath("/news");
}

export async function stopWatching(input: {
  tmdbId: number;
  mediaType: MediaType;
  stop: boolean;
  title?: string | null;
  posterPath?: string | null;
}) {
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);
  const { supabase, user } = await requireUser();

  if (input.stop) {
    const { error } = await supabase.from("follows").upsert(
      {
        user_id: user.id,
        tmdb_id: tmdbId,
        media_type: mediaType,
        title: String(input.title ?? "").slice(0, 300),
        poster_path: safeImagePath(input.posterPath ?? null),
        dropped: true,
      },
      { onConflict: "user_id,tmdb_id,media_type" },
    );
    if (error) fail(error);
  } else {
    const { error } = await supabase
      .from("follows")
      .update({ dropped: false })
      .match({ user_id: user.id, tmdb_id: tmdbId, media_type: mediaType });
    if (error) fail(error);
  }
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`);
}

/**
 * 🔁 إعادة المشاهدة: دورةٌ جديدة تُختم بلحظة بدئها.
 *
 * لا صفَّ يُحذف — اليوميات مقدّسة. التقدّم فقط يُحسب من هذه اللحظة
 * فصاعداً، فيرجع المسلسل إلى «أكمل المشاهدة» من الصفر بشارة ×٢.
 */
export async function startRewatch(tmdbId: number) {
  tmdbId = intId(tmdbId);
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
  tmdbId = intId(tmdbId);
  const { supabase, user } = await requireUser("next", 20, 60_000);
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

// ============================================================
//  الخصوصية: بياناتك ملكك — تصديرها وحذفها
// ============================================================

/**
 * تصدير كل بيانات الحساب ملفَّ JSON واحداً.
 *
 * كل جدولٍ يخصّ المستخدم يُقرأ بصفوفه (تحت سياسات RLS نفسها) ويُعاد
 * نصاً — الواجهة تنزّله ملفاً. لا يمرّ شيء بخادمٍ ثالث.
 */
export async function exportMyData(): Promise<string> {
  const { supabase, user } = await requireUser("export", 3, 60_000);

  const [profile, follows, eps, movies, ratings, myLists, progress, reactions, likes, uFollows] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("follows").select("*").eq("user_id", user.id),
      supabase.from("watched_episodes").select("*").eq("user_id", user.id).limit(50_000),
      supabase.from("watched_movies").select("*").eq("user_id", user.id),
      supabase.from("ratings").select("*").eq("user_id", user.id),
      supabase.from("user_lists").select("*").eq("user_id", user.id),
      supabase.from("movie_progress").select("*").eq("user_id", user.id),
      supabase.from("post_reactions").select("*").eq("user_id", user.id),
      supabase.from("review_likes").select("*").eq("liker_id", user.id),
      supabase.from("user_follows").select("*").or(`follower_id.eq.${user.id},following_id.eq.${user.id}`),
    ]);

  const listIds = (myLists.data ?? []).map((l: { id: string }) => l.id);
  const items = listIds.length
    ? await supabase.from("user_list_items").select("*").in("list_id", listIds)
    : { data: [] };

  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      email: user.email ?? null,
      profile: profile.data ?? null,
      follows: follows.data ?? [],
      watched_episodes: eps.data ?? [],
      watched_movies: movies.data ?? [],
      ratings: ratings.data ?? [],
      lists: myLists.data ?? [],
      list_items: items.data ?? [],
      movie_progress: progress.data ?? [],
      reactions: reactions.data ?? [],
      review_likes_given: likes.data ?? [],
      user_follows: uFollows.data ?? [],
    },
    null,
    2,
  );
}

/**
 * حذف الحساب: كل الصفوف والصور تُمحى في نداءٍ واحد على دالة SQL
 * definer (انظر supabase/security.sql) ثم تُنهى الجلسة.
 */
export async function deleteMyAccount(): Promise<void> {
  const { supabase } = await requireUser("delete", 3, 60_000);
  const { error } = await supabase.rpc("delete_my_account");
  if (error) fail(error);
  await supabase.auth.signOut();
}

// ============================================================
//  الاستيراد من الخدمات الأخرى (TV Time · Trakt)
// ============================================================

/**
 * مطابقة دفعةٍ من الأعمال بمعرّفات TMDB.
 *
 * لماذا على الخادم: مفتاح TMDB لا يغادره (قاعدةٌ ثابتة في المشروع)،
 * والمتصفّح يرسل الأسماء والمعرّفات الخارجية وحدها — ملفُّ التصدير نفسه
 * لا يُرفع إلى أي خادم، يُقرأ في جهاز صاحبه ويبقى فيه.
 *
 * الدفعة أربعون طلباً بحدٍّ أقصى، وتُنفَّذ عشرةً عشرة: مكتبةٌ فيها أربعمئة
 * مسلسل تعني أربعمئة طلبٍ خارجي، ولو انطلقت كلها معاً لخنقت حصّة TMDB
 * وعادت بأخطاء ٤٢٩ بدل نتائج.
 */
export async function resolveImportItems(
  requests: ResolveRequest[],
): Promise<ResolveResult[]> {
  await requireUser("import-resolve", 90, 60_000);
  const list = (requests ?? []).slice(0, 40);
  const { findByExternalId, searchByName, titleOf } = await import("@/lib/tmdb");

  const one = async (req: ResolveRequest): Promise<ResolveResult> => {
    try {
      if (req.kind === "tvdb-tv") {
        const found = await findByExternalId(String(intId(req.id)), "tvdb_id");
        const tv = found?.tv_results?.[0];
        if (!tv) return null;
        return {
          tmdbId: tv.id,
          mediaType: "tv",
          title: titleOf(tv),
          posterPath: safeImagePath(tv.poster_path),
        };
      }

      if (req.kind === "tvdb-episode") {
        // معرّف حلقةٍ في TVDB يعطينا المسلسل ورقم الموسم والحلقة معاً —
        // وهذا كل ما يلزم صفَّ المشاهدة، بلا بحثٍ بالاسم أصلاً
        const found = await findByExternalId(String(intId(req.id)), "tvdb_id");
        const ep = found?.tv_episode_results?.[0];
        if (!ep) return null;
        return {
          tmdbId: ep.show_id,
          mediaType: "tv",
          title: ep.name ?? "",
          posterPath: null,
          season: ep.season_number,
          episode: ep.episode_number,
        };
      }

      if (req.kind === "imdb") {
        const found = await findByExternalId(String(req.id).slice(0, 20), "imdb_id");
        const hit =
          req.media === "tv" ? found?.tv_results?.[0] : found?.movie_results?.[0];
        if (!hit) return null;
        return {
          tmdbId: hit.id,
          mediaType: req.media,
          title: titleOf(hit),
          posterPath: safeImagePath(hit.poster_path),
        };
      }

      const media = req.kind === "name-tv" ? "tv" : "movie";
      const hit = await searchByName(String(req.name ?? "").slice(0, 200), media, req.year);
      if (!hit) return null;
      return {
        tmdbId: hit.id,
        mediaType: media,
        title: titleOf(hit),
        posterPath: safeImagePath(hit.poster_path),
      };
    } catch {
      return null;
    }
  };

  const out: ResolveResult[] = [];
  for (let i = 0; i < list.length; i += 10) {
    out.push(...(await Promise.all(list.slice(i, i + 10).map(one))));
  }
  return out;
}

/**
 * كتابة دفعةٍ مستوردة في المكتبة.
 *
 * الدفعة صغيرة عمداً (خمسة أعمال) والعميل يكرّرها: الاستيراد قد يحمل
 * عشرين ألف حلقة، وطلبٌ واحد بهذا الحجم يتجاوز حدّ جسم Server Action
 * وينهار في منتصفه بلا أثر. بالدفعات يتقدّم شريط الحالة، وما نجح قبل
 * الانقطاع يبقى مكتوباً.
 *
 * وكلّ كتابةٍ `upsert` لا `insert`: من استورد مرّتين — أو استورد ثم
 * استوردت خدمةٌ أخرى نفس العمل — لا يُنشئ صفوفاً مكرّرة ولا يفقد ما
 * أشّره بيده. والتاريخ الأصلي يُكتب في `watched_at` فتُقرأ يوميّاته
 * كما عاشها لا كما استوردها.
 */
export async function applyImportChunk(payload: ImportPayload): Promise<{
  shows: number;
  episodes: number;
  movies: number;
}> {
  const { supabase, user } = await requireUser("import-apply", 90, 60_000);

  /* ختمٌ واحد لكل دفعة يحلّ محلّ التاريخ الغائب — لسببين: PostgREST يرفض
     مصفوفةً تختلف مفاتيح كائناتها (بعضها بتاريخٍ وبعضها بلا)، فالمفتاح
     يجب أن يُكتب دائماً؛ وحلقاتٌ بلا تاريخٍ تتناثر في اليوميات لو أخذت
     كلٌّ منها لحظتها. */
  const stamp = new Date().toISOString();

  const shows = (payload?.shows ?? []).slice(0, 5);
  const movies = (payload?.movies ?? []).slice(0, 60);
  let epCount = 0;

  for (const sh of shows) {
    const tmdbId = intId(sh.tmdbId);
    const title = String(sh.title ?? "").slice(0, 300);

    await supabase.from("follows").upsert(
      {
        user_id: user.id,
        tmdb_id: tmdbId,
        media_type: "tv",
        title,
        poster_path: safeImagePath(sh.posterPath),
      },
      { onConflict: "user_id,tmdb_id,media_type" },
    );

    const rows = (sh.episodes ?? [])
      .slice(0, IMPORT_CAPS.episodesPerShow)
      .map((ep) => ({
        user_id: user.id,
        show_tmdb_id: tmdbId,
        season_number: intIn(ep.s, 0, 100),
        episode_number: intIn(ep.e, 0, 20_000),
        runtime: null as number | null,
        watched_at: ep.at ?? stamp,
      }));

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from("watched_episodes")
        .upsert(rows.slice(i, i + 500), {
          onConflict: "user_id,show_tmdb_id,season_number,episode_number",
        });
      if (!error) epCount += rows.slice(i, i + 500).length;
    }

    if (sh.rating != null) {
      await supabase.from("ratings").upsert(
        {
          user_id: user.id,
          tmdb_id: tmdbId,
          media_type: "tv",
          rating: intIn(Math.round(sh.rating), 1, 10),
          review: null,
          title,
          poster_path: safeImagePath(sh.posterPath),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tmdb_id,media_type" },
      );
    }
  }

  for (const mv of movies) {
    const tmdbId = intId(mv.tmdbId);
    const title = String(mv.title ?? "").slice(0, 300);
    const poster = safeImagePath(mv.posterPath);

    await supabase.from("follows").upsert(
      { user_id: user.id, tmdb_id: tmdbId, media_type: "movie", title, poster_path: poster },
      { onConflict: "user_id,tmdb_id,media_type" },
    );

    if (mv.watched) {
      await supabase.from("watched_movies").upsert(
        {
          user_id: user.id,
          movie_tmdb_id: tmdbId,
          runtime: null,
          watched_at: mv.at ?? stamp,
        },
        { onConflict: "user_id,movie_tmdb_id" },
      );
    }

    if (mv.rating != null) {
      await supabase.from("ratings").upsert(
        {
          user_id: user.id,
          tmdb_id: tmdbId,
          media_type: "movie",
          rating: intIn(Math.round(mv.rating), 1, 10),
          review: null,
          title,
          poster_path: poster,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tmdb_id,media_type" },
      );
    }
  }

  return { shows: shows.length, episodes: epCount, movies: movies.length };
}

/** يُستدعى مرّة عند نهاية الاستيراد — لا مع كل دفعة */
export async function finishImport() {
  await requireUser("import-apply", 90, 60_000);
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/stats");
  revalidatePath("/diary");
}

/* ============================== بحث الذكاء ============================== */

export interface AiSearchResult {
  kind: "movie" | "tv";
  id: number;
  title: string;
  year?: string;
  poster: string | null;
  rating?: number | null;
  /** لماذا رُشِّح — سطرٌ من النموذج، أو وصفُ المسار البديل */
  reason?: string;
}

/**
 * بحث الذكاء: وصفٌ حرّ → مرشّحون من Gemini → **تثبيتٌ عبر TMDB** (D-076).
 *
 * النموذج يقترح أسماءً والحقيقة عند TMDB: كل مرشّحٍ يمرّ على `searchByName`
 * (نفس دالّة الاستيراد — بالاسم والسنة والجهة)، وما لا يثبت يسقط بصمت.
 * فالنتيجة المعروضة دائماً عملٌ حقيقي بملصقه ورابطه، بعنوانه بلغة
 * الواجهة (D-072 — searchByName يطلب بلغة `getLocale`).
 *
 * الدلو ضيّق (٦ في الدقيقة): كل نداءٍ يكلّف طلب نموذجٍ وعشرة طلبات TMDB.
 * و`ok: false` بأسبابٍ مميّزة بدل الرمي: غياب المفتاح حالةُ منتجٍ تُشرح
 * («غير مفعّل») لا خطأُ برمجةٍ يُلوّح بأحمر.
 */
export async function aiStorySearch(
  description: string,
): Promise<
  | { ok: true; results: AiSearchResult[]; fallback?: boolean }
  | { ok: false; reason: "empty" | "short" }
> {
  await requireUser("aisearch", 6, 60_000);

  const desc = String(description ?? "").trim().slice(0, 600);
  if (desc.length < 8) return { ok: false, reason: "short" };

  const [{ aiSuggestTitles }, { getLocale }] = await Promise.all([
    import("@/lib/ai"),
    import("@/lib/locale"),
  ]);
  const locale = await getLocale();
  const loc = locale === "en" ? ("en" as const) : ("ar" as const);

  /* ===== الذوق يُمرَّر للنموذج (إصلاح 9 Aug) =====
     الاقتراح بلا معرفةٍ بصاحبه جوابٌ لأي أحد. أعلى ما قيّمه، وأنواعه
     المفضّلة، وما في مكتبته (لاستبعاده) — ثلاثتها تُقرأ مرةً هنا.
     وفشلُ أيٍّ منها لا يمنع البحث: الذوق يرفع الدقة ولا يشترطها. */
  const { getMyRatings, getProfile, getFollows } = await import("@/lib/data");
  const [ratings, profile, follows] = await Promise.all([
    getMyRatings().catch(() => []),
    getProfile().catch(() => null),
    getFollows().catch(() => []),
  ]);
  const loved = [...ratings]
    .filter((r) => r.rating >= 8 && r.title)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 12)
    .map((r) => r.title as string);
  const { GENRES, genreName } = await import("@/lib/media");
  const genres = (profile?.favorite_genres ?? [])
    .map((id: number) => GENRES.find((g) => g.id === id))
    .filter(Boolean)
    .slice(0, 6)
    .map((g) => genreName(g!, loc));
  const exclude = follows.map((f) => f.title).filter(Boolean).slice(0, 40) as string[];

  const candidates = await aiSuggestTitles(desc, { loved, genres, exclude, locale: loc });

  const { searchByName, searchMulti, keywordDiscover, topByFilter, titleOf, yearOf, posterUrl } =
    await import("@/lib/tmdb");

  const seen = new Set<string>();
  const results: AiSearchResult[] = [];
  const push = (r: import("@/lib/tmdb").SearchResult, reason?: string) => {
    const kind = r.media_type === "tv" ? ("tv" as const) : ("movie" as const);
    const key = `${kind}-${r.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      kind,
      id: r.id,
      title: titleOf(r),
      year: yearOf(r) || undefined,
      poster: posterUrl(r.poster_path, "w185"),
      rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
      reason,
    });
  };

  if (candidates && candidates.length) {
    const grounded = await Promise.all(
      candidates.map((c) =>
        searchByName(c.title, c.type, c.year)
          .then((r) => (r ? { row: r, reason: c.reason } : null))
          .catch(() => null),
      ),
    );
    for (const g of grounded) if (g) push(g.row, g.reason);
    if (results.length) return { ok: true, results };
  }

  /* ===== المسار البديل — بلا نموذج (إصلاح 9 Aug) =====
     غياب مفتاح Gemini كان يردّ «غير مفعّل» فيبدو الذكاء معطوباً. الآن
     يجيب بما يملكه التطبيق فعلاً: نيّةُ النص (نوع درامي + حقبة) أولاً،
     ثم كلمات TMDB المفتاحية، ثم مطابقةُ الاسم. أضعف من النموذج وأصدق
     من رسالة عطل. */
  const { matchBrowseIntent } = await import("@/lib/intent");
  const { BROWSE_GENRES, eraRange, BROWSE_ERAS } = await import("@/lib/browse");
  const intent = matchBrowseIntent(desc, loc);
  const wantsShows = /مسلسل|أنمي|انمي|series|shows?|anime/i.test(desc);
  const media = wantsShows ? ("tv" as const) : ("movie" as const);

  if (intent) {
    const url = new URLSearchParams(intent.href.split("?")[1] ?? "");
    const g = BROWSE_GENRES.find((x) => x.slug === url.get("g"));
    const era = BROWSE_ERAS.find((x) => x.slug === url.get("era")) ?? null;
    const { from, to } = eraRange(era);
    const rows = await topByFilter(
      media,
      { genreIds: media === "tv" ? g?.tv : g?.movie, from, to },
      12,
      "vote_average.desc",
    ).catch(() => []);
    for (const r of rows) push(r, intent.label);
  }

  if (results.length < 6) {
    const words = desc.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((w) => w.length > 2);
    const rows = await keywordDiscover(words, media).catch(() => []);
    for (const r of rows) push(r);
  }

  if (results.length === 0) {
    const rows = await searchMulti(desc.slice(0, 80)).catch(() => []);
    for (const r of rows.slice(0, 10)) push(r);
  }

  if (results.length === 0) return { ok: false, reason: "empty" };
  return { ok: true, results: results.slice(0, 12), fallback: true };
}

// ============================================================
//  أغلفة وبوسترات شخصية (title_art.sql، D-131)
// ============================================================

/**
 * بوّابة الميزة (ق٩) — نقطةٌ واحدة، ترجع `true` اليوم.
 *
 * البريف يذكر تمييزاً مدفوعاً مؤجَّلاً. المنفذ الواحد مقصود: تقييدُه
 * لاحقاً تغييرُ جسمِ هذه الدالّة، لا تعقّبُ شرطٍ منثورٍ في عشرة ملفات.
 * (وقبل أيّ تسييل: شروط TMDB تشترط ترخيصاً تجارياً حين يكون توليد
 * الإيراد غرضاً أساسياً — والميزة مبنيةٌ حرفياً على صورهم.)
 */
export async function canUseArt(): Promise<boolean> {
  return true;
}

/**
 * صور العمل للمنتقي — مسارات نصّية فقط، مرتَّبةً بلغة المستخدم (ق٧).
 *
 * سقفٌ معلَن: ٢٤ ملصقاً و١٢ خلفية. TMDB يعطي أربعين أحياناً، وأربعون
 * صورةً في ورقةٍ واحدة تقتل شبكة الجوال — والشبكة كسولة التحميل فوق ذلك.
 */
export async function titleArtOptions(tmdbId: number, mediaType: "tv" | "movie") {
  const id = intId(tmdbId);
  const type = asMediaType(mediaType);
  await requireUser("art", 30, 60_000);
  if (!(await canUseArt())) return { posters: [], backdrops: [] };

  const [{ titleImages }, { getLocale }] = await Promise.all([
    import("@/lib/tmdb"),
    import("@/lib/locale"),
  ]);
  const locale = await getLocale();
  const { posters, backdrops } = await titleImages(type, id, locale === "en" ? "en" : "ar");
  return {
    posters: posters.map((p) => p.file_path).filter(Boolean).slice(0, 24),
    backdrops: backdrops.map((p) => p.file_path).filter(Boolean).slice(0, 12),
  };
}

/**
 * تثبيت الاختيار. `null` لحقلٍ = «أعِده للأصل»، والصفّ يُحذف حين يخلو
 * الاثنان معاً — صفٌّ بلا اختيارٍ يخالف قيد القاعدة ولا معنى له.
 */
export async function setTitleArt(input: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  posterPath: string | null;
  backdropPath: string | null;
}) {
  const id = intId(input.tmdbId);
  const type = asMediaType(input.mediaType);
  const poster = safeImagePath(input.posterPath);
  const backdrop = safeImagePath(input.backdropPath);
  const { supabase, user } = await requireUser("art", 30, 60_000);
  if (!(await canUseArt())) return;

  if (!poster && !backdrop) {
    const { error } = await supabase
      .from("title_art")
      .delete()
      .match({ user_id: user.id, tmdb_id: id, media_type: type });
    if (error) fail(error);
  } else {
    const { error } = await supabase.from("title_art").upsert({
      user_id: user.id,
      tmdb_id: id,
      media_type: type,
      poster_path: poster,
      backdrop_path: backdrop,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      if ((error as { code?: string }).code === "42P01") {
        throw new Error("الأغلفة الشخصية غير مفعّلة بعد / Custom art is not enabled yet");
      }
      fail(error);
    }
  }
  revalidatePath("/library");
  revalidatePath(`/${type === "tv" ? "show" : "movie"}/${id}`);
}

// ============================================================
//  المفضّلات (favorites.sql، D-130)
// ============================================================

/**
 * قلبُ عملٍ في «مفضّلاتي» — تُرجع الحالة **بعد** الفعل.
 *
 * لا جدول جديد: القائمة صفٌّ في `user_lists` بعلامة `kind='favorites'`،
 * فترث المشاركة والحفظ والترتيب والسحب من محرّك القوائم مجاناً (ب٣).
 * والاسم يُمرَّر بلغة الواجهة لأن القائمة تُولد عند أوّل قلب، ومن يقلب
 * بالعربية لا يريد قائمةً اسمها «Favorites».
 */
export async function toggleFavorite(input: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  listName: string;
}): Promise<boolean> {
  const id = intId(input.tmdbId);
  const type = asMediaType(input.mediaType);
  const { supabase } = await requireUser("fav", 30, 60_000);
  const { data, error } = await supabase.rpc("toggle_favorite", {
    p_tmdb: id,
    p_type: type,
    p_title: String(input.title ?? "").slice(0, 200),
    p_poster: safeImagePath(input.posterPath),
    p_list_name: String(input.listName ?? "").slice(0, 60),
  });
  if (error) {
    if ((error as { code?: string }).code === "42883") {
      throw new Error("المفضّلات غير مفعّلة بعد / Favorites are not enabled yet");
    }
    fail(error);
  }
  revalidatePath("/lists");
  revalidatePath(`/${type === "tv" ? "show" : "movie"}/${id}`);
  return !!data;
}

// ============================================================
//  الردودُ على الآراء (review_replies.sql — هجرة ٦٢، D-193)
//
//  **ولماذا فعلٌ ثالث لا توسيعُ `saveRating`:** الرأيُ صفٌّ واحدٌ لكل
//  شخصٍ لكل عمل (`user_id, tmdb_id, media_type`) — لا يتشعّب. فالردُّ
//  كتابةٌ في جدولٍ آخر، والحراسةُ كلُّها في القاعدة: سياسةٌ تمنع الكتابة
//  باسم غيرك، ومُشغِّلٌ يمنع العمقَ الثالث، وقيدُ طولٍ على النصّ.
//
//  والتجديدُ يُصيب صفحتين لا التطبيق: صفحةَ التعليقات وصفحةَ العمل —
//  فالردُّ يُقرأ من هذين البابين وحدهما.
// ============================================================

/** المسارُ المشترك للردّ: صفحةُ التعليقات ثم صفحةُ العمل نفسها */
function talkPaths(tmdbId: number, mediaType: "tv" | "movie") {
  return [
    `/talk/${mediaType}/${tmdbId}`,
    `/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`,
  ];
}

/**
 * ردٌّ على رأي — أو ردٌّ على ردّ (`parentId`).
 *
 * **و«تعليقٌ على العمل» ليس فعلاً رابعاً:** طلب أحمد «أقدر أردّ على نفس
 * الشخص **أو** أعلّق على الفيلم» — والثاني هو التقييمُ نفسه
 * (`saveRating`)، فمن لم يشاهد العمل يقيّمه ثم يتكلّم. وهذا يمنع أن
 * يصير للعمل خطّان: آراءٌ ولا تقييم، وتقييماتٌ بلا رأي.
 *
 * `parentId` لا يُتحقَّق منه هنا: المُشغِّل في القاعدة يرفض ردّاً على
 * ردٍّ على ردّ، **ويرفض أباً في عملٍ آخر** — والفحصُ هناك يصحّ لأي
 * مستدعٍ لا لهذا وحده.
 */
export async function addReviewReply(input: {
  reviewUserId: string;
  tmdbId: number;
  mediaType: MediaType;
  body: string;
  parentId?: string | null;
}): Promise<void> {
  const reviewUserId = uuid(input.reviewUserId);
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);
  const parentId = input.parentId ? uuid(input.parentId) : null;

  /* دلوٌ أضيقُ من الافتراضي: الردُّ نصٌّ يقرؤه الناس، لا نقرةُ قلب */
  const { supabase, user } = await requireUser("reply", 15, 60_000);

  const body = String(input.body ?? "").replace(/\s{3,}/g, "  ").trim().slice(0, 1000);
  if (!body) return;

  const { error } = await supabase.from("review_replies").insert({
    review_user_id: reviewUserId,
    tmdb_id: tmdbId,
    media_type: mediaType,
    user_id: user.id,
    body,
    parent_id: parentId,
  });
  if (error) fail(error);

  for (const p of talkPaths(tmdbId, mediaType)) revalidatePath(p);
}

/**
 * حذفُ ردّي — والسياسةُ تمنع حذفَ ردِّ غيري، فلا فحصَ قبل الكتابة.
 *
 * والردودُ عليه تُحذف معه (`on delete cascade`): خيطٌ رأسُه محذوفٌ
 * وأطرافُه باقيةٌ يقرأ كحوارٍ مع فراغ.
 */
export async function deleteMyReply(input: {
  replyId: string;
  tmdbId: number;
  mediaType: MediaType;
}): Promise<void> {
  const replyId = uuid(input.replyId);
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("review_replies")
    .delete()
    .match({ id: replyId, user_id: user.id });
  if (error) fail(error);

  for (const p of talkPaths(tmdbId, mediaType)) revalidatePath(p);
}

/**
 * الإبلاغُ عن ردّ — توأمُ `reportReview` بحرفيّته: صامتٌ، لا يعود
 * بعدّاد، والإخفاءُ عند العاشر في مُشغِّل SQL لا هنا. وتكرارُه بلا أثر
 * (المفتاحُ الأساسي + `ignoreDuplicates`).
 */
export async function reportReply(input: { replyId: string; reason?: string }): Promise<void> {
  const replyId = uuid(input.replyId);
  const { supabase, user } = await requireUser("report", 10, 60_000);

  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const { error } = await supabase.from("reply_reports").upsert(
    { reply_id: replyId, reporter_id: user.id, reason: reason || null },
    { onConflict: "reply_id,reporter_id", ignoreDuplicates: true },
  );
  if (error) fail(error);
}

/**
 * **حذفُ قائمةٍ باسمها — الضغطةُ الثانية على علامة الحفظ** (D-206، طلب
 * أحمد: «إذا ضغطت عليها ثاني مرّة تنحذف من قائمتي»).
 *
 * **ولماذا بالاسم لا بالمعرّف:** بطاقةُ المجموعة في «اكتشف» لا تعرف معرّفَ
 * قائمتك — **هي تعرف اسمَ المجموعة وحده**، والحفظُ نفسُه يطابق بالاسم
 * (`upsertListWithItems`). **فالإزالةُ تسأل نفسَ السؤال الذي سأله الحفظ**،
 * وإلا حفظت بمقياسٍ وأزالت بآخر.
 *
 * **والأسماءُ جمعٌ لا مفرد:** الاسمُ يُكتب بلغة الواجهة وقتَ الحفظ (D-130)،
 * فمن حفظ «عالم مارفل» ثم بدّل إلى الإنجليزية يجب أن تُزيله علامتُه —
 * فتُمرَّر التسميتان ويُحذف ما وُجد منهما.
 *
 * ⚠️ **ويحذف قوائمَك أنت وحدها** (`user_id`) — والسياسةُ تحرسها فوق ذلك.
 * **ولا يحذف إلا ما طابق حرفياً**: من سمّى قائمةً بنفس الاسم بيده يفقدها،
 * **وهذا حدٌّ مقصود** — لأن الحفظَ نفسه كان سيُضيف إليها لا يُنشئ غيرها،
 * فهي عند المحرّك القائمةُ نفسُها.
 */
export async function removeListsNamed(names: string[]): Promise<number> {
  const clean = [...new Set((names ?? []).map((n) => String(n ?? "").trim()).filter(Boolean))]
    .slice(0, 4)
    .map((n) => n.slice(0, 60));
  if (!clean.length) return 0;

  const { supabase, user } = await requireUser("list", 10, 60_000);
  const { data, error } = await supabase
    .from("user_lists")
    .delete()
    .eq("user_id", user.id)
    .in("name", clean)
    .select("id");
  if (error) fail(error);

  revalidatePath("/lists");
  revalidatePath("/news");
  revalidatePath("/library");
  return (data ?? []).length;
}
