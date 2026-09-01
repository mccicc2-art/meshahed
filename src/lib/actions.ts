"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { PERSON_COLS } from "@/lib/people";
import { withIdentities, withPersonIdentities } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { REGION_COOKIE, normalizeRegion } from "@/lib/region";
import { TITLE_MODE_COOKIE, parseTitleMode } from "@/lib/titleMode";
import {
  CONTENT_PREFS_COOKIE,
  hasAnyPrefs,
  mergeContentPrefs,
  parseContentPrefs,
  sanitizeContentPrefs,
  serializeContentPrefs,
} from "@/lib/contentPrefs";
import { GENRES, type MediaType } from "@/lib/media";
import { isPlus, themeNeedsPlus } from "@/lib/plan";
import { BROWSE_GENRES } from "@/lib/browse";
import { cleanHandle } from "@/lib/socials";
import { THEMES } from "@/lib/themes";
import { RAILS_COOKIE, serializeHiddenRails } from "@/lib/railPrefs";
import {
  keepPaidHomePrefs,
  sanitizeHomePrefs,
  type HomePrefs,
  type HomeView,
} from "@/lib/homePrefs";
import {
  keepPaidProfilePrefs,
  sanitizeProfilePrefs,
  SORTABLE_SECTIONS,
  type ProfilePrefs,
} from "@/lib/profilePrefs";
import {
  FEED_STRANGERS_COOKIE,
  FEED_SORT_COOKIE,
  TALK_FOLLOWED_COOKIE,
  TRANSLATE_COOKIE,
  isTabSurface,
  parseTabPrefs,
  serializeTabPrefs,
  surfaceCookie,
  type TabPref,
} from "@/lib/tabPrefs";
import { allow } from "@/lib/ratelimit";
import {
  asTrailerScope,
  asTrailerTab,
  getTrailerTabFeed,
  type TrailerItem,
} from "@/lib/trailers";
import { getT } from "@/lib/locale";
import {
  FONT_UI_COOKIE,
  FONT_CONTENT_COOKIE,
  sanitizeFontSize,
} from "@/lib/fontPrefs";
import {
  mergeHints,
  sanitizeTourState,
  sanitizeUiState,
  type TourState,
  type UiState,
} from "@/lib/uiState";
import { sanitizeSavedFilters, type SavedFilter } from "@/lib/savedFilters";
import { sanitizePrefTemplates, type PrefTemplate } from "@/lib/prefTemplates";
import { isViewKey } from "@/lib/postKeys";
import { intId, intIn, asMediaType, uuid, dateOrNull } from "@/lib/validate";
import { searchGifs, type GifHit } from "@/lib/gif";
import { IMPORT_CAPS, type ImportPayload, type ResolveRequest, type ResolveResult } from "@/lib/importer";
import { getTv, getMovie } from "@/lib/tmdb";
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

/**
 * ====== ربطُ حساب X وفكُّه — التوثيقُ تشتقّه القاعدةُ بنفسها (D-839) ======
 *
 * **حكمُ أحمد**: «أبغاه ربط حقيقي مو بس كتابة اسم، بحيث يعمل تسجيل
 * دخول عن طريقهم عشان يكون أكثر مصداقيّة».
 *
 * 🔴 **وهذه الصيغةُ الثانية، بعد عطلٍ حيٍّ في الأولى** (الهجرة ١٧٠):
 * كانت هذه الدالّةُ تقرأ الهويّةَ من GoTrue ثمّ تكتب الصفَّ بجلسة
 * المستخدم — **فردّت القاعدةُ `permission denied for table profiles`**:
 * **`authenticated` تملك UPDATE على ٢٦ عموداً مسمّى، و`x_verified_at`
 * ليس منها.**
 * 🔑 **ومنحُ العمود كان سيهدم الميزةَ نفسَها**: **`socials` ممنوحةٌ
 * للمستخدم** — **فمنحُ التاريخ معها يجعل الشارةَ تُزوَّر بنداءٍ مباشرٍ
 * على PostgREST بلا مرورٍ بأيِّ شاشة.**
 * ✅ **فصار الاشتقاقُ في القاعدة**: `sync_x_identity()` بـ`definer`
 * **تقرأ `auth.identities` بنفسها وتكتب** — **والعميلُ لا يمرّر شيئاً
 * أصلاً، فلا مُدخَلَ يُزوَّر.**
 *
 * 🔑 **ودالّةٌ واحدةٌ للاتّجاهين** (D-238): **وجدت الهويّةُ فتوثيق،
 * وغابت فمحو** — **فالربطُ وفكُّه ينادِيان الشيءَ نفسَه.**
 *
 * 🔴 **والخطأُ يُعاد لا يُرمى** — **وهذا عطلٌ ثانٍ ظهر في نفس الجولة**:
 * **Next تُخفي رسائلَ أخطاء أفعال الخادم في الإنتاج**، **فرأى أحمد
 * «Minified React error #441» مكانَ رسالتي العربيّة.** **ورسالةُ خطأٍ
 * لا تصل القارئ ليست رسالة** (D-063) — **فالنتيجةُ كائنٌ يُقرأ، لا
 * استثناءٌ يُلتقط.**
 */
export type XSyncResult = { handle: string | null; error?: string };

export async function syncXIdentity(): Promise<XSyncResult> {
  const { supabase } = await requireUser("xlink", 10, 60_000);

  const { data, error } = await supabase.rpc("sync_x_identity");
  if (error) return { handle: null, error: error.message };

  /* **والمصفاةُ تُطبَّق مرّتين عمداً**: في الدالّة وهنا — **بياناتُ
     طرفٍ ثالثٍ مُدخَلٌ لا ثقة**، **وحارسان أرخصُ من شارةٍ كاذبة.** */
  const handle = typeof data === "string" ? cleanHandle("x", data) : null;
  if (!handle) {
    return {
      handle: null,
      error: "لم تصل هويّة X — جرّب الربط مرّة أخرى / X identity not found",
    };
  }
  return { handle };
}

/**
 * **فكُّ الربط** — **الهويّةُ تُفكّ أوّلاً ثمّ يُمحى الأثر.**
 *
 * ⚠️ **والترتيبُ ليس ذوقاً**: **GoTrue ترفض فكَّ آخرِ هويّةٍ للحساب**
 * — **فلو مسحنا الأثرَ أوّلاً ثمّ فشل الفكُّ لبقي الحسابُ مربوطاً
 * وملفُّه يقول إنّه ليس كذلك.**
 */
export async function unlinkXIdentity(): Promise<{ error?: string }> {
  const { supabase } = await requireUser("xlink", 10, 60_000);

  const { data } = await supabase.auth.getUserIdentities();
  const ident = (data?.identities ?? []).find((i) => i.provider === "x");
  if (ident) {
    const { error } = await supabase.auth.unlinkIdentity(ident);
    if (error) return { error: error.message };
  }

  /* **والدالّةُ نفسُها تمحو** — **لأنّ الهويّةَ غابت، لا لأنّنا أمرناها** */
  const { error: rpcErr } = await supabase.rpc("sync_x_identity");
  if (rpcErr) return { error: rpcErr.message };
  return {};
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

  /* الأنواع تُقصر على المعرّفات المعروفة، والصور على مخزن المشروع.
     ⚖️ 🆕 **والمعروفُ صار أوسع** (D-546، إصلاحُ أثرٍ جانبيٍّ لـD-545):
     **«المحتوى المفضّل» صار يكتب معرّفاتِ `BROWSE_GENRES`** (رعبٌ ٢٧،
     رومانسيٌّ ١٠٧٤٩، إثارةٌ ٥٣…) **وهذه المصفاةُ كانت تعرف `GENRES`
     الاثني عشر وحدَها** — **فأوّلُ حفظٍ في «تعديل الملفّ» كان يمحو
     كلَّ نوعٍ اختاره من الجديد**، **وهو محوٌ صامتٌ في نموذجٍ لا يعرض
     الحقلَ أصلاً.** **والمصفاةُ الآن اتّحادُ السجلّين، والسقفُ ٢٠
     كسقف `contentPrefs`.** */
  const knownGenre = (g: number) =>
    GENRES.some((k) => k.id === g) ||
    BROWSE_GENRES.some((k) => k.movie.includes(g) || k.tv.includes(g));
  const genres = [...new Set(input.favoriteGenres)]
    .filter((g) => Number.isInteger(g) && knownGenre(g))
    .slice(0, 20);

  const payload: Record<string, unknown> = {
    id: user.id,
    nickname: nickname || null,
    avatar_url: safeImageUrl(input.avatarUrl),
    favorite_genres: genres,
    /* 🗑️ **و`socials` خرجت من هنا** (D-839): **كاتبُها `syncXIdentity`
       وحدَها بعد ثبوت الهويّة** — **وفعلٌ عامٌّ يقبل معرّفاً نصّيّاً
       يجعل التوثيقَ قابلاً للتزوير بنداءٍ مباشرٍ بلا شاشة** (وهي حجّةُ
       D-821 بحرفها: **الحارسُ يسكن الفعل لا الشاشة**). */
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
  /* 🔴 🆕 **حارسُ الخادم على ما تبيعه صفحةُ البلس** (D-791، حكمُ أحمد:
     «ما تبيعه الصفحة فقط»).
     🔴 **ولمَ وُلد**: أقفالُ Loopz+ كانت **في المتصفّح وحدَه** —
     **ولا شرطَ خطّةٍ واحدٌ في أيِّ فعلِ خادم** — **فكانت الثيماتُ
     والتنسيقُ تُحفظ لمن ليس مشترِكاً بنداءٍ مباشر.** **ومن يبيع ميزةً
     يقفلها في الخادم أوّلاً.**
     ⚠️ **وقراءةٌ واحدةٌ لا ثلاث**: الحكمُ والمحفوظُ في استعلامٍ واحدٍ
     **ولا يُدفع إلّا حين يُرسَل حقلٌ مقفول** — **ومن حفظ نبذتَه لا
     يدفع ثمنَ حارسٍ لا يخصّه.** */
  const gated =
    input.theme !== undefined ||
    input.homePrefs !== undefined ||
    input.profilePrefs !== undefined;
  let plus = true;
  let storedRow: { home_prefs?: unknown; profile_prefs?: unknown } | null = null;
  if (gated) {
    const { data } = await supabase
      .from("profiles")
      .select("plan, plus_until, home_prefs, profile_prefs")
      .eq("id", user.id)
      .maybeSingle();
    plus = isPlus(data);
    storedRow = data ?? null;
  }

  if (input.theme !== undefined) {
    const wanted = THEMES.some((t) => t.id === input.theme) ? input.theme : "amber";
    /* **والمقفولُ يُترك على حاله لا يُردّ إلى `amber`**: **من فقد
       اشتراكَه لا يُسلَب ثيمَه بحفظةِ نبذة** — **والسلبُ الصامتُ أسوأُ
       من المنع المعلن** (D-217). */
    if (plus || !themeNeedsPlus(wanted)) payload.theme = wanted;
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
  /* **والحقلُ المقفولُ يعود إلى محفوظه والباقي يُكتب** — **لا رفضَ
     للنداء كلِّه**: النموذجُ يرسل الاسمَ والنبذةَ والتنسيقَ معاً،
     **ورفضُ الجميع كان سيمنع مجّانيّاً من حفظ اسمه.** */
  if (input.homePrefs !== undefined) {
    const next = sanitizeHomePrefs(input.homePrefs);
    payload.home_prefs = plus
      ? next
      : keepPaidHomePrefs(sanitizeHomePrefs(storedRow?.home_prefs), next);
  }
  if (input.profilePrefs !== undefined) {
    const next = sanitizeProfilePrefs(input.profilePrefs);
    payload.profile_prefs = plus
      ? next
      : keepPaidProfilePrefs(sanitizeProfilePrefs(storedRow?.profile_prefs), next);
  }

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

/**
 * **وضعُ عرض الرئيسية وحدَه** (D-434).
 *
 * **ولماذا فعلٌ مستقلٌّ لا `updateProfile`**: ذاك يطلب الاسمَ والصورةَ
 * والأنواعَ المفضّلة في كل نداء — **فمبدّلٌ بضغطةٍ واحدة كان سيرسل
 * ملفَّك كلَّه ليقلب كلمة**، وأيُّ حقلٍ نسيه المُرسِل يُكتب فارغاً.
 * **وهنا حقلٌ واحدٌ يُدمج في `home_prefs` القائم** فلا يمسّ سواه.
 *
 * **والقراءةُ قبل الكتابة لازمة**: العمودُ JSON واحد، **والكتابةُ فوقه
 * بكائنٍ فيه `view` وحدَه تمحو الترتيبَ والخانات** — نفسُ درسِ
 * `create or replace` (D-380): يُقرأ الحيُّ ثم يُبنى فوقه.
 *
 * ⚖️ 🆕 **وسقطت `revalidatePath("/")` من هنا** (جولة ٢٢ أغسطس): **سطرٌ
 * واحدٌ كلفتُه رسمةُ رئيسيّةٍ كاملة** — الفعلُ الذي يُبطل مسارَه يردّ
 * حمولةَ RSC جديدةً للمسار نفسِه، **ثم كان `router.refresh()` في
 * المبدّل يجلبها ثانيةً**: **رسمتان كاملتان لتغيير شكل.**
 * 📏 **والمقيسُ في الإنتاج (٢٢ أغسطس)**: `POST /` ٣٠٤م.ث و**٥٥ ك.ب**،
 * ثمّ `GET /?_rsc=` ١٣٤م.ث و**٥٥ ك.ب أخرى — نفسُ الشجرة مرّتين** —
 * وخلفَهما ثلاثةُ نداءات تسخينٍ لِـ`/library`.
 *
 * **والشكلُ لم يعد يحتاج الخادمَ أصلاً**: الرئيسيةُ ترسم الوضعين معاً
 * و`HomeViewProvider` يختار — **فهذا الفعلُ صار حفظاً في الخلفية
 * وحدَه**: مهمّتُه أن يبقى الاختيارُ بعد إعادة الفتح وأن يتزامن بين
 * الأجهزة، **لا أن يرسم شيئاً الآن.**
 *
 * ⚠️ **وما لا يُكسَر بذلك**: الرئيسيةُ ديناميكيّةٌ تُرسم لكلِّ طلب،
 * **فأوّلُ فتحٍ يقرأ القيمةَ من القاعدة كما كان**. الذي سقط هو إبطالُ
 * كاشِ الراوتر في التبويب الحيّ (١٨٠ ثانية) — **وقد ناب عنه مخزنُ
 * التبويب في `HomeViewProvider`.**
 */
export async function setHomeView(value: string) {
  const { supabase, user } = await requireUser("homeview", 20, 10_000);
  const view: HomeView = value === "compact" ? "compact" : "visual";

  const { data } = await supabase
    .from("profiles")
    .select("home_prefs")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = sanitizeHomePrefs(data?.home_prefs);
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, home_prefs: { ...prefs, view } }, { onConflict: "id" });
  if (error) fail(error);

  return view;
}

/**
 * 🆕 **رايةُ طابور «للمشاهدة»** (D-559، بلاغُ أحمد: «أقدر أشغّلها
 * وأوقفها وقت ما أبغى»).
 *
 * **وهي أختُ `setListPlaylist` بالمعنى** (D-505): تلك ترفع الرايةَ على
 * قائمةٍ في `user_lists`، **وهذه على الطابور المحسوب** — **ومكانُ
 * رايته `home_prefs` لأنه لا صفَّ له في جدول القوائم** (الحجّةُ
 * كاملةً عند `HomePrefs.toWatch`).
 *
 * **والقراءةُ قبل الكتابة لازمة** — نفسُ درسِ `setHomeView` فوقه:
 * العمودُ JSON واحد، **وكتابةٌ فوقه بكائنٍ فيه `toWatch` وحدَه تمحو
 * الترتيبَ والخانات.**
 *
 * ⚠️ **و`revalidatePath("/")` هنا تلزم** — بخلاف `setHomeView`:
 * **هذه تُغيّر ما تحمله الرئيسيةُ من بيانات لا شكلَ رسمها** — بطاقةٌ
 * تظهر أو تسقط من صفّ «تابِع المشاهدة»، **ولا نسخةَ منها في العميل
 * يختار بينها.**
 */
export async function setToWatchQueue(on: boolean) {
  const { supabase, user } = await requireUser("towatch", 20, 10_000);

  const { data } = await supabase
    .from("profiles")
    .select("home_prefs")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = sanitizeHomePrefs(data?.home_prefs);
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, home_prefs: { ...prefs, toWatch: !!on } }, { onConflict: "id" });
  if (error) fail(error);

  revalidatePath("/");
  revalidatePath("/library");
  /* **وبابُ البطاقة الثاني** — `/lists` يرسم `ListManager` نفسَه (D-559) */
  revalidatePath("/lists");
  return !!on;
}

/**
 * 🆕 **ترتيبُ أقسام الرئيسية من عناوينها** (D-595، حكمُ أحمد بلقطةٍ
 * دوّر فيها عناوينَ الأقسام: «حتى في الهوم أي شي أضغط عليه من هذي
 * يخلّيني أرتّبها — من الأوّل ومن الثاني وكذا»).
 *
 * **الكاتبُ نفسُه الذي تكتب به شاشةُ التخصيص** (`home_prefs.order`
 * عبر التنقية نفسِها `sanitizeHomePrefs`) — **بابان لحقلٍ واحد لا
 * حقلان** (D-462)، والقراءةُ قبل الكتابة لدرس `setHomeView` نفسِه:
 * العمودُ JSON واحدٌ وكتابةُ `order` وحدَه تمحو أخوتَه.
 *
 * ⚠️ **و`revalidatePath("/")` تلزم** — الترتيبُ يقرؤه الخادمُ عند
 * الرسم، والورقةُ تنادي `router.refresh()` بعده فيصل الترتيبُ الجديد.
 */
export async function saveHomeSectionOrder(order: string[]) {
  const { supabase, user } = await requireUser("profile", 30, 60_000);

  const { data } = await supabase
    .from("profiles")
    .select("home_prefs, plan, plus_until")
    .eq("id", user.id)
    .maybeSingle();

  /* 🔴 🆕 **وترتيبُ الأقسام من البلس** (D-791) — **والحكمُ من الصفِّ
     المقروء أصلاً فلا استعلامَ ثانٍ.** **والصمتُ لا خطأ**: الواجهةُ
     تحرس قبله، **ومن بلغ هنا بنداءٍ مباشرٍ لا يستحقّ رسالةً تشرح له
     كيف يعيد المحاولة.** */
  if (!isPlus(data)) return;

  const prefs = sanitizeHomePrefs(data?.home_prefs);
  /* **التنقيةُ بمرشِّح القراءة نفسِه**: أقسامٌ معروفةٌ بلا تكرار —
     وقيمةٌ عبرت الشبكةَ لا تُصدَّق (عُرفُ `updateProfile`) */
  const next = sanitizeHomePrefs({ ...prefs, order });

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, home_prefs: next }, { onConflict: "id" });
  if (error) fail(error);

  revalidatePath("/");
}

/**
 * 🆕 **أولويّةُ المشاهدة داخل صفَّي الرئيسية** (D-605، طلبُ أحمد:
 * «أرتّب الأفلام نفسها نفس الي عامله في البروفايل») — كاتبُ
 * `continueOrder`/`towatchOrder` في `home_prefs` القائم بلا هجرة،
 * **بوصفة `saveHomeSectionOrder` حرفاً**: قراءةٌ فدمجٌ فتنقيةٌ بمرشِّح
 * القراءة نفسِه (بابان لحقلٍ واحدٍ لا حقلان — D-462).
 */
export async function saveHomeQueueOrder(
  /* 🆕 **ورابعُها بطاقةُ «للمشاهدة» نفسُها** (D-719) — انظر حجّةَ
     المفتاح الرابع في `homePrefs.towatchListOrder`. */
  row: "continue" | "towatch" | "lists" | "towatchlist",
  keys: string[],
) {
  const field =
    row === "continue"
      ? "continueOrder"
      : row === "lists"
        ? "listsOrder"
        : row === "towatchlist"
          ? "towatchListOrder"
          : "towatchOrder";
  const { supabase, user } = await requireUser("profile", 30, 60_000);

  const { data } = await supabase
    .from("profiles")
    .select("home_prefs")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = sanitizeHomePrefs(data?.home_prefs);
  const next = sanitizeHomePrefs({ ...prefs, [field]: keys });

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, home_prefs: next }, { onConflict: "id" });
  if (error) fail(error);

  /* 🆕 **وبطاقةُ «للمشاهدة» تُرسم في ثلاثة أبواب** (D-719): الرئيسيةُ
     والمكتبةُ وصفحةُ القوائم — **وترتيبٌ يُحفظ ولا يظهر إلّا في واحدٍ
     منها يُقرأ عطلاً.** */
  revalidatePath("/");
  if (row === "towatchlist") {
    revalidatePath("/library");
    revalidatePath("/lists");
  }
}

/**
 * 🆕 **تسجيلُ حدثِ منصّةٍ — بلا هويّة** (D-608): أربعةُ أسماءٍ يحرسها
 * جسمُ الدالّة في القاعدة، **ولا `requireUser`**: الزائرُ يضغط البطاقةَ
 * أيضاً، والصفُّ لا يحمل من يكون. **والفشلُ صمتٌ** — تتبّعٌ لا يُفشل
 * ضغطةَ مستخدمٍ ولا يؤخّرها.
 */
export async function logProviderEvent(input: {
  event: string;
  tmdbId: number;
  mediaType: "tv" | "movie";
  providerId: number;
  country: string;
}) {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_provider_event", {
      p_event: String(input.event).slice(0, 40),
      p_tmdb: intId(input.tmdbId),
      p_media: input.mediaType === "movie" ? "movie" : "tv",
      p_provider: intId(input.providerId),
      p_country: String(input.country ?? "SA").slice(0, 2),
    });
  } catch {
    // تحسينُ قياسٍ لا شرط
  }
}

/**
 * 🆕 **كاتبُ روابط المنصّات — للإدارة وحدها** (D-608): الحارسُ الحقيقيُّ
 * `am_admin()` في جسم دالّة القاعدة (D-011)، **والتحقّقُ هنا للرسالة
 * المقروءة**: https حصراً ونطاقٌ من قائمة المنصّة الموثوقة — **رابطٌ
 * بنطاقٍ مزيّفٍ يُرفض قبل أن يبلغ القاعدة.**
 */
export async function adminSetProviderLink(input: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  providerId: number;
  providerName: string;
  country: string;
  url: string;
  status: "verified" | "pending" | "disabled";
}) {
  const { isTrustedProviderUrl } = await import("@/lib/providerLinks");
  const url = String(input.url ?? "").trim();
  if (!isTrustedProviderUrl(input.providerName, url)) {
    throw new Error("الرابط مرفوض: https على نطاق المنصّة الموثوق فقط");
  }
  const { supabase } = await requireUser("profile", 30, 60_000);
  const { error } = await supabase.rpc("admin_set_provider_link", {
    p_tmdb: intId(input.tmdbId),
    p_media: input.mediaType === "movie" ? "movie" : "tv",
    p_provider: intId(input.providerId),
    p_country: String(input.country ?? "SA").toUpperCase().slice(0, 2),
    p_url: url,
    p_status: input.status,
  });
  if (error) fail(error);
  revalidatePath("/admin/links");
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
 * حجم الخطّ — تفضيلان مستقلّان: واجهة النظام ومحتوى المستخدم.
 *
 * على نمط الثيم حرفاً: الكوكي للرسمة الأولى (يقرؤه layout قبل أول
 * بكسل)، والعمودان في `profiles` (هجرة 121) ليتبع الاختيارُ الحسابَ بين
 * الأجهزة. الزائر غير المسجَّل يكتفي بالكوكي — وهذا معنى «محلياً للزائر».
 *
 * الكتابة في القاعدة هنا وحدها (قاعدة D-462: حقلٌ واحد لا يملك كاتبَين
 * — `updateProfile` لا يعرف هذين العمودين عمداً)، وفشلُها لا يُسقط
 * الفعل: الكوكي كُتب والواجهة استجابت، والمزامنة بين الأجهزة رفاهية
 * تعود مع أول حفظٍ ناجح.
 */
export async function setFontPrefs(ui: string, content: string) {
  const fontUi = sanitizeFontSize(ui);
  const fontContent = sanitizeFontSize(content);
  const store = await cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const, secure: true };
  store.set(FONT_UI_COOKIE, fontUi, opts);
  store.set(FONT_CONTENT_COOKIE, fontContent, opts);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ font_ui: fontUi, font_content: fontContent })
        .eq("id", user.id);
    }
  } catch {
    /* عمودٌ لم يُهاجَر بعد أو انقطاع — الكوكي يكفي لهذا الجهاز */
  }
}

/**
 * حالة الواجهة التعليمية — التلميحات المقروءة وتقدّم الجولة.
 *
 * ⚖️ بطلب أحمد (١٩ أغسطس): تُحفظ في الحساب (`profiles.ui_state`، هجرة
 * 121) لتتبع صاحبها بين أجهزته — وlocalStorage يبقى ذاكرةَ الجهاز
 * وذاكرةَ الزائر. الكاتب الوحيد للعمود هذا الفعل (قاعدة D-462: حقلٌ
 * واحدٌ لا يملك كاتبَين).
 *
 * قراءةٌ ثم دمجٌ ثم كتابة لا استبدال أعمى: جهازان متزامنان يكتبان
 * تلميحاتٍ مختلفة يجب ألّا يمحو أحدُهما قراءة الآخر — الاتحاد يضمن
 * «مقروءٌ في أي مكان مقروءٌ في كل مكان». والفشل صامتٌ عمداً: قبل
 * تشغيل الهجرة يعمل كلُّ شيء بـlocalStorage وحده، وسطرٌ إرشاديٌّ لا
 * يستحق شاشةَ خطأ.
 */
export async function updateUiState(patch: {
  /** تلميحات تُضاف إلى المقروء (اتحاد) */
  addHints?: string[];
  /** إفراغ قائمة المقروء — زرّ «إعادة عرض التلميحات» وحده */
  resetHints?: boolean;
  /** حالة الجولة الجديدة — تستبدل المخزنة (التقدم الخطي شأن الجهاز الفعال) */
  tour?: TourState;
  /**
   * 🆕 **الفلاترُ المحفوظة** (D-816) — **تستبدل المخزَّنة كاملةً لا
   * تتّحد معها**: **الحذفُ فعلٌ مقصود**، **واتحادٌ يجعل ما حُذف يعود.**
   * **والعميلُ يبني القائمةَ الجديدةَ بدوالِّ `savedFilters` ثمّ يرسلها.**
   * ⚠️ **والتطهيرُ هنا لا هناك**: **العميلُ يُقترح والخادمُ يقرّر.**
   */
  filters?: SavedFilter[];
  /**
   * 🆕 **قوالبُ التخصيص** (D-822) — **نفسُ عقد `filters` حرفاً**:
   * تستبدل المخزَّنةَ كاملةً (الحذفُ فعلٌ مقصود)، **والتطهيرُ هنا لا
   * عند المستدعي**، **والبلسُ شرطُ الكتابة.**
   */
  tpl?: PrefTemplate[];
}): Promise<{ ok: boolean; needsPlus?: true }> {
  try {
    const { supabase, user } = await requireUser("uistate", 30, 60_000);
    /* 🔑 **والخطّةُ تُقرأ مع الحالة لا بنداءٍ ثانٍ** — `viewerIsPlus()`
       استعلامٌ كاملٌ على `profiles`، **وهذا الصفُّ مقروءٌ أصلاً** (D-515). */
    const { data } = await supabase
      .from("profiles")
      .select("ui_state, plan, plus_until")
      .eq("id", user.id)
      .maybeSingle();

    /* 🔴 **حارسُ البلس هنا لا في الرقاقة** (درسُ D-819 بحرفه): **حارسُ
       العميل زينةٌ — الفعلُ يُنادى بلا سطحِه.** **وD-816 شُحنت بحارسٍ
       في `SavedFiltersRow` وحدَه، وهذا سدُّ ثغرتها.**
       ⚠️ **والفرعُ وحدَه محروس**: **التلميحاتُ والجولةُ مجّانيّتان
       لكلِّ أحد** — **ومن قفلَ `updateUiState` كلَّها أطفأ إرشادَ
       التطبيق عن غير المشترك.** */
    if ((patch.filters !== undefined || patch.tpl !== undefined) && !isPlus(data)) {
      return { ok: false, needsPlus: true };
    }

    const current = sanitizeUiState(data?.ui_state);
    const next: UiState = {
      hints: patch.resetHints
        ? []
        : patch.addHints
          ? mergeHints(current.hints, sanitizeUiState({ hints: patch.addHints }).hints)
          : current.hints,
      tour: patch.tour !== undefined ? sanitizeTourState(patch.tour) : current.tour,
      filters:
        patch.filters !== undefined ? sanitizeSavedFilters(patch.filters) : current.filters,
      tpl: patch.tpl !== undefined ? sanitizePrefTemplates(patch.tpl) : current.tpl,
    };
    await supabase.from("profiles").update({ ui_state: next }).eq("id", user.id);
    return { ok: true };
  } catch {
    /* زائرٌ، أو عمودٌ لم يُهاجَر، أو انقطاع — localStorage يكفي للجهاز */
    return { ok: false };
  }
}

/**
 * 🆕 **صفوفُ اكتشف الظاهرة** (D-826).
 *
 * **حكمُ أحمد**: «يقدر يخفي أيَّ عنوانٍ من هذي العناوين، **وتكون في
 * فيو**».
 *
 * 🔑 **وكوكيٌّ لا عمود** — **نفسُ عقدِ `setTabPrefs` حرفاً** (D-179):
 * **الصفحةُ تُرسم على الخادم قبل أن تُعرف الجلسة.**
 *
 * 🔒 **وبلس** — **والحارسُ هنا لا في الورقة** (D-819/D-821):
 * **حارسُ العميل زينةٌ حين يُنادى الفعلُ بلا سطحِه.**
 * ⚠️ **والإظهارُ ليس محروساً كالإخفاء**: **قائمةٌ فارغةٌ = كلُّ شيءٍ
 * ظاهر** — **ومن انقطع اشتراكُه لا يُحبس في صفحةٍ أطفأ نصفَها ولا
 * يملك إعادتَه** (نفسُ حكم `setThemeAccent`).
 */
export async function setHiddenRails(
  keys: string[],
): Promise<{ ok: boolean; needsPlus?: true }> {
  const clean = serializeHiddenRails(Array.isArray(keys) ? keys : []);
  if (clean && !(await viewerIsPlus())) return { ok: false, needsPlus: true };

  const store = await cookies();
  store.set(RAILS_COOKIE, clean, {
    path: "/",
    maxAge: clean ? 60 * 60 * 24 * 365 : 0,
    sameSite: "lax",
  });
  return { ok: true };
}

/* 🗑️ **و`setThemeAccent` و`syncAccentCookie` سقطتا** (D-848): **لونُ
   التمييز الشخصيُّ حُذف بالكامل بحكم أحمد** — **والعمودُ `theme_accent`
   يبقى في `profiles` بلا كاتبٍ ولا قارئ**، **يُسقَط في هجرةٍ بعد أن
   يستقرّ هذا** (D-214/D-538: العمودُ بعد قرّائه لا معهم). */

/**
 * تبديل بلد المشاهدة.
 *
 * كوكي فقط، بلا عمودٍ في قاعدة البيانات: هذا تفضيل عرضٍ كالثيم واللغة
 * (D-014)، يقرؤه الخادم قبل أوّل رسمة، ولا يستحقّ هجرةً ولا صفّاً.
 */
/**
 * 🆕 **طريقةُ عرض أسماء الأعمال** (D-544) — **كوكيٌّ واحدٌ بلا زرِّ حفظ**،
 * نفسُ شكلِ `setWatchRegion` حرفاً (D-014).
 *
 * ⚠️ **ولا يُصدَّق ما يصل**: القيمةُ تمرّ بـ`parseTitleMode` نفسِها التي
 * يمرّ بها الكوكيُّ المقروء — **فالمجهولُ يسقط إلى الافتراض.**
 * ⚖️ 🆕 **وقيدُ اللغة سقط من الطرفين معاً** (D-593 — الصوتيّةُ صارت
 * للواجهتين بحكم أحمد، نقضاً لسطرِ مواصفة D-544).
 */
export async function setTitleMode(value: string) {
  const mode = parseTitleMode(value);
  const store = await cookies();
  store.set(TITLE_MODE_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/**
 * 🆕 **حفظُ تفضيلات المحتوى** (D-545) — **صفُّ الملفّ للمسجَّل، والكوكي
 * للزائر.**
 *
 * ⚠️ **والتنقيةُ قبل الكتابة لا بعدها** (ثلاثيّةُ D-177): `sanitize`
 * تُسقط ما ليس في السجلّات، وتزيل التكرار، **وتحسم التعارض بأن يغلب
 * المفضَّل** — **ولولاها لرفض قيدُ الهجرة ١٢٦ الصفَّ كلَّه** فيصير
 * الحفظُ خطأً صامتاً بدل تصحيحٍ صامت.
 *
 * ⚠️ **ولا `revalidatePath`**: التوصياتُ تُقرأ على الخادم في كلِّ فتحةِ
 * صفحة، **و`router.refresh()` من الواجهة تكفي** — **وإبطالُ مسارٍ عامٍّ
 * لأجل تفضيلٍ شخصيّ يُسقط تخبئةَ غيره** (وهو نصُّ «امنع تسرّب كاش
 * توصيات مستخدم إلى مستخدم آخر» من الجهة الأخرى).
 */
export async function setContentPrefs(raw: {
  genres?: unknown;
  unwantedGenres?: unknown;
  languages?: unknown;
  excludedLanguages?: unknown;
}) {
  const clean = sanitizeContentPrefs(raw ?? {});
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    /* **الزائرُ يختار أيضاً** — كوكيٌّ سنةً كبقيّة التفضيلات (D-014) */
    const store = await cookies();
    store.set(CONTENT_PREFS_COOKIE, serializeContentPrefs(clean), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      favorite_genres: clean.genres,
      unwanted_genres: clean.unwantedGenres,
      preferred_languages: clean.languages,
      excluded_languages: clean.excludedLanguages,
    })
    .eq("id", auth.user.id);
  if (error) throw new Error(error.message);

  /* **وكوكيُّ الزائر يُمحى بعد أن يصير للحساب صفّ** — **وإلّا عاد
     يُدمج في كلِّ دخول** فيُحيي خياراً حذفه صاحبُه من حسابه. */
  const store = await cookies();
  if (store.get(CONTENT_PREFS_COOKIE)) {
    store.set(CONTENT_PREFS_COOKIE, "", { path: "/", maxAge: 0 });
  }
}

/**
 * 🆕 **دمجُ تفضيلات الزائر في الحساب عند أوّل دخول** (D-545، شرطُ
 * المواصفة: «ادعم الزائر غير المسجّل محليّاً، ثمّ ادمج تفضيلاته مع
 * الحساب بعد تسجيل الدخول دون فقدها»).
 *
 * **تُنادى من مسار OAuth بعد تبديل الرمز بجلسة** — **قبل أن يرى
 * المستخدمُ أوّلَ صفحة**، فلا يلمح توصياتٍ بلا تفضيلاته ثمّ تتبدّل.
 *
 * ⚠️ **وسقوطُها لا يُسقط الدخول**: من دخل دخل، **وتفضيلاتُ الزائر
 * أهونُ من جلسةٍ تُرفض** — والكوكي يبقى فتُدمج في المحاولة التالية.
 */
export async function absorbGuestContentPrefs(): Promise<void> {
  try {
    const store = await cookies();
    const raw = store.get(CONTENT_PREFS_COOKIE)?.value;
    if (!raw) return;
    const guest = parseContentPrefs(raw);
    if (!hasAnyPrefs(guest)) {
      store.set(CONTENT_PREFS_COOKIE, "", { path: "/", maxAge: 0 });
      return;
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    const { data: row } = await supabase
      .from("profiles")
      .select("favorite_genres, unwanted_genres, preferred_languages, excluded_languages")
      .eq("id", auth.user.id)
      .maybeSingle();

    const account = sanitizeContentPrefs({
      genres: row?.favorite_genres ?? [],
      unwantedGenres: row?.unwanted_genres ?? [],
      languages: row?.preferred_languages ?? [],
      excludedLanguages: row?.excluded_languages ?? [],
    });
    const merged = mergeContentPrefs(account, guest);

    await supabase
      .from("profiles")
      .update({
        favorite_genres: merged.genres,
        unwanted_genres: merged.unwantedGenres,
        preferred_languages: merged.languages,
        excluded_languages: merged.excludedLanguages,
      })
      .eq("id", auth.user.id);

    store.set(CONTENT_PREFS_COOKIE, "", { path: "/", maxAge: 0 });
  } catch {
    /* الكوكي باقٍ — تُعاد المحاولةُ في الدخول التالي */
  }
}

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
/**
 * 🔒 🆕 **وترتيبُ التبويبات وإظهارُها صارا بلس** (D-819، حكمُ أحمد:
 * «الفيو في كلّ التولز خلّها للبلس فقط»).
 *
 * 🔑 **والحارسُ هنا لا في الأوراق الأربع**: **هذا الفعلُ هو الكاتبُ
 * الوحيدُ للتفضيل** (D-462: حقلٌ واحدٌ لا يملك كاتبَين) — **وأربعُ
 * أوراقٍ تحرس ثلاثاً وتنسى واحدة.**
 *
 * 🔴 **والبديلُ المرفوض كان معاملَ `plus` يُمرَّر عبر ستّة مكوّنات**:
 * **حارسٌ في العميل زينةٌ لا قفل** (الفعلُ يُنادى بدونه)، **وكان يكلّف
 * قراءةَ ملفٍّ حاجبةً في كلِّ فتحةِ «اكتشف» و«مكتبتي»** — **ثمنٌ يدفعه
 * كلُّ زائرٍ لأجل لوحٍ لا يفتحه واحدٌ من مئة** (D-515).
 * **والجوابُ يعود من الفعل نفسِه، فتفتح الواجهةُ البوّابةَ عن حقيقةٍ لا
 * عن تخمين.**
 *
 * ⚠️ **والمناداةُ القائمةُ لا تُكسر**: **قيمةٌ راجعةٌ تُضاف ولا تُطلب**
 * — ومن كان يتجاهلها يبقى يتجاهلها (D-028).
 */
export async function setTabPrefs(
  surface: string,
  prefs: TabPref[],
): Promise<{ ok: boolean; needsPlus?: true }> {
  if (!isTabSurface(surface)) return { ok: false };
  /* **ولا كتابةَ قبل الحكم** — **كوكيٌّ يُكتب ثمّ تُفتح بوّابةٌ يترك
     التفضيلَ محفوظاً ويقول «اشترِ»**، وهو أسوأُ من الاثنين. */
  if (!(await viewerIsPlus())) return { ok: false, needsPlus: true };
  const clean = parseTabPrefs(surface, serializeTabPrefs(prefs));
  const store = await cookies();
  store.set(surfaceCookie(surface), serializeTabPrefs(clean), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return { ok: true };
}

/**
 * 🆕 **صفوفُك الخاصة في اكتشف** (D-337) — كوكيزٌ كنمط `setTabPrefs`
 * حرفاً: التعقيمُ بإعادة التحليل ضدّ القاموسَين، **فلا يُخزَّن إلا ما
 * يُعرف** (slug غريبٌ يسقط صامتاً لا يفرغ الصفحة).
 */
/**
 * 🆕 **صوتُ الترايلر** (D-726) — **كوكيزٌ كنمط `setTabPrefs` حرفاً**:
 * قيمتان لا غير، **والمجهولُ يسقط إلى الصمت** لا إلى الصوت.
 * ⚠️ **ولا `revalidatePath`**: التفضيلُ يُقرأ عند الرسم القادم،
 * **وإعادةُ تصيير Discover لأجل مفتاحِ صوتٍ ثمنٌ بلا مقابل** (D-510).
 */
/* 🔴 **وفعلُ صوتِ الترايلر حُذف** (D-747): **كلُّ فعلٍ خادميٍّ يُعيد
   رسمَ الصفحة** — **فكتابةُ كوكيٍّ لا يقرؤه إلّا أوّلُ رسمٍ كانت تكلّف
   رحلةً ورسماً كاملاً.** **صار يُكتب من المتصفّح**
   (`trailerPrefs.writeTrailerSound`). ⚠️ **ولم يُترك ميّتاً**: **فعلٌ
   لا يُنادى يُقرأ باباً قائماً فيُبنى عليه.** */

export async function setMyRows(raw: string) {
  const { parseMyRows, serializeMyRows, MY_ROWS_COOKIE } = await import("@/lib/myRows");
  const store = await cookies();
  store.set(MY_ROWS_COOKIE, serializeMyRows(parseMyRows(raw)), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/**
 * **«أظهِر من لا أتابعهم» في خطّ النشاط** (D-255، طلبُ أحمد: «نحتاج
 * تضيف خيار إخفاء الأشخاص اللي ما أتابعهم من الأكتيفتي»).
 *
 * **كوكي لا عمود** — نفسُ حكم تفضيلات التبويبات المجاورة له في الورقة
 * نفسِها: **تفضيلُ عرضٍ يخصّ الجهاز، ويُقرأ على الخادم قبل أوّل رسمة**
 * فلا يومض صفٌّ ثم يختفي. ولو صار عموداً لاحتاج نداءَ قاعدةٍ في كل
 * فتحةٍ لسؤالٍ جوابُه في الكوكي.
 *
 * **وافتراضُه السلوكُ القائم** (D-152): الغرباءُ ظاهرون حتى يُطفَأوا —
 * فمن لم يفتح الورقةَ قطُّ لا يتغيّر خطُّه تحته.
 */
export async function setFeedStrangers(show: boolean) {
  const store = await cookies();
  store.set(FEED_STRANGERS_COOKIE, show ? "1" : "0", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/** 🆕 **ترتيبُ خطّ النشاط** (D-306) — كوكي كأخيه فوقه، بالحجّة نفسِها */
export async function setFeedSort(sort: "smart" | "latest") {
  const store = await cookies();
  store.set(FEED_SORT_COOKIE, sort === "latest" ? "latest" : "smart", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/** 🆕 **«النقاشات»: أعمالي المتابَعة فقط** (D-306) */
export async function setTalkFollowedOnly(on: boolean) {
  const store = await cookies();
  store.set(TALK_FOLLOWED_COOKIE, on ? "1" : "0", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/** 🆕 **الترجمةُ التلقائيّة — تشغيلاً وإيقافاً** (D-309) */
export async function setTranslateEnabled(on: boolean) {
  const store = await cookies();
  store.set(TRANSLATE_COOKIE, on ? "1" : "0", {
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

/**
 * 🆕 **تثبيتُ غرفةِ نقاشٍ لي أنا** (D-301، الهجرة ٩٢).
 *
 * **وتوقيعُه توقيعُ `toggleReaction` حرفاً** — `on` لا `pin`/`unpin`:
 * **فعلٌ واحدٌ باتّجاهين** (D-238)، **وفعلان بأسماء مختلفة يتعلّمهما
 * المستدعي مرّتين.**
 *
 * ⚠️ **و`upsert` لا `insert`**: ضغطتان متتاليتان على شبكةٍ بطيئة تنتجان
 * نداءين — **والثاني كان سيسقط بخطأ مفتاحٍ مكرَّر ويومض للقارئ خطأً لا
 * ذنبَ له فيه** (D-047: التراجعُ يُسحب من مكانه بلا حوار).
 *
 * ⚠️ **ولا `revalidatePath`**: تبويبُ «نقاش» يُرتَّب على الخادم،
 * **والحالةُ تفاؤليّةٌ في البطاقة** — **وتجديدُ الصفحة تحت الإصبع يُقفز
 * البطاقةَ من مكانها بينما يقرؤها صاحبُها** (D-008/D-205).
 * **والترتيبُ الجديد يظهر في الفتحة التالية، وهو ما يعنيه «تثبيت».**
 */
export async function toggleRoomPin(input: {
  tmdbId: number;
  mediaType: MediaType;
  on: boolean;
}) {
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);
  const { supabase, user } = await requireUser("pin", 30, 60_000);

  if (input.on) {
    const { error } = await supabase
      .from("title_room_pins")
      .upsert(
        { user_id: user.id, tmdb_id: tmdbId, media_type: mediaType },
        { onConflict: "user_id,tmdb_id,media_type" },
      );
    if (error) fail(error);
  } else {
    const { error } = await supabase
      .from("title_room_pins")
      .delete()
      .match({ user_id: user.id, tmdb_id: tmdbId, media_type: mediaType });
    if (error) fail(error);
  }
}

/**
 * 🆕 **التثبيتُ الإداريّ — للجميع** (D-314، الهجرة ٩٩).
 *
 * **الحارسُ في جسم دالّة القاعدة لا هنا** (D-011/D-193): `rpc` ترفض
 * غيرَ الإدارة بـ`forbidden` مهما قال العميل. **ولا `revalidatePath`**
 * — نفسُ حجّة الدبّوس الشخصيّ: الترتيبُ في الفتحة التالية (D-008).
 */
export async function setGlobalRoomPin(input: {
  tmdbId: number;
  mediaType: MediaType;
  on: boolean;
}) {
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);
  const { supabase } = await requireUser("pin", 30, 60_000);
  const { error } = await supabase.rpc("set_global_room_pin", {
    p_tmdb: tmdbId,
    p_media: mediaType,
    p_on: input.on === true,
  });
  if (error) fail(error);
}

/**
 * 🆕 **تثبيتُ قائمةٍ في صفّ «قائمةُ الأسبوع»** (D-349) — فعلٌ إداريّ.
 *
 * **والحارسُ في جسم دالّة القاعدة لا هنا** (D-011/D-193/D-314):
 * `set_featured_list` ترفع `forbidden` لغير `am_admin()`، **فزرٌّ يُخفى
 * في الواجهة ليس حارساً** — وهذا نفسُ عقد `setGlobalRoomPin` حرفاً.
 */
export async function setFeaturedList(input: { listId: string; on: boolean }) {
  const listId = uuid(input.listId);
  const { supabase } = await requireUser("pin", 30, 60_000);
  const { error } = await supabase.rpc("set_featured_list", {
    p_list: listId,
    p_on: input.on === true,
  });
  if (error) fail(error);
  /* الصفُّ يُقرأ في تبويب القوائم — والتثبيتُ يُرى في أوّل فتحةٍ له */
  revalidatePath("/news");
}

/**
 * 🆕 **معرّفاتُ تصنيفِ العملِ من TMDB** (D-648) — تُكتب في صفّ المتابعة.
 *
 * 🔑 **ولماذا هنا لا في وقت الرسم**: صفحةٌ فيها خمسون عملاً كانت
 * ستطلب خمسين تفصيلاً في كلِّ فتحة (وهو ما تمنعه D-580) — **والمتابعةُ
 * تقع مرّةً واحدةً في عمر الصفّ.**
 *
 * ⚠️ **والنداءُ مخبَّأٌ ساعةً** (`revalidate: 3600` في `tmdb()`)، **ومن
 * تابَع من صفحة العمل فتفصيلُه في الكاش أصلاً** — فالكلفةُ صفرٌ غالباً.
 *
 * ⚠️ **والفشلُ `null` لا `[]`**: `null` تعني «لم تُقرأ بعد» فيلتقطها
 * التعبئةُ الخلفيّة لاحقاً، **والفارغةُ تعني «قُرئت فلم يكن له نوع»**
 * فلا تُعاد المحاولةُ إلى الأبد.
 */
async function genreIdsOf(tmdbId: number, mediaType: MediaType): Promise<number[] | null> {
  try {
    /* ⚠️ **ومهلةٌ صريحةٌ ثانيتين ونصف**: `fetch` بلا مهلةٍ يعلّق الفعلَ
       كلَّه — **وزرُّ متابعةٍ يدور لأن TMDB بطيءٌ اليوم عطلٌ في الميزة
       لا في الشبكة.** **والتصنيفُ زينةُ ترتيبٍ لا شرطُ متابعة**، فالصفُّ
       مكتوبٌ قبل هذا السطر أصلاً **وتُكمله التعبئةُ الخلفيّة.** */
    const d = await Promise.race([
      mediaType === "tv" ? getTv(tmdbId) : getMovie(tmdbId),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ]);
    if (!d) return null;
    return (d.genres ?? []).map((g) => g.id).filter((n) => Number.isInteger(n));
  } catch {
    return null;
  }
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

  /* 🆕 **والتصنيفُ يُكتب بعد المتابعة لا معها** (D-648): **المتابعةُ هي
     الفعلُ، والتصنيفُ أثرُه** — **وفشلُ نداءِ TMDB لا يجوز أن يمنع صفّاً
     طلبه المستخدم.**
     ⚠️ **و`is("genres", null)` تعبئةٌ لا استبدال**: من تابَع عملاً ثمّ
     ألغى ثمّ عاد لا يُمسح تصنيفُه المقروءُ من قبل بنداءٍ فشل اليوم. */
  const genres = await genreIdsOf(input.tmdbId, input.mediaType);
  if (genres) {
    await supabase
      .from("follows")
      .update({ genres })
      .match({ user_id: user.id, tmdb_id: input.tmdbId, media_type: input.mediaType })
      .is("genres", null);
  }
  /* 🆕 D-768: دعوةُ المدعوِّ تُحتسب عند عمله الثالث — الدالةُ تخرج
     فوراً لغير المدعوّ (قراءةُ صفٍّ مفهرسٍ واحد)، وفشلُها لا يمسّ
     المتابعةَ نفسَها فلا نقرأ نتيجتها */
  await supabase.rpc("qualify_referral");
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/${input.mediaType === "tv" ? "show" : "movie"}/${input.tmdbId}`);
}

/**
 * 🆕 **«أضف الكلَّ إلى للمشاهدة» — قائمةٌ كاملةٌ في فعلٍ واحد** (D-495،
 * طلبُ أحمد: «خيار أضف اللستة تو واتش»).
 *
 * 🔑 **والعناصرُ تُقرأ هنا بمعرّف القائمة، لا تُستقبل من العميل**:
 * فعلٌ يقبل مصفوفةَ أعمالٍ من المتصفّح يقبل أيَّ مصفوفة — **والقائمةُ
 * المعلنةُ مقروءةٌ بسياستها، والخاصّةُ لصاحبها**، فالقاعدةُ نفسُها هي
 * التي تقرّر ماذا يُضاف (D-011: الحارسُ في SQL لا في الزرّ).
 *
 * **والكتابةُ صفوفٌ لا حلقة** (D-471): قائمةُ خمسة عشر عملاً كانت
 * ستكون خمسَ عشرةَ رحلة، **وهي `upsert` على مفتاحٍ فريدٍ فالمصفوفةُ
 * تكافئها أثراً** — **والتكرارُ داخل الدفعة يُطوى أوّلاً** لأن Postgres
 * يرفض إصابةَ الصفِّ مرّتين في أمرٍ واحد.
 *
 * ⚠️ **وسقفُ ثلاثمئة**: قائمةُ «أفضل ٢٥٠» موجودةٌ فعلاً، **وفعلٌ بلا
 * سقفٍ يكتب آلافَ الصفوف بضغطةٍ واحدة.**
 *
 * ⚠️ **ولا يمسّ ما شُوهد ولا ما أُوقف**: `upsert` يكتب المتابعةَ وحدَها،
 * **فعملٌ عندك أصلاً يبقى بحالته** ولا يُعاد إلى «لم يبدأ».
 */
export async function followListTitles(listId: string): Promise<number> {
  const id = String(listId ?? "").slice(0, 64);
  const { supabase, user } = await requireUser("list-add-all", 8, 60_000);

  const { data } = await supabase
    .from("user_list_items")
    .select("tmdb_id, media_type, title, poster_path")
    .eq("list_id", id)
    .limit(300);

  const items = (data ?? []) as {
    tmdb_id: number;
    media_type: MediaType;
    title: string | null;
    poster_path: string | null;
  }[];
  if (items.length === 0) return 0;

  const byKey = new Map<string, (typeof items)[number]>();
  for (const it of items) byKey.set(`${it.media_type}-${it.tmdb_id}`, it);

  const rows = [...byKey.values()].map((it) => ({
    user_id: user.id,
    tmdb_id: intId(it.tmdb_id),
    media_type: asMediaType(it.media_type),
    title: String(it.title ?? "").slice(0, 300),
    poster_path: safeImagePath(it.poster_path),
  }));

  await supabase.from("follows").upsert(rows, { onConflict: "user_id,tmdb_id,media_type" });

  /* 🆕 **والقائمةُ نفسُها تدخل** (D-496، طلبُ أحمد: «أضف اللستة تو واتش
     **و تدخل** وتظهر في كونتنيو واتشينج»): **العلامةُ هي الحفظ**، وهي
     ما تقرؤه الرئيسيةُ لترسم بطاقةَ «القائمةُ التي تتابعها».
     **ولا عمودَ جديدٌ ولا هجرة**: الحفظُ قائمٌ منذ D-068، **وما تقوله
     البياناتُ أصلاً لا يُخترع له عمودٌ ثانٍ** (D-217 معكوسةً).
     ⚠️ **ولا يُلغيه شيءٌ هنا**: من ألغى الحفظ بيده أخرج القائمةَ من
     الصفّ — **والزرُّ يُضيف ولا يقرّر بالنيابة مرّتين.** */
  await supabase
    .from("list_saves")
    .upsert({ user_id: user.id, list_id: id }, { onConflict: "user_id,list_id" });

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/lists/${id}`);
  return rows.length;
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

/**
 * 🆕 **تأشيرُ حلقةٍ يُدخل المسلسلَ المكتبةَ** (D-777، سؤالُ أحمد: «هذا
 * المسلسل مثلاً ليه ماهو موجود في المكتبة؟» وحكمُه: «نعم — من أوّل تأشير»).
 *
 * 🔴 **والعطلُ كان صامتاً وقديماً**: المكتبةُ تُبنى من `follows`،
 * **والتأشيرُ يكتب في `watched_episodes` ولا يمسّ `follows`** — **فمن
 * أشّر ٩٢ حلقةً من Arrow لم يكن مسلسلُه في مكتبته**، وصفحةُ العمل تقول
 * «شاهدتَ ٩٢ من ١٧٠» بينما المكتبةُ لا تعرفه. **مقيسٌ في الإنتاج: ٤١
 * زوجاً (مستخدم، عمل) عند ١٢ حساباً، و٣١٦٢ حلقةً خارج المكتبات.**
 *
 * 🔑 **والتأشيرُ إقرارٌ بمتابعةٍ لا لمسةٌ عابرة**: أوّلُ صحٍّ يعلّم كلَّ ما
 * قبله أيضاً (نصُّ الشاشة نفسِها) — **فمن أشّر حلقةً واحدةً قال إنّه
 * يتابع.**
 *
 * ⚠️ **و`ignoreDuplicates` لا استبدال**: من تابَع ثمّ أسقط (`dropped`)
 * ثمّ أشّر حلقةً **لا تُمحى حالتُه** — **ولا `rewatch_count` ولا `genres`
 * ولا `added_at`.** **الصفُّ يُنشأ إن غاب، ولا يُلمس إن حضر.**
 * ⚠️ **ولا نداءَ قراءةٍ قبله**: `on conflict do nothing` جملةٌ واحدةٌ —
 * **والتأشيرُ أعلى فعلٍ تكراراً في التطبيق**، فقراءةٌ تسبق كلَّ ضغطةٍ
 * ثمنٌ لا يُدفع. **والعميلُ يرسل العنوانَ مرّةً واحدةً** (أوّلَ تأشيرٍ
 * وهو غيرُ متابع) فلا تتكرّر الجملةُ مع كلِّ حلقة.
 */
async function ensureShowFollowed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  showTmdbId: number,
  title: string | null | undefined,
  posterPath: string | null | undefined,
) {
  const name = String(title ?? "").trim().slice(0, 300);
  if (!name) return;
  try {
    await supabase.from("follows").upsert(
      {
        user_id: userId,
        tmdb_id: showTmdbId,
        media_type: "tv",
        title: name,
        poster_path: safeImagePath(posterPath ?? null),
      },
      { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
    );
  } catch {
    /* **والتأشيرُ لا يسقط لأنّ الإضافةَ سقطت** — المشاهدةُ محفوظةٌ
       أصلاً، والمكتبةُ تُصلَح في التأشير التالي. */
  }
}

export async function toggleEpisode(input: {
  showTmdbId: number;
  season: number;
  episode: number;
  runtime: number | null;
  watched: boolean;
  /** 🆕 يُرسلان في أوّل تأشيرٍ وحدَه، حين لا يكون متابِعاً (D-777) */
  title?: string | null;
  posterPath?: string | null;
}) {
  const meta = { title: input.title, posterPath: input.posterPath };
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
    await ensureShowFollowed(supabase, user.id, input.showTmdbId, meta.title, meta.posterPath);
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
  /* 🆕 **والمكتبةُ تُبطَل معهما** (D-777): الصفُّ قد يكون وُلد للتوّ */
  if (input.watched) revalidatePath("/library");
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
  /** 🆕 كأختها `toggleEpisode` (D-777) — **البابان يؤدّيان الفعلَ نفسَه** */
  title?: string | null;
  posterPath?: string | null;
}) {
  const meta = { title: input.title, posterPath: input.posterPath };
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
  await ensureShowFollowed(supabase, user.id, input.showTmdbId, meta.title, meta.posterPath);

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/library");
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
  /** 🆕 كأخواتها (D-777) — **ثلاثةُ أبوابٍ للفعل نفسِه، وحارسٌ واحد** */
  title?: string | null;
  posterPath?: string | null;
}) {
  const meta = { title: input.title, posterPath: input.posterPath };
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
  if (input.watched) {
    await ensureShowFollowed(supabase, user.id, input.showTmdbId, meta.title, meta.posterPath);
    revalidatePath("/library");
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/show/${input.showTmdbId}`);
}

/**
 * 🆕 **تأريخُ مشاهدةٍ رجعيٌّ لمواسمَ عُلّمت للتوّ** (D-798، حكمُ أحمد).
 *
 * 🔴 **العطلُ الذي يغلقه**: **Loopz يعرف لحظةَ التعليم لا لحظةَ
 * المشاهدة** — **فمن نقل مكتبتَه دفعةً واحدةً رأى ألفَ حلقةٍ في يومٍ
 * واحدٍ في تقريره** (D-797: «٨٤٢ ساعةً في يومٍ من أربعٍ وعشرين»).
 * **وهذه الدالّةُ تعطي كلَّ حلقةٍ تاريخَ عرضها الأصليَّ** فيصير التقريرُ
 * تقريرَ مشاهدةٍ بحقّ.
 *
 * ⚖️ **والتواريخُ تُقرأ في الخادم لا تُرسَل من المتصفّح**: المواسمُ
 * السابقةُ لا تكون محمّلةً عند القارئ أصلاً (`airedUpTo` تصطنع أرقامَها
 * بلا تواريخ) — **ومتصفّحٌ يُسأل عمّا لا يملك يجيب بالتخمين.**
 * **والخادمُ يملك TMDB وخبيئتَه**، فنداءُ موسمٍ مخبَّأٌ ساعةً.
 *
 * ⚡ **وكتابةٌ واحدةٌ لا ألفٌ**: `upsert` على المفتاح الفريد نفسِه —
 * **وتحديثُ صفٍّ صفٍّ كان ألفَ رحلةِ شبكةٍ لفعلٍ واحد.** **والمدّةُ
 * تُقرأ وتُعاد كما هي** فلا يمحوها التحديث.
 *
 * ⚠️ **وثلاثةُ حرّاسٍ على التاريخ**: **لا مستقبلَ** (حلقةٌ لم تُعرض بعد
 * تبقى بيومها)، **ولا ما قبل ١٩٠٠** (تاريخٌ فاسدٌ في المصدر)، **ومنتصفُ
 * النهار لا منتصفُ الليل** — **فلا ينزلق اليومُ إلى سابقه في منطقةٍ
 * زمنيّةٍ شرقيّة.**
 */
export async function backdateSeasonWatches(input: {
  showTmdbId: number;
  seasons: number[];
}): Promise<{ updated: number }> {
  const showTmdbId = intId(input.showTmdbId);
  const seasons = [...new Set((input.seasons ?? []).slice(0, 60).map((n) => intIn(n, 0, 1000)))];
  if (!seasons.length) return { updated: 0 };

  const { supabase, user } = await requireUser("ep", 30, 60_000);

  const { data: rows, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number, runtime")
    .eq("user_id", user.id)
    .eq("show_tmdb_id", showTmdbId)
    .in("season_number", seasons);
  if (error) fail(error);
  if (!rows?.length) return { updated: 0 };

  const { getSeason } = await import("@/lib/tmdb");
  const airOf = new Map<string, string>();
  await Promise.all(
    seasons.map(async (s) => {
      try {
        const detail = await getSeason(showTmdbId, s);
        for (const e of detail.episodes ?? []) {
          if (e.air_date) airOf.set(`${s}-${e.episode_number}`, e.air_date);
        }
      } catch {
        /* **موسمٌ سقط نداؤه يبقى بتاريخ يومه** — ولا يُخترع له تاريخ (D-063) */
      }
    }),
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const payload: {
    user_id: string;
    show_tmdb_id: number;
    season_number: number;
    episode_number: number;
    runtime: number | null;
    watched_at: string;
  }[] = [];
  for (const r of rows as { season_number: number; episode_number: number; runtime: number | null }[]) {
    const air = airOf.get(`${r.season_number}-${r.episode_number}`);
    if (!air || air > todayIso || air < "1900-01-01") continue;
    payload.push({
      user_id: user.id,
      show_tmdb_id: showTmdbId,
      season_number: r.season_number,
      episode_number: r.episode_number,
      runtime: r.runtime,
      watched_at: `${air}T12:00:00Z`,
    });
  }
  if (!payload.length) return { updated: 0 };

  for (let i = 0; i < payload.length; i += 1000) {
    const { error: writeError } = await supabase
      .from("watched_episodes")
      .upsert(payload.slice(i, i + 1000), {
        onConflict: "user_id,show_tmdb_id,season_number,episode_number",
      });
    if (writeError) fail(writeError);
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/reports");
  revalidatePath(`/show/${showTmdbId}`);
  return { updated: payload.length };
}

/**
 * ============ ترميمُ الأيّام المستحيلة (D-801 — حكمُ أحمد) ============
 *
 * **نصُّه**: «**أيّ يوم عنده ساعات أكثر من ٢٤ ساعة معناته فيه مشكلة —
 * لازم وقت المشاهدة يتغيّر ونحطّه في نفس وقت الإصدار**».
 *
 * 🔑 **والعلّةُ واحدةٌ معروفة**: `watched_at` هو **لحظةُ التعليم** لا
 * لحظةُ المشاهدة — **ومن نقل مكتبتَه في جلسةٍ واحدة كوّم ثمانمئةَ ساعةٍ
 * على يومِ سبتٍ واحد.** **ورقمٌ يقول «٨٣٤ ساعةً في يوم» لا يُصلحه
 * تنسيقٌ ولا صياغة** — **الصفُّ نفسُه خاطئٌ فيُصلَح الصفّ.**
 *
 * ⚖️ **ولا يُمسّ إلّا ما استحال**: الصفوفُ على أيّامٍ دون ٢٤ ساعةً تبقى
 * كما هي — **فمن علّم حلقتين مساءَ أمسِ لم يكذب، ولا حقَّ لي في تاريخه.**
 *
 * ⚖️ **والتاريخُ من TMDB أو لا يتغيّر** (D-063): **ما لا نعرف بثَّه يبقى
 * على يومه ويُعدُّ في `stuck`** — **واختراعُ تاريخٍ ليصغر الرقمُ كذبةٌ
 * أهدأُ من الأولى لا أصدق.**
 *
 * 🕛 **والساعةُ منتصفُ النهار بالضبط** — **وسمُ D-798 نفسُه**: هذه الصفوفُ
 * تعرف يومَها ولا تعرف ساعتَها، **فتُستبعد من خريطة الحرارة ومن وقت
 * الذروة** بدل أن تملأهما بوسمِ نظام.
 *
 * ⚙️ **وميزانيّةُ النداءات محدودةٌ في كلِّ جولة**: **مكتبةٌ من مئة موسمٍ
 * لا تُنادى دفعةً واحدةً على مهلة الخادم** — فتُصلَح الأكبرُ أوّلاً
 * ويُعاد الباقي في `remaining`، **والزرُّ يقول للقارئ أنّ عليه ضغطةً
 * أخرى** بدل أن يصمت عن نصف العمل (D-217).
 */
const DAY_MINUTES = 1440;
const SEASON_BUDGET = 40;
const MOVIE_BUDGET = 40;

/**
 * **منطقةُ القارئ الزمنيّة تُكتب مرّةً** (D-806).
 *
 * ⚠️ **ولا بياناتٍ شخصيّةً جديدة**: اسمُ منطقةٍ من قائمة IANA — **لا
 * موقعَ ولا إحداثيّاتٍ** — **وهو ما يقرؤه كلُّ موقعٍ من `Intl` أصلاً.**
 * ⚠️ **والحَكَمُ `asTimeZone`**: ما لا تقبله المنصّةُ يسقط إلى غرينتش،
 * **فلا يدخل العمودَ نصٌّ من عند المستدعي.**
 */
export async function setTimezone(raw: string): Promise<void> {
  const { supabase, user } = await requireUser("tz", 6, 60_000);
  const { asTimeZone, UTC } = await import("@/lib/zone");
  const tz = asTimeZone(raw);
  if (tz === UTC) return;
  const { error } = await supabase.from("profiles").update({ timezone: tz }).eq("id", user.id);
  if (error) fail(error);
  revalidatePath("/reports");
  revalidatePath("/statistics");
}

export async function repairImpossibleDays(): Promise<{
  moved: number;
  remaining: number;
  stuck: number;
}> {
  const { supabase, user } = await requireUser("repair", 4, 60_000);
  const { runtimeMinutes } = await import("@/lib/watchTime");

  /* ═══ ١ — كلُّ التاريخ، فالاستحالةُ لا تعرف حدودَ فترة ═══ */
  type Ep = {
    show_tmdb_id: number;
    season_number: number;
    episode_number: number;
    runtime: number | null;
    watched_at: string;
  };
  type Mv = { movie_tmdb_id: number; runtime: number | null; watched_at: string };

  const eps: Ep[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await supabase
      .from("watched_episodes")
      .select("show_tmdb_id, season_number, episode_number, runtime, watched_at")
      .eq("user_id", user.id)
      .range(from, from + 999);
    if (error) fail(error);
    if (!data?.length) break;
    eps.push(...(data as Ep[]));
    if (data.length < 1000) break;
  }
  const { data: movieData, error: movieError } = await supabase
    .from("watched_movies")
    .select("movie_tmdb_id, runtime, watched_at")
    .eq("user_id", user.id);
  if (movieError) fail(movieError);
  const mvs = (movieData ?? []) as Mv[];

  /* ═══ ٢ — أيُّ يومٍ تجاوز اليومَ نفسَه ═══ */
  const byDay = new Map<string, number>();
  const add = (iso: string, mins: number) =>
    byDay.set(iso.slice(0, 10), (byDay.get(iso.slice(0, 10)) ?? 0) + mins);
  for (const e of eps) add(e.watched_at, runtimeMinutes("episode", e.runtime));
  for (const m of mvs) add(m.watched_at, runtimeMinutes("movie", m.runtime));
  const badDays = new Set([...byDay].filter(([, v]) => v > DAY_MINUTES).map(([d]) => d));
  if (badDays.size === 0) return { moved: 0, remaining: 0, stuck: 0 };

  const badEps = eps.filter((e) => badDays.has(e.watched_at.slice(0, 10)));
  const badMvs = mvs.filter((m) => badDays.has(m.watched_at.slice(0, 10)));

  /* ═══ ٣ — الأكبرُ أوّلاً: موسمٌ فيه ثمانون حلقةً قبل موسمٍ فيه اثنتان ═══ */
  const seasonCount = new Map<string, number>();
  for (const e of badEps) {
    const k = `${e.show_tmdb_id}:${e.season_number}`;
    seasonCount.set(k, (seasonCount.get(k) ?? 0) + 1);
  }
  const seasonsRanked = [...seasonCount].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const seasonsNow = seasonsRanked.slice(0, SEASON_BUDGET);
  const moviesRanked = [...new Set(badMvs.map((m) => m.movie_tmdb_id))];
  const moviesNow = moviesRanked.slice(0, MOVIE_BUDGET);
  const remaining =
    seasonsRanked.length - seasonsNow.length + (moviesRanked.length - moviesNow.length);

  const { getSeason, getMovie } = await import("@/lib/tmdb");
  const airOf = new Map<string, string>();
  const releaseOf = new Map<number, string>();
  await Promise.all([
    ...seasonsNow.map(async (k) => {
      const [show, season] = k.split(":").map(Number);
      try {
        const detail = await getSeason(show, season);
        for (const e of detail.episodes ?? []) {
          if (e.air_date) airOf.set(`${show}:${season}:${e.episode_number}`, e.air_date);
        }
      } catch {
        /* **نداءٌ سقط يترك صفَّه على يومه** — ولا يُخترع له تاريخ (D-063) */
      }
    }),
    ...moviesNow.map(async (id) => {
      try {
        const m = await getMovie(id);
        if (m.release_date) releaseOf.set(id, m.release_date);
      } catch {
        /* كما فوق */
      }
    }),
  ]);

  /* ═══ ٤ — الصفوفُ الجديدة، ولا صفَّ يُكتب ليبقى مكانَه ═══ */
  const today = new Date().toISOString().slice(0, 10);
  const usable = (d: string | undefined, was: string) =>
    !!d && d <= today && d >= "1900-01-01" && d !== was.slice(0, 10);

  const epPayload: {
    user_id: string;
    show_tmdb_id: number;
    season_number: number;
    episode_number: number;
    runtime: number | null;
    watched_at: string;
  }[] = [];
  let stuck = 0;
  for (const e of badEps) {
    const air = airOf.get(`${e.show_tmdb_id}:${e.season_number}:${e.episode_number}`);
    if (!usable(air, e.watched_at)) {
      if (!air) stuck += 1;
      continue;
    }
    epPayload.push({
      user_id: user.id,
      show_tmdb_id: e.show_tmdb_id,
      season_number: e.season_number,
      episode_number: e.episode_number,
      runtime: e.runtime,
      watched_at: `${air}T12:00:00Z`,
    });
  }
  const mvPayload: {
    user_id: string;
    movie_tmdb_id: number;
    runtime: number | null;
    watched_at: string;
  }[] = [];
  for (const m of badMvs) {
    const rel = releaseOf.get(m.movie_tmdb_id);
    if (!usable(rel, m.watched_at)) {
      if (!rel) stuck += 1;
      continue;
    }
    mvPayload.push({
      user_id: user.id,
      movie_tmdb_id: m.movie_tmdb_id,
      runtime: m.runtime,
      watched_at: `${rel}T12:00:00Z`,
    });
  }

  for (let i = 0; i < epPayload.length; i += 1000) {
    const { error } = await supabase
      .from("watched_episodes")
      .upsert(epPayload.slice(i, i + 1000), {
        onConflict: "user_id,show_tmdb_id,season_number,episode_number",
      });
    if (error) fail(error);
  }
  if (mvPayload.length) {
    const { error } = await supabase
      .from("watched_movies")
      .upsert(mvPayload, { onConflict: "user_id,movie_tmdb_id" });
    if (error) fail(error);
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/reports");
  revalidatePath("/statistics");
  return { moved: epPayload.length + mvPayload.length, remaining, stuck };
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
): Promise<{ rating: number | null; review: string | null; hasSpoiler: boolean }> {
  try {
    const { getMyRating } = await import("@/lib/data");
    const row = await getMyRating(intId(tmdbId), asMediaType(mediaType));
    return {
      rating: row?.rating ?? null,
      review: row?.review ?? null,
      /* 🆕 D-315 — يعود مع الصفّ كي لا تُسقط إعادةُ الحفظ إعلاناً قائماً */
      hasSpoiler: Boolean(row?.has_spoiler),
    };
  } catch {
    // فشلُ القراءة لا يمنع التقييم — الورقة تُفتح فارغةً والحفظ يعمل
    return { rating: null, review: null, hasSpoiler: false };
  }
}

export async function saveRating(input: {
  tmdbId: number;
  mediaType: MediaType;
  rating: number;
  review: string;
  title: string;
  posterPath: string | null;
  /**
   * 🆕 **غلافُ العمل العريض** (D-313، الهجرة ٩٨) — لبطاقة «أعلى
   * التعليقات». **اختياريٌّ عمداً**: من لا يملكه (بطاقةُ المتابعة) لا
   * يُجبر عليه، **وغيابُه لا يكتب `null` فوق قيمةٍ قائمة** — انظر
   * الإدراج.
   */
  backdropPath?: string | null;
  /**
   * 🆕 **«رسالتي فيها حرق» في الريفيو** (D-315، الهجرة ١٠٠) — إعلانُ
   * الكاتب لا استنتاجُنا (D-268)، **ويُكتب دائماً**: العَلَمُ جزءُ
   * الحفظ نفسِه، ومن حفظ بلا إعلانٍ فقد أسقطه.
   */
  hasSpoiler?: boolean;
}) {
  input = {
    ...input,
    tmdbId: intId(input.tmdbId),
    mediaType: asMediaType(input.mediaType),
    title: String(input.title ?? "").slice(0, 300),
    posterPath: safeImagePath(input.posterPath),
    backdropPath:
      input.backdropPath === undefined ? undefined : safeImagePath(input.backdropPath),
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
      /* **حقلٌ غائبٌ لا يُكتب** (D-152): إعادةُ حفظٍ من سطحٍ لا يملك
         الغلافَ تُبقي ما كتبه سطحٌ يملكه */
      ...(input.backdropPath !== undefined ? { backdrop_path: input.backdropPath } : {}),
      /* 🆕 D-315 — والعَلَمُ يُكتب دائماً: هو جزءُ الرأي لا زينتُه */
      has_spoiler: input.hasSpoiler === true,
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
/**
 * نوع إشارة الجرس — ما ترجعه `my_signals` (D-125).
 *
 * **و`reply` خامسُها** (D-218، هجرة ٧١): **من رُدَّ عليه كان لا يعلم
 * أبداً، فتموت المحادثةُ عند دورها الأول.** وتغطّي الحالتين — ردٌّ على
 * رأيك وردٌّ على ردّك — **بنوعٍ واحد لأن الجملة واحدة**.
 *
 * ⚠️ **والشيفرةُ تسبق هجرتَها بلا ضرر:** قبل ٧١ لا يعود صفُّ `reply`
 * أصلاً، **فنوعٌ زائدٌ في الشيفرة لا يُظهر شيئاً** — والخطرُ المعاكس
 * (صفٌّ بنوعٍ لا تعرفه الواجهة) هو ما يُحرس منه في الرسم.
 */
export type SignalKind =
  | "follow"
  | "request"
  | "like_review"
  | "like_activity"
  | "reply"
  /**
   * **ردٌّ عليك داخل غرفة نقاش** (D-259، الهجرة ٧٩).
   *
   * ⚠️ **ونوعٌ سادسٌ لا عَلَمٌ على `reply`**: **النوعُ في هذا الجرس وجهةٌ
   * قبل أن يكون جملة** (D-218) — `reply` تفتح صفحةَ تعليقك (`/review/…`)
   * **وهذا يفتح الغرفة**. **ونوعٌ واحدٌ بوجهتين كان سيرسل نصفَ الإشعارات
   * إلى صفحةٍ لا يوجد فيها ما رُدَّ عليه** — وهو بعينه ما صحّحته D-257.
   */
  | "talk_reply"
  /**
   * 🆕 **قيّم أحدٌ قائمتَك أو كتب عنها** (الهجرة ١٠٦ — الخيطُ الثالث).
   *
   * **ونوعٌ سابعٌ لا `like_review` بعَلَم**: النوعُ في هذا الجرس **وجهةٌ
   * قبل أن يكون جملة** (D-218/D-259) — **وهذا وحدَه يفتح `/lists/<id>`**،
   * ولا `tmdb_id` له أصلاً. **ونوعٌ واحدٌ بوجهتين يرسل نصفَ الإشعارات
   * إلى صفحةٍ لا يوجد فيها ما أُشعِر به.**
   */
  | "list_review"
  /**
   * 🆕 **أعجبه رأيُك في قائمة** (الهجرة ١١٤ — دَينُ D-370 المعلَن).
   *
   * **ونوعٌ ثامنٌ لا `like_review` بعَلَم**: النوعُ هنا **وجهةٌ قبل أن
   * يكون جملة** (D-218/D-259) — `like_review` تعرف `tmdb_id` وتفتح صفحةَ
   * العمل، **وهذا لا `tmdb_id` له أصلاً ويفتح `/lists/<id>`**.
   */
  | "like_list_review"
  /**
   * 🆕 **ردَّ أحدٌ على رأيك في قائمة** (الهجرة ١١٤).
   *
   * **ويغطّي الحالتين — ردٌّ على رأيك وردٌّ على ردّك — بنوعٍ واحدٍ لأن
   * الجملةَ واحدةٌ والوجهةَ واحدة** (نصُّ `reply` في ٧١ حرفاً).
   */
  | "list_reply";

export interface Signal {
  kind: SignalKind;
  person: PersonLite;
  tmdbId: number | null;
  mediaType: "tv" | "movie" | null;
  title: string | null;
  at: string;
  isNew: boolean;
  /** 🆕 وجهةُ إشعار القائمة (الهجرة ١٠٦) — تغيب لكلِّ نوعٍ آخر */
  listId?: string | null;
  /** slug قائمةِ لوبز — الاسمُ يُترجَم عند العرض (D-328) */
  listSlug?: string | null;
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
  const signals = ((data ?? []) as {
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
    /* 🆕 ذيلُ الهجرة ١٠٦ — يغيب قبلها فيُقرأ `null` (D-028) */
    list_id?: string | null;
    list_slug?: string | null;
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
    listId: r.list_id ?? null,
    listSlug: r.list_slug ?? null,
  }));
  /* 🆕 **والشخصُ متداخلٌ هنا** (D-773ب) — فالإلحاقُ يدخل `person` نفسَه */
  return withPersonIdentities(signals);
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
  const rows = ((data ?? []) as { user_id: string; username: string | null; nickname: string | null; avatar_url: string | null; hide_name: boolean | null }[]).map((r) => ({
    id: r.user_id,
    username: r.username,
    nickname: r.nickname,
    avatar_url: r.avatar_url,
    hide_name: r.hide_name,
  })) as PersonLite[];
  return withIdentities(rows);
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

/* 🔴 **حُذف `createCommunity`** (D-306، نصُّ أحمد: «احنا حاذفين الكومينتي
   فالمفروض ما أحد يقدر يأسس كومينتي جديد») — **سقط قرّاؤه فسقط** (D-214).
   **⚠️ ودالّةُ `create_community` في القاعدة بابٌ ثانٍ ما زال مفتوحاً
   تقنيّاً** — **وإغلاقُه يمسّ ما هو خارج الإذن الدائم، فيُعرض على أحمد
   قبل تشغيله.** */

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

/**
 * غرفة عملٍ عند أوّل اهتمام (D-140، هجرة 53) — تُرجع معرّف الغرفة.
 *
 * ⚠️ **ولا قارئَ لها في الواجهة اليوم** (D-398): بابُها كان
 * `TitleRoomLink` في صفحة العمل، **وسقط حين صار تبويبُ المجتمع خطَّ
 * الآراء والنقاش والأخبار.** **وتُركت حيّةً عمداً لا سهواً**: حذفُها
 * يعني أن غرفَ الأعمال لا تُولد أبداً بعد اليوم، **وذاك قرارُ مالكٍ لا
 * قرارُ تنظيف** — وهو بندٌ مفتوحٌ في `05_Todo.md`.
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
  const { airedPerSeason, firstEpisodeOf } = await import("@/lib/progress");

  const done = items.filter((it) => it.progress === "done");

  /* الأفلام كلُّها upsert واحد لا رحلةً لكلِّ فيلم: الصفوفُ مستقلّة
     والمفتاحُ فريد، فالدفعةُ تكافئ الأفراد أثراً وتوفّر الرحلات. */
  const movieRows = done
    .filter((it) => it.mediaType === "movie")
    .map((it) => ({ user_id: user.id, movie_tmdb_id: it.tmdbId, runtime: null }));
  if (movieRows.length) {
    await supabase
      .from("watched_movies")
      .upsert(movieRows, { onConflict: "user_id,movie_tmdb_id" });
  }

  /* المسلسلاتُ كانت تسلسلاً خالصاً: ٢٤ عملاً في كلٍّ منها `getTv` ثم
     `getSeason` **لكلِّ موسمٍ على حدة** — مئتا رحلة TMDB متعاقبة تجعل
     شاشةَ الانضمام تنتظر دقائق. الآن مواسمُ المسلسل تُجلب معاً،
     والمسلسلاتُ خمسةً خمسة (سقفُ تهذيبٍ لنقطة TMDB لا سقفُ صحّة —
     الأفعال upsert مستقلّة). وفشلُ الواحد لا يوقف البقيّة كما كان. */
  const shows = done.filter((it) => it.mediaType === "tv");
  const SHOWS_AT_ONCE = 5;
  for (let s = 0; s < shows.length; s += SHOWS_AT_ONCE) {
    await Promise.all(
      shows.slice(s, s + SHOWS_AT_ONCE).map(async (it) => {
        try {
          const tv = await getTv(it.tmdbId);
          const aired = airedPerSeason(tv);
          /* 🔴 🆕 بقيّةُ D-603 (انكشفت يومَ الهجرة ١٣٣): الاستيرادُ
             كان يكتب من ١ في كلِّ موسم — ففي العمل المطلق كان سيزرع
             أشباحاً نسبيّةً بسلالة صفوف خالد بعينها */
          const firstOf = firstEpisodeOf(tv);
          const seasons = [...aired].filter(([, count]) => count > 0);
          const details = await Promise.all(
            seasons.map(([season]) => getSeason(it.tmdbId, season).catch(() => null)),
          );

          const rows: {
            user_id: string;
            show_tmdb_id: number;
            season_number: number;
            episode_number: number;
            runtime: number | null;
          }[] = [];
          seasons.forEach(([season, count], i) => {
            const detail = details[i];
            const first = firstOf.get(season) ?? 1;
            for (let k = 0; k < count; k++) {
              /* رقمُ النافذة الحقيقيّ — وتفاصيلُ الموسم في TMDB تحمل
                 الأرقامَ نفسَها فبحثُ مدّة الحلقة يصيب في الحالين */
              const e = first + k;
              const ep = detail?.episodes.find((x) => x.episode_number === e);
              rows.push({
                user_id: user.id,
                show_tmdb_id: it.tmdbId,
                season_number: season,
                episode_number: e,
                runtime: ep?.runtime ?? tv.episode_run_time?.[0] ?? null,
              });
            }
          });

          // دفعات حتى لا يُرفض الطلب لضخامته
          for (let i = 0; i < rows.length; i += 500) {
            await supabase.from("watched_episodes").upsert(rows.slice(i, i + 500), {
              onConflict: "user_id,show_tmdb_id,season_number,episode_number",
            });
          }
        } catch {
          // مسلسل واحد فشل لا يوقف البقية
        }
      }),
    );
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
/**
 * 🆕 **إنشاءُ قائمةٍ ذكيّة** (D-823 · الهجرة ١٦١) — **قائمةٌ شرطُها في
 * صفِّها تملأ نفسَها من كتالوج Loopz.**
 *
 * 🔑 **وبابُها «اكتشف» لا شاشةُ القوائم**: **الشرطُ يُبنى حيث تُبنى
 * الفلاتر** — **وشاشةُ إنشاءٍ تسأل عن نوعٍ ولغةٍ وسنةٍ هي ورقةُ فلاترَ
 * ثانيةٌ بلغةٍ ثانية** (D-145).
 *
 * 🔒 **وبلس** — **والحارسُ هنا لا في الرقاقة** (D-819/D-821).
 * ⚠️ **والشرطُ يُطهَّر في الخادم**: **العميلُ يُقترح والخادمُ يقرّر.**
 */
export async function createSmartList(
  name: string,
  rule: unknown,
): Promise<{ id: string | null; needsPlus?: true }> {
  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) throw new Error("empty name");
  const { sanitizeRule } = await import("@/lib/smartLists");
  const clean_rule = sanitizeRule(rule);
  /* 🔴 **وقائمةٌ ذكيّةٌ بلا شرطٍ فارغةٌ إلى الأبد** — **والقاعدةُ تمنعها
     في القاعدة (١٦١)، وهذا حارسُها قبل أن تصل إليها** (D-636). */
  if (!clean_rule) throw new Error("empty rule");

  const { supabase, user } = await requireUser("list", 10, 60_000);
  if (!(await viewerIsPlus())) return { id: null, needsPlus: true };

  const { count } = await supabase
    .from("user_lists")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= 50) throw new Error("too many lists");

  const { data, error } = await supabase
    .from("user_lists")
    .insert({
      user_id: user.id,
      name: clean,
      is_public: false,
      kind: "smart",
      rule: clean_rule,
      /* **`catalog` وحدَها في هذه الدفعة** — و`library` يقبلها القيدُ
         ولا يبنيها أحد (D-818: رابطٌ يعني شيئين لكلِّ فاتحٍ ليس رابطاً). */
      rule_source: "catalog",
    })
    .select("id")
    .single();
  if (error) fail(error);

  revalidatePath("/lists");
  revalidatePath("/library");
  return { id: data?.id ?? null };
}

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
    /* 🆕 **وحاويةُ المفضّلة لا تُعاد تسميتُها** (D-860، عطلُ خالد):
       **المفضّلةُ صفٌّ في `user_lists` بعلامة `kind='favorites'`**
       (هجرة ٥٥) **واسمُها للتطبيق لا للمستخدم** — يُولَّد بلغة الواجهة
       عند أوّل قلب.
       🔴 **والعطلُ الذي أغلقه**: `listsForDisplay` تُسقط `favorites` من
       `/library` و`/lists` معاً (D-374: للمفضّلة بابُها الخاصّ)،
       **ومنتقي «أضف إلى قائمة» لا يُصفّي عمداً** — **فمن أعاد تسميتَها
       إلى اسمٍ يشبه القوائم رآها في المنتقي وفقدها من مكتبته**، وظنّ
       قائمتَه ضاعت. **والحارسُ هنا في الباب لا في القشرة** (D-011):
       صفُّ المفضّلة لا يُطابَق أصلاً فلا يُحدَّث. */
    .neq("kind", "favorites")
    .select("id");
  if (error) fail(error);
  if (!data?.length)
    throw new Error(
      "القائمة غير موجودة، أو هي قائمة المفضّلة ولا يُعاد تسميتها / List not found, or it is the favourites list which cannot be renamed",
    );
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
/**
 * 🆕 **رايةُ قائمة التشغيل** (D-505، طلبُ أحمد: «يعمل لليست بلاي ليست
 * وتظهر في كنتنيو واتش»). **كاتبٌ واحدٌ للعمود** (D-462)، وشرطُ
 * الملكية صريحٌ في الاستعلام كأشقّائه — تعديلٌ لم يصب شيئاً يفشل بصوت.
 */
export async function setListPlaylist(listId: string, on: boolean) {
  listId = uuid(listId);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_lists")
    .update({ is_playlist: !!on, updated_at: new Date().toISOString() })
    .eq("id", listId)
    .eq("user_id", user.id)
    .select("id");
  if (error) fail(error);
  if (!data?.length) throw new Error("القائمة غير موجودة / List not found");
  revalidatePath(`/lists/${listId}`);
  /* البطاقةُ تسكن الرئيسيةَ — فتتجدّد في الضغطة نفسِها لا في زيارةٍ لاحقة */
  revalidatePath("/");
  /* 🆕 **وصار للرايةِ مفتاحٌ على البطاقة نفسِها** (D-563) — **فالسطحان
     اللذان يعرضانه يتجدّدان معه**: تبويبُ القوائم في المكتبة وصفحةُ
     `/lists`. **ومفتاحٌ يُقلَب ولا يتبدّل جارُه عند الرجوع يُقرأ عطلاً.** */
  revalidatePath("/library");
  revalidatePath("/lists");
}

/**
 * 🆕 **رايةُ التشغيل على قائمةٍ حفظتَها من غيرك** (D-674، حكمُ أحمد:
 * «نعم الكل له مفتاح تشغيل و إيقاف»، الهجرة ١٤٩).
 *
 * 🔑 **وكاتبٌ ثانٍ لا لأن الفعلَ اثنان بل لأن المالكَ اثنان** (D-462):
 * `setListPlaylist` تكتب **صفةَ القائمة** ولا يملكها إلا صاحبُها،
 * **وهذه تكتب صفَّ حفظِك أنت** — **ولو كتبنا الأولى على قائمة غيرك
 * لقلبتَ رايتَه على كلِّ الناس.** **والمعنى في الواجهة واحد**، ولذلك
 * الرقاقةُ واحدةٌ والمكوّنُ واحد.
 *
 * ⚠️ **ولا حاجةَ لشرطٍ على ملكيّة القائمة هنا**: الصفُّ لا يوجد أصلاً
 * إلا لقائمةٍ عامّةٍ ليست لك (`with check` في سياسة `list_saves`)،
 * **وتعديلٌ لم يصب شيئاً يفشل بصوت** كأشقّائه.
 */
export async function setSavedListPlaylist(listId: string, on: boolean) {
  listId = uuid(listId);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("list_saves")
    .update({ is_playlist: !!on })
    .eq("list_id", listId)
    .eq("user_id", user.id)
    .select("list_id");
  if (error) fail(error);
  if (!data?.length) throw new Error("القائمة غير محفوظة / List not saved");
  /* **نفسُ أسطح `setListPlaylist` حرفاً** — البطاقةُ واحدةٌ فيها كلِّها */
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/lists");
}

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
 * 🆕 **ترتيبُ صفوف قسمٍ في ملفّك** (D-581، طلبُ أحمد: «هذي العلامة
 * حطّها في كل شي في المفضّلة — وكل شي أقدر أرتّبه»).
 *
 * **الكتابةُ في `profile_prefs.sectionOrder` لا في جداول المصدر** —
 * الحجّةُ عند الحقل في `profilePrefs.ts`. **وقراءةٌ ثم دمجٌ ثم كتابة**
 * لأن العمود jsonb واحدٌ يحمل تفضيلاتٍ أخرى، **وكتابةُ المفتاح وحدَه
 * كانت ستمحو أخوتَه.** والتنقيةُ بمرشِّح القراءة نفسِه
 * (`sanitizeProfilePrefs`) — **قيمةٌ تمرّ عبر الشبكة تُنقّى قبل الكتابة
 * كما تُنقّى بعد القراءة** (عُرفُ `updateProfile` بحرفه).
 */
export async function saveProfileSectionOrder(section: string, keys: string[]) {
  if (!(SORTABLE_SECTIONS as readonly string[]).includes(section))
    throw new Error("قسمٌ غير معروف / Unknown section");
  const { supabase, user } = await requireUser("profile", 30, 60_000);

  const { data, error } = await supabase
    .from("profiles")
    .select("profile_prefs")
    .eq("id", user.id)
    .maybeSingle();
  if (error) fail(error);

  const prefs = sanitizeProfilePrefs(data?.profile_prefs);
  prefs.sectionOrder = sanitizeProfilePrefs({
    ...prefs,
    sectionOrder: { ...prefs.sectionOrder, [section]: keys },
  }).sectionOrder;

  const { error: writeError } = await supabase
    .from("profiles")
    .update({ profile_prefs: prefs })
    .eq("id", user.id);
  if (writeError) fail(writeError);
}

/**
 * 🆕 **رايةُ قسم «القوائم المحفوظة» في ملفّك** (D-594، حكمُ أحمد:
 * «حتى هذي حطّ لها on off») — **قراءةٌ فدمجٌ فكتابة** كأختها أعلاه
 * حرفاً: العمودُ jsonb واحدٌ يحمل تفضيلاتٍ أخرى، **وكتابةُ المفتاح
 * وحدَه كانت ستمحو أخوتَه.**
 */
export async function setProfileSavedLists(on: boolean) {
  const { supabase, user } = await requireUser("profile", 30, 60_000);

  const { data, error } = await supabase
    .from("profiles")
    .select("profile_prefs, plan, plus_until")
    .eq("id", user.id)
    .maybeSingle();
  if (error) fail(error);

  /* 🔴 🆕 **وإظهارُ أقسام الملفّ من البلس** (D-791) — كأختها أعلاه */
  if (!isPlus(data)) return;

  const prefs = sanitizeProfilePrefs(data?.profile_prefs);
  prefs.savedLists = on === true;

  const { error: writeError } = await supabase
    .from("profiles")
    .update({ profile_prefs: prefs })
    .eq("id", user.id);
  if (writeError) fail(writeError);
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
  /**
   * 🗑️ **ولونُ الغلاف سقط** (D-848، حكمُ أحمد: «والألوان اللي عند
   * اللستة احذفها») — **والوسيطُ يُقبل ولا يُقرأ لِرفعةٍ واحدة**
   * (`19` §٢): **الورقةُ تُرسله `null` منذ اليوم**، **ويُحذف بعدها.**
   */
  color?: string | null;
}) {
  const listId = uuid(input.listId);
  const backdrop = safeImagePath(input.backdropPath);
  /* 🗑️ **والعمودُ يُكتب فارغاً دائماً** (D-848): **صفٌّ قديمٌ يحمل
     لوناً يُنظَّف عند أوّل حفظِ غلاف** — **ولا قارئَ له بعد اليوم.**
     ⚠️ **والعمودُ يبقى في الجدول**: **حذفُ عمودٍ يسبق حذفَ قرّائه من
     المنشور خسارةُ بياناتٍ بلا رجعة** (D-214/D-538) — **يُسقَط في
     هجرةٍ بعد أن يستقرّ هذا.** */
  /* لا خلفيةَ = لا نسب: الحقولُ الثلاثة تُمحى معاً فلا يبقى معرّفٌ
     معلّقٌ بلا صورة */
  const tmdbId = backdrop && input.tmdbId ? intId(input.tmdbId) : null;
  const mediaType = backdrop && input.mediaType ? asMediaType(input.mediaType) : null;

  const { supabase, user } = await requireUser("art", 30, 60_000);
  /* 🔒 **واللونُ وحدَه بلس** (قاعدةُ D-783 §٣: القائمُ مجّانيٌّ والجديدُ
     بلس) — **والغلافُ الصوريُّ يبقى مجّانيّاً كما كان منذ D-208.**
     🔑 **والحارسُ هنا لا في الورقة** (D-819/D-821): **حارسُ العميل زينةٌ
     حين يُنادى الفعلُ بلا سطحِه.** ⚠️ **والسؤالُ لا يُطرح إلّا حين
     يُطلب لون** — **فلا يدفع رافعُ صورةٍ ثمنَ استعلامٍ لا يخصّه** (D-515). */

  const { data, error } = await supabase
    .from("user_lists")
    .update({
      cover_backdrop: backdrop,
      cover_tmdb_id: tmdbId,
      cover_media_type: mediaType,
      cover_color: null,
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
  return { ok: true as const };
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



/**
 * 🆕 **توليدُ مجموعةٍ منسّقةٍ كقائمةٍ حقيقيّةٍ بحساب لوبز** (D-328،
 * الهجرة ١٠٤ — طلبُ أحمد: «أي ليست أقدر أقسمها وأقدر أكتب عليها تعليق»).
 *
 * **ولا محرّكَ ثانياً**: نفسُ خطوات `createListFromUniverse` حرفاً
 * (D-135/D-145) — والفرقُ **مَن يملك الصفّ**: هناك القارئُ نفسُه،
 * **وهنا حسابُ لوبز عبر دالّة `definer` لأن أحداً لا يكتب في حساب غيره.**
 *
 * **وبها تصير المجموعةُ قائمةً كسائر القوائم**: صفحةٌ ورابطٌ ومشاركةٌ
 * وقلبٌ **وتقييمٌ وتعليقات** (D-327) — **بلا سطحٍ رابعٍ ولا جدولٍ ثانٍ.**
 *
 * ⚠️ **والاسمُ عربيٌّ عند التوليد** — والقائمةُ تحمل `source_slug` فيمكن
 * ترجمةُ اسمها عند العرض لاحقاً من `universes.ts` (D-147). **ودَينٌ
 * يُعلَن لا يُكتشف.**
 *
 * ⚠️ **وإداريٌّ وحدَه** — الحارسُ في جسم دالّة القاعدة (`am_admin()`
 * من D-314)، **والواجهةُ لا تعرض هذا الفعل لأحد**: يُنادى من الجلسة.
 */
export async function buildCuratedList(slug: string): Promise<{ slug: string; listId: string; items: number }> {
  const clean = String(slug ?? "").trim().toLowerCase();
  const { universeBySlug, universeName } = await import("@/lib/universes");
  const u = universeBySlug(clean);
  if (!u) throw new Error("عالمٌ غير معروف / Unknown universe");

  const { supabase } = await requireUser("curated", 20, 60_000);
  const { moviesByIds, resolveSetIds, awardWinners, titleOf } = await import("@/lib/tmdb");

  let items: NewItem[] = [];
  let kind: "watch_order" | "ranked" = "watch_order";

  if (u.award) {
    const rows = await awardWinners(u.award);
    kind = "ranked";
    items = rows.map((r) => ({
      tmdbId: r.id,
      mediaType: (r.media_type === "tv" ? "tv" : "movie") as MediaType,
      title: titleOf(r),
      posterPath: r.poster_path,
    }));
  } else if (u.top) {
    const rows = await (await import("@/lib/topChart")).topChartRows(u.top, u.topLimit ?? 250);
    kind = "ranked";
    items = rows.map((r) => ({
      tmdbId: r.id,
      mediaType: (r.media_type === "tv" ? "tv" : "movie") as MediaType,
      title: titleOf(r) || r.title || r.name || "",
      posterPath: r.poster_path,
    }));
  } else {
    const ids = await resolveSetIds(u);
    /* 🆕 **والقائمةُ المشهورة مرتَّبةٌ لا مسارُ مشاهدة** (D-388): رتبتُها
       معناها، **فتُحفظ `ranked` كالجوائز و«أفضل ٢٥٠»** لا `watch_order`. */
    if (u.titles?.length) kind = "ranked";
    const movies = await moviesByIds(ids);
    items = movies.map((m) => ({
      tmdbId: m.id,
      mediaType: "movie" as MediaType,
      title: m.title,
      posterPath: m.poster_path,
    }));
  }

  /* **الفراغُ لا يُكتب**: قائمةٌ منسّقةٌ فارغةٌ بحساب لوبز أسوأ من غيابها
     — **والمصدرُ قد يسقط لحظةً** (D-063). */
  if (!items.length) throw new Error("تعذّر تحميل القائمة / Could not load this list");

  const { data, error } = await supabase.rpc("upsert_curated_list", {
    p_slug: clean,
    p_name: universeName(u, "ar").slice(0, 60),
    p_kind: kind,
    p_items: items.map((i) => ({
      tmdbId: i.tmdbId,
      mediaType: i.mediaType,
      title: (i.title ?? "").slice(0, 200),
      posterPath: i.posterPath ?? null,
    })),
  });
  if (error) fail(error);
  revalidatePath("/news");
  return { slug: clean, listId: String(data), items: items.length };
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
/**
 * 🆕 **إعجابٌ بمشاركةٍ في غرفة النقاش، أو سحبُه** (D-289، الهجرة ٩٠).
 *
 * **توأمُ `toggleReviewLike` بجدولٍ ثالث** — والفرقُ كلُّه في المفتاح:
 * هناك (صاحبُ الرأي، العمل، الجهة)، **وهنا معرّفُ المشاركة وحدَه**
 * لأن المشاركةَ صفٌّ له `id` (D-254: الغرفةُ مفتاحٌ والمشاركةُ صفّ).
 *
 * ⚠️ **ولا حارسَ هنا لِما تحرسه القاعدة**: «لا تُعجب بمشاركتك» و«لا
 * تُعجب بمخفيّة» شرطان في سياسة الإدراج (D-193) — **والواجهةُ تخفي
 * الزرَّ، والقاعدةُ ترفض الصفّ.**
 *
 * ⚠️ **ولا `revalidatePath`**: صفحةُ الغرفة `force-dynamic` أصلاً،
 * **والحالةُ تنقلب تفاؤليّاً عند اللمس** (D-241) — **وتجديدُ صفحةٍ
 * كاملةٍ مع كلِّ قلبٍ هدرٌ صافٍ** (D-008).
 */
export async function togglePostLike(postId: string, liked: boolean) {
  postId = uuid(postId);
  const { supabase, user } = await requireUser();
  const key = { post_id: postId, user_id: user.id };
  const { error } = liked
    ? await supabase.from("title_post_likes").delete().match(key)
    : await supabase.from("title_post_likes").insert(key);
  if (error) fail(error);
}

/**
 * 🆕 **صوتُ مشاركةٍ — فوق أو تحت أو سحب** (D-305، الهجرة ٩٤).
 *
 * **`vote` ثلاثُ قيمٍ لا مفتاحُ تبديل**: ١ فوق، -١ تحت، ٠ سحبٌ —
 * **والواجهةُ ترسل الحالةَ المقصودة لا «اعكس ما عندك»**، فطلبان
 * متسابقان ينتهيان إلى ما ضُغط آخراً لا إلى انعكاسين (D-241).
 * **و`upsert` بمفتاح الصفّ**: تبديلُ الرأي تعديلٌ في مكانه،
 * **وضغطتان على شبكةٍ بطيئة لا ترفعان خطأَ مفتاحٍ مكرَّر** (D-301).
 */
/**
 * 🆕 **بحثُ الـGIF من الخادم** (D-362) — **والمفتاحُ لا يعبر إلى المتصفّح
 * أبداً** (القاعدة ١٤): الطلبُ يخرج من خادمنا، **والعائدُ معرّفاتٌ لا
 * روابطُ استعلام.**
 *
 * ⚠️ **ومعدّلٌ كأيِّ فعل**: البحثُ يُنادى مع كلِّ سكونِ كتابة، **وسطحٌ
 * يفتح خدمةً خارجيّةً بلا سقفٍ هو ما يُحرق به المفتاح** — والحدُّ في
 * `requireUser` نفسِه لا في الواجهة (D-193).
 */
export async function findGifs(query: string): Promise<GifHit[]> {
  await requireUser("gif", 40, 60_000);
  return searchGifs(String(query ?? "").slice(0, 60));
}

export async function votePost(postId: string, vote: -1 | 0 | 1, path?: string) {
  postId = uuid(postId);
  const { supabase, user } = await requireUser("vote", 60, 60_000);
  const key = { post_id: postId, user_id: user.id };
  const { error } =
    vote === 0
      ? await supabase.from("title_post_votes").delete().match(key)
      : await supabase
          .from("title_post_votes")
          .upsert({ ...key, vote }, { onConflict: "post_id,user_id" });
  if (error) fail(error);

  /* 🔴 🆕 **والصوتُ يُبطل نسخةَ الصفحة** (D-361، بلاغُ أحمد: «عطيته -١ لكن
     ماينزل، وإذا طلعت ورجعت أحصله ٠ — ما انحفظ الي سويته»).

     **والقياسُ قال إن الصوتَ محفوظ**: صفٌّ في `title_post_votes` بـ`-1`،
     **و`-1` تظهر على تحميلٍ كاملٍ طازجٍ لصفحة الغرفة.** **والذي رآه أحمد
     صفراً هو ذاكرةُ موجّه Next**: الرجوعُ يستعيد نسخةَ العميل المحفوظة،
     **فيقرأ صاحبُ الفعل أن فعلَه ضاع** — **ورقمٌ يُقرأ خطأً أسوأُ من لا
     رقم** (D-219)، **ومن يقول «لم يُحفظ» يُصدَّق ثم يُقاس** (D-152).

     ⚖️ **ونقضٌ مسجَّلٌ لبندِ «لا `revalidatePath`» في D-305 — بحجّةٍ
     قِيست لا برأي.** **وثمنُه مقصودٌ لا محتمَل**: الترتيبُ يتحرّك بعد
     التصويت، **وهو نصُّ طلبه** («ماينزل») — **وعقدُ «الترتيبُ في الفتحة
     التالية» يسقط حين لا تأتي فتحةٌ تالية أصلاً** لأن الصفحة تُستعاد من
     الذاكرة.

     ⚠️ **والمسارُ يصل من العميل فيُحرَس بشكله** (D-155/D-298: ما يصل من
     عميلٍ يُحرَس، لا يُصدَّق): مسارٌ داخليٌّ يبدأ بشرطةٍ مائلة، بلا
     بروتوكولٍ ولا مضيف، وبطولٍ محدود — **وما لا يطابق يسقط صامتاً ولا
     يُبطل شيئاً** (D-179). */
  if (path && /^\/[\w\-/[\]%.]{0,180}$/.test(path)) revalidatePath(path);
}

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
  const { airedPerSeason, airedEpisodeCount, firstEpisodeOf } = await import(
    "@/lib/progress"
  );

  const tv = await getTv(tmdbId);
  const per = airedPerSeason(tv);
  /* 🔴 🆕 **الترقيمُ المطلق** (D-603): مواسمُ-الآركات تحمل حلقاتُها
     أرقامَ العمل كلِّه («Elbaph» ١١٥٦–١١٨١ لا ١–٢٦) — **والعدُّ من ١
     كان يكتب أشباحاً نسبيّةً لا يقابلها شيءٌ يُرسم** (سلالةُ بلاغ
     خالد بعينها). ⚖️ **والحسبةُ خرجت إلى `firstEpisodeOf` يومَ
     الهجرة ١٣٣** — صار قرّاؤها أربعةً فالنسخُ الداخليُّ عطلٌ (D-145). */
  const firstOf = firstEpisodeOf(tv);
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
    const first = firstOf.get(season) ?? 1;
    for (let i = 0; i < count; i++) {
      const ep = first + i;
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

  /* 🆕 **وإحصاءُ المتابعة يُكتب هنا لا يُنتظر** (D-604): الرئيسيةُ
     تحكم «انتهى» بـ`aired_episodes` على صفِّ المتابعة، **وصفٌّ وُلد
     للتوّ (متابعةُ صحِّ بطاقة القائمة) قيمتُه فارغةٌ حتى تُفتح صفحةُ
     العمل** — فكان المسلسلُ يُختم ولا تنقلب البطاقة. البياناتُ في
     اليد أصلاً (شكلُ `cacheShowStats` نفسُه)، والفشلُ لا يُفشل الختم
     — تحسينُ قراءةٍ لا شرطُه. */
  await supabase
    .from("follows")
    .update({
      total_episodes: tv.number_of_episodes ?? 0,
      aired_episodes: airedEpisodeCount(tv),
      next_air_date: tv.next_episode_to_air?.air_date ?? null,
      stats_updated_at: now,
    })
    .match({ user_id: user.id, tmdb_id: tmdbId, media_type: "tv" });

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
 * 🆕 **إلغاءُ مشاهدة المسلسل كلِّه** (D-538، تصميمُ أحمد: «اضغط زر الصح
 * مرة ثانية لإلغاء التحديد»).
 *
 * **ولماذا فعلٌ مستقلٌّ لا `unmarkEpisodes` بقائمة**: القائمةُ تُبنى
 * بقراءةِ ما شُوهد أوّلاً — **رحلةٌ كاملةٌ قبل الحذف، وسقفُ خمسةِ آلافٍ
 * قد يُجاوَز في مسلسلٍ طويل.** **وهنا شرطُ الحذف هو المسلسلُ نفسُه**،
 * فجملةٌ واحدة.
 *
 * **وتُرجع ما حذفته** كي يصحّ التراجع: **الزرُّ لا يظهر إلا والمسلسلُ
 * مُشاهَدٌ بالكامل**، **فإعادةُ الوسم تُعيد الحالَ كما كان بالضبط**
 * (D-047: «تراجَع بعد» لا «أكِّد قبل»).
 *
 * ⚠️ **ولا تمسّ المتابعة**: من ألغى تأشيرَ المشاهدة لم يقل إنه لا يتابع
 * — **وفعلٌ يفعل شيئين يُفاجئ صاحبَه** (D-238).
 */
export async function unmarkShow(showTmdbIdRaw: number): Promise<number> {
  const showTmdbId = intId(showTmdbIdRaw);
  const { supabase, user } = await requireUser("ep", 120, 60_000);

  const { data, error } = await supabase
    .from("watched_episodes")
    .delete()
    .match({ user_id: user.id, show_tmdb_id: showTmdbId })
    .select("episode_number");
  if (error) fail(error);

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/show/${showTmdbId}`);
  return (data ?? []).length;
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
    .select(PERSON_COLS)
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
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) return [];

  /* ⚖️ 🆕 **والورقةُ تُفتح للزائر** (D-632، بحكم أحمد: «نعم يفتحها»):
     كان الفعلُ يبدأ بـ`requireUser` **فيرى الزائرُ العددَ ولا يرى مَن**
     — **وقائمةُ متابِعين ملفُّهم كلُّهم عامّ ليست سرّاً يُحرس بالتسجيل**
     (D-627: ما يُقرأ يُفتح، وما يُكتب يُطلب له حساب).

     🔑 **والقواعدُ الأربعُ انتقلت إلى القاعدة** (`follow_people` —
     الهجرة ١٣٩، نمطُ D-145): القفلُ (`hide_follow_lists`) وخصوصيّةُ
     الحساب والحظرُ وإخفاءُ الاسم **كانت موزّعةً بين هذا الفعل وسياسةِ
     الجدول** — **ونصٌّ واحدٌ لا يفترق عن نفسه بين قارئَين.**
     **والجدولُ `user_follows` يبقى مغلقاً على الزائر** (D-631). */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* **وحدُّ الزائر بعنوانه** (سابقةُ `/api/search` في D-627): معرّفٌ لا
     يملكه لا يصلح مفتاحَ سلّة، **وسلّةٌ واحدةٌ للزوّار كلِّهم تُقفل
     الورقةَ على أوّل فضوليّ.** */
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!allow(`${user?.id ?? ip}:follows`, 30, 10_000)) return [];

  const { data, error } = await supabase.rpc("follow_people", {
    target: targetId,
    dir,
  });
  if (error) return [];
  /* 🆕 **وحالةُ الحساب تُلحق** (D-773ب) — الدالّةُ لا تعيدها */
  return withIdentities((data ?? []) as PersonLite[]);
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
    .select(PERSON_COLS)
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
    .select(PERSON_COLS)
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
    .select(PERSON_COLS)
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

/**
 * 🆕 **حفظُ رأيك في قائمةِ غيرك** (D-327، الهجرة ١٠٣).
 *
 * **صفٌّ واحدٌ لكلِّ (قارئ، قائمة)** — والمفتاحُ المركَّب يمنع الثاني،
 * **فالتعديلُ `upsert` لا صفٌّ جديد** (D-263). **والحرّاسُ في القاعدة**:
 * قائمةٌ معلنةٌ وليست لي شرطٌ في `with check` — **وحدٌّ في الواجهة وحدَها
 * ليس حدّاً** (D-302).
 */
export async function saveListReview(input: {
  listId: string;
  rating: number;
  body?: string | null;
  hasSpoiler?: boolean;
}) {
  const listId = uuid(input.listId);
  const rating = Math.max(1, Math.min(10, Math.round(Number(input.rating) || 0)));
  const body = (input.body ?? "").trim().slice(0, 2000) || null;
  const { supabase, user } = await requireUser("review", 20, 60_000);

  const { error } = await supabase.from("list_reviews").upsert(
    {
      user_id: user.id,
      list_id: listId,
      rating,
      body,
      has_spoiler: !!input.hasSpoiler,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,list_id" },
  );
  if (error) fail(error);
  revalidatePath(`/lists/${listId}`);
}

/** سحبُ رأيي — **يحذف صفّي وحدَه**، ولا يمسّ تقييمَ غيري (D-238) */
export async function deleteListReview(listId: string) {
  listId = uuid(listId);
  const { supabase, user } = await requireUser("review", 20, 60_000);
  const { error } = await supabase
    .from("list_reviews")
    .delete()
    .match({ user_id: user.id, list_id: listId });
  if (error) fail(error);
  revalidatePath(`/lists/${listId}`);
}

/**
 * **بابُ البلاغ** — **سطحٌ عامٌّ جديدٌ بلا بلاغ هو كيف تُولد المشكلة**
 * (D-193). وصفةُ `reportReview` حرفاً: بلاغٌ واحدٌ لكل شخصٍ (المفتاحُ
 * المركَّب)، **والإخفاءُ عند العاشر يقع في مُشغِّلٍ في القاعدة لا هنا.**
 */
export async function reportListReview(input: { listId: string; reviewUserId: string }) {
  const listId = uuid(input.listId);
  const reviewUserId = uuid(input.reviewUserId);
  const { supabase, user } = await requireUser("report", 10, 60_000);
  if (user.id === reviewUserId) return;
  const { error } = await supabase.from("list_review_reports").upsert(
    { review_user_id: reviewUserId, list_id: listId, reporter_id: user.id },
    { onConflict: "review_user_id,list_id,reporter_id" },
  );
  if (error) fail(error);
}

/**
 * 🆕 **إعجابٌ بمراجعة قائمة، أو سحبُه** (D-370، الهجرة ١١٣).
 *
 * **توأمُ `toggleReviewLike` بجدولٍ آخر ومفتاحٍ فيه قائمةٌ بدل عمل** —
 * والحراسةُ كلُّها في القاعدة كسابقتها: المفتاحُ الأساسيُّ يمنع التكرار،
 * والسياسةُ تمنع الكتابةَ باسم غيرك والإعجابَ برأي نفسك.
 *
 * **و`revalidatePath` لصفحة القائمة وحدَها**: القلبُ يُنقر من تبويب
 * تقييماتها ومن خطّ المجتمع، **والزرُّ متفائلٌ يملك عدّادَه** — فتجديدُ
 * `/people` مع كلِّ قلبٍ يعيد بناءَ خطٍّ من ستّين صفّاً ثمناً لرقمٍ رُسم
 * أصلاً (نصُّ `toggleActivityLike`).
 */
export async function toggleListReviewLike(
  reviewUserId: string,
  listId: string,
  liked: boolean,
) {
  reviewUserId = uuid(reviewUserId);
  listId = uuid(listId);
  const { supabase, user } = await requireUser();
  const key = { review_user_id: reviewUserId, list_id: listId, liker_id: user.id };

  const { error } = liked
    ? await supabase.from("list_review_likes").delete().match(key)
    : await supabase.from("list_review_likes").insert(key);

  if (error) fail(error);
  revalidatePath(`/lists/${listId}`);
}

/**
 * 🆕 **ردٌّ على مراجعة قائمة** (D-370) — **نفسُ دلوِ `addReviewReply`
 * وحدودِه حرفاً**: خمسةَ عشرَ في الدقيقة وألفُ حرف، **فلا يتعلّم
 * المستخدمُ قاعدتين لفعلٍ واحد.**
 *
 * **والمعرّفُ يعود مع الكتابة** (D-241) لتُصالَح النسخةُ التفاؤلية.
 */
export async function addListReviewReply(input: {
  reviewUserId: string;
  listId: string;
  body: string;
  parentId?: string | null;
}): Promise<NewReply | null> {
  const reviewUserId = uuid(input.reviewUserId);
  const listId = uuid(input.listId);
  const parentId = input.parentId ? uuid(input.parentId) : null;

  const { supabase, user } = await requireUser("reply", 15, 60_000);

  const body = String(input.body ?? "").replace(/\s{3,}/g, "  ").trim().slice(0, 1000);
  if (!body) return null;

  const { data, error } = await supabase
    .from("list_review_replies")
    .insert({
      review_user_id: reviewUserId,
      list_id: listId,
      user_id: user.id,
      body,
      parent_id: parentId,
    })
    .select("id, created_at")
    .single();
  if (error) fail(error);

  revalidatePath(`/lists/${listId}`);

  const who = await replyAuthor(supabase, user.id);
  return { replyId: String(data!.id), createdAt: String(data!.created_at), ...who };
}

/** 🆕 **حذفُ ردّي أنا** (D-370) — توأمُ `deleteMyReply`، والسياسةُ تحرسه */
export async function deleteMyListReviewReply(input: {
  replyId: string;
  listId: string;
}): Promise<void> {
  const replyId = uuid(input.replyId);
  const listId = uuid(input.listId);

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("list_review_replies")
    .delete()
    .match({ id: replyId, user_id: user.id });
  if (error) fail(error);

  revalidatePath(`/lists/${listId}`);
}

/**
 * 🆕 **الإبلاغُ عن ردٍّ على مراجعة قائمة** (D-370) — توأمُ `reportReply`
 * بحرفيّته: صامتٌ، لا يعود بعدّاد، **والإخفاءُ عند العاشر في مُشغِّل SQL
 * لا هنا**، وتكرارُه بلا أثر.
 */
export async function reportListReviewReply(input: {
  replyId: string;
  reason?: string;
}): Promise<void> {
  const replyId = uuid(input.replyId);
  const { supabase, user } = await requireUser("report", 10, 60_000);

  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const { error } = await supabase.from("list_reply_reports").upsert(
    { reply_id: replyId, reporter_id: user.id, reason: reason || null },
    { onConflict: "reply_id,reporter_id", ignoreDuplicates: true },
  );
  if (error) fail(error);
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

/** تعليم كل الوارد من شخصٍ بعينه مقروءاً — عند فتح محادثته.
 *  🆕 D-765: صار بابُه دالّةَ `mark_conversation_read` (الهجرة ١٥٣) —
 *  الجداولُ صارت ثلاثةً بعد أن نالت الردودُ مقروئيّتها، وثالثُها كان
 *  سيحتاج سياسةَ update جديدةً على صفوف الغير؛ الدالّةُ definer تحصر
 *  التعديلَ في عمود القراءة ولطرف الخيط (نمط ١٢٩/١٣٨). وقبل الهجرة؟
 *  السقوطُ إلى تحديثَي المشاركات القديمَين — شارةُ الردود وحدَها تتأخّر */
export async function markConversationRead(personId: string) {
  personId = uuid(personId);
  const { supabase, user } = await requireUser("share", 30, 60_000);
  const { error } = await supabase.rpc("mark_conversation_read", { p_peer: personId });
  if (error) {
    const now = new Date().toISOString();
    await supabase
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
  }
  revalidatePath("/people");
}

/**
 * 🆕 D-768: نسبةُ الحساب الجديد إلى داعيه — يناديها ردهةُ OAuth بعد
 * تمام الدخول (جوار `absorbGuestContentPrefs` ونمطُه نفسُه: سقوطُها
 * لا يُسقط الدخول). الكوكي `loopz_ref` كتبه مسارُ `/join/<code>`،
 * والحرّاسُ كلُّهم في جسم `claim_referral` (الهجرة ١٥٤): حسابٌ عمرُه
 * ≤ ٤٨ ساعةً وبلا متابعاتٍ ولم يُنسب من قبلُ وليس داعيَ نفسِه —
 * فدخولُ عضوٍ قديمٍ بالكوكي نفسِه صفرٌ صامت. والكوكي يُمحى في الحالين:
 * نسبةٌ لا تنجح اليومَ لن تنجح غداً (الحرّاس زمنيّون).
 */
export async function claimReferralFromCookie() {
  const store = await cookies();
  const code = store.get("loopz_ref")?.value;
  if (!code) return;
  store.delete("loopz_ref");
  const { supabase } = await requireUser("ref", 5, 60_000);
  const { data } = await supabase.rpc("claim_referral", { ref_code: code });
  if (data === true) revalidatePath("/");
}

/**
 * 🆕 نبضةُ الحضور (D-765) — تُبقي `profiles.last_seen_at` صادقاً لعرض
 * «آخر ظهور» في ترويسة المحادثة. الخنقُ مزدوج: العميلُ يدقّ كلَّ أربع
 * دقائق والدالّةُ (الهجرة ١٥٣) لا تكتب إلا بعد ٦٠ ثانية من آخر كتابة —
 * فأسوأُ حالاتها كتابةُ صفٍّ في الدقيقة لكلِّ مستخدمٍ نشط.
 * ولا `revalidatePath`: لا شاشةَ عندي تتغيّر بنبضتي أنا (روح D-008).
 */
export async function touchPresence() {
  const { supabase } = await requireUser("presence", 5, 60_000);
  await supabase.rpc("touch_last_seen");
}

/**
 * 🆕 D-770: طلبُ الانضمام إلى Loopz Partners — upsert في جسم
 * `apply_partner` (الهجرة ١٥٥): طلبٌ قائمٌ يُستبدل ما لم يوافَق عليه،
 * ومرفوضٌ يعود `pending` بتاريخٍ جديد. القصُّ هنا شكليٌّ (حدودُ الأطوال
 * قيودُ `check` في الجدول — D-011: الحكمُ حيث الباب)، والرابطُ يُشترط
 * `https` قبل الإرسال فلا يصل الإداريَّ رابطٌ لا يُفتح.
 */
export async function applyPartner(input: {
  channelUrl: string;
  contentType: string;
  platforms: string;
  followersRange: string;
  country: string;
  contentLanguage: string;
  reason: string;
}) {
  const { supabase } = await requireUser("partner", 5, 60_000);
  const channel = String(input.channelUrl ?? "").trim().slice(0, 300);
  if (!/^https:\/\/.+\..+/.test(channel)) {
    throw new Error("رابط القناة يجب أن يبدأ بـ https:// / Channel URL must start with https://");
  }
  const { error } = await supabase.rpc("apply_partner", {
    p_channel: channel,
    p_content: String(input.contentType ?? "").trim().slice(0, 120),
    p_platforms: String(input.platforms ?? "").trim().slice(0, 200),
    p_followers: String(input.followersRange ?? "").trim().slice(0, 40),
    p_country: String(input.country ?? "").trim().slice(0, 60),
    p_language: String(input.contentLanguage ?? "").trim().slice(0, 60),
    p_reason: String(input.reason ?? "").trim().slice(0, 600),
  });
  if (error) {
    /* 🆕 **شرطا التقديم في جسم الدالّة** (D-855، حكمُ أحمد: «ضروري
       يكون رابط حساب X بلوبز وكذلك مشترك بلس») — **والحارسُ الحقيقيُّ
       هناك** (D-011)، وهنا ترجمةُ رفضِه وحدَها: من تجاوز الواجهةَ
       ووصل البابَ يقرأ سببَ الردّ لا «حاول مجدداً». */
    if ((error.message ?? "").includes("partner_requirements_not_met")) {
      throw new Error(
        "شرطا التقديم: حساب X موثّق في لوبز واشتراك بلس فعّال / Requirements: a verified X account on Loopz and an active Plus subscription",
      );
    }
    throw new Error("تعذّر إرسال الطلب — حاول مجدداً / Could not submit, try again");
  }
  revalidatePath("/profile/settings/invites");
}

/** 🆕 D-770: سحبُ طلبٍ قيد المراجعة — الحذفُ في جسم الدالّة محصورٌ
 *  بصفّي و`pending` وحدَها، فالموافَق عليه لا يُسحب من هنا */
export async function cancelPartnerApplication() {
  const { supabase } = await requireUser("partner", 5, 60_000);
  await supabase.rpc("cancel_partner_application");
  revalidatePath("/profile/settings/invites");
}

/**
 * 🆕 **حفظُ بيانات تحويل الشريك** (D-858، حكمُ أحمد: «وين يسجّل بياناته
 * البنكيّة وجواله») — **آيبانٌ سعوديٌّ حصراً** (قرارُه: الشركاءُ
 * سعوديّون اليوم) **والجوالُ يُجمع الآن وتوثيقُ الرمز مع فتح
 * المدفوعات.** القصُّ هنا شكليٌّ — **قيودُ `check` في الجدول هي
 * الحَكَم** (D-011)، وRLS تحصر الكتابةَ بشريكٍ قائمٍ على صفّه.
 * ⚠️ **والهويّةُ ليست هنا**: ملفُّها يصعد من العميل إلى المخزن مباشرةً
 * (نمطُ `Composer`) — **فِعلا نصٍّ وملفٍّ لا يُخلطان في بابٍ واحد.**
 */
export async function savePartnerDetails(input: {
  iban: string;
  bankName: string;
  accountName: string;
  phone: string;
}) {
  const { supabase, user } = await requireUser("partner", 5, 60_000);
  const iban = String(input.iban ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^SA\d{22}$/.test(iban)) {
    throw new Error("الآيبان السعودي: SA ثم ٢٢ رقماً / Saudi IBAN: SA followed by 22 digits");
  }
  const bank = String(input.bankName ?? "").trim().slice(0, 60);
  const holder = String(input.accountName ?? "").trim().slice(0, 80);
  if (!bank || !holder) {
    throw new Error("اسمُ البنك واسمُ صاحب الحساب مطلوبان / Bank and account holder names are required");
  }
  /* `05xxxxxxxx` تُطبَّع إلى الصيغة الدوليّة — **صيغةٌ واحدةٌ في القاعدة**
     فقارئُ الغد (OTP/التحويل) لا يفكّ صيغتين */
  let phone = String(input.phone ?? "").replace(/[\s()-]/g, "");
  if (/^05\d{8}$/.test(phone)) phone = `+966${phone.slice(1)}`;
  if (/^9665\d{8}$/.test(phone)) phone = `+${phone}`;
  if (!/^\+9665\d{8}$/.test(phone)) {
    throw new Error("رقم جوال سعودي: 05xxxxxxxx أو +9665xxxxxxxx / Saudi mobile: 05xxxxxxxx or +9665xxxxxxxx");
  }
  const { error } = await supabase.from("partner_details").upsert({
    user_id: user.id,
    iban,
    bank_name: bank,
    account_name: holder,
    phone,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("تعذّر الحفظ — حاول مجدداً / Could not save, try again");
  revalidatePath("/profile/settings/invites");
}

/**
 * 🆕 D-770: قرارُ الإدارة في طلب شريك — الحارسُ الحقيقيُّ `am_admin()`
 * في جسم `admin_decide_partner` يرمي `forbidden` لغير الإداريّ (D-011)،
 * والموافقةُ تولّد كودَ `/p/<CODE>` مفحوصاً ضدّ جدولَي الأكواد معاً.
 */
export async function adminDecidePartner(userId: string, approve: boolean) {
  userId = uuid(userId);
  const { supabase } = await requireUser("admin", 30, 60_000);
  const { error } = await supabase.rpc("admin_decide_partner", {
    p_user: userId,
    p_approve: approve === true,
  });
  if (error) throw new Error(error.message.slice(0, 120));
  revalidatePath("/admin/partners");
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

/**
 * 🆕 **الدفعةُ التالية من المقاطع** (D-772، بلاغُ أحمد: «الفيديوهات
 * قليلة، ما بغا توقف») — **العلفُ يطلبها وحدَه عند بلوغ آخره.**
 *
 * 🔑 **ولا مصدرَ ثانٍ ولا جدولَ جديد**: **الدالّةُ نفسُها التي رسمت
 * الدفعةَ الأولى بنافذةٍ أبعد** — **ودفعةٌ من مصدرٍ ثانٍ كانت ستُخرج
 * أعمالاً تناقض التبويبَ الذي تُلحق به** (D-731: وراثةُ المصدر وراثةُ
 * قواعده).
 * ⚠️ **ومفتوحةٌ للزائر كالصفحة نفسِها** (D-627) — **والحدُّ بعنوانه**
 * كحدِّ البحث حرفاً (`/api/search`)، **فلا يتقاسم الزوّارُ سلّةً واحدة.**
 * ⚠️ **وسقفُ الصفحات ستٌّ**: **ما بعدها بِركةُ الاقتراحات نفسُها تنفد**
 * — **ونداءٌ يعود فارغاً أبداً حلقةٌ لا علف** (D-217).
 * ⚠️ **ولا `revalidatePath`**: **قراءةٌ خالصةٌ لا تغيّر شاشةً على الخادم**
 * — **وفعلٌ خادميٌّ يُبطل التخبئة يعيد رسمَ الصفحة كلِّها** (D-747).
 */
export async function moreTrailerClips(input: {
  tab?: string;
  scope?: string;
  page: number;
  perTitle?: number;
  limit?: number;
}): Promise<TrailerItem[]> {
  const page = intIn(input.page, 1, 6);
  const head = await headers();
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!allow(`trailers:${ip}`, 20, 60_000)) return [];
  const { locale } = await getT();
  const tab = asTrailerTab(input.tab);
  const scope = asTrailerScope(input.scope);
  const limit = intIn(input.limit ?? 40, 1, 60);
  const perTitle = intIn(input.perTitle ?? 1, 1, 8);
  return getTrailerTabFeed(tab, limit, locale, { page, perTitle, scope }).catch(() => []);
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
  const { airedPerSeason, firstEpisodeOf } = await import("@/lib/progress");

  const tv = await getTv(tmdbId);
  const per = airedPerSeason(tv);
  /* 🔴 🆕 بقيّةُ D-603 (انكشفت يومَ الهجرة ١٣٣): العدُّ من ١ كان
     سيكتب في العمل المطلق شبحَ «S2 E1» من أوّل «+١» — النافذةُ
     الحقيقيّةُ من `firstEpisodeOf` كسائر قرّائها */
  const firstOf = firstEpisodeOf(tv);

  const { data: watched, error: readErr } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("user_id", user.id)
    .eq("show_tmdb_id", tmdbId)
    .limit(5000);
  if (readErr) fail(readErr);

  const seen = new Set((watched ?? []).map((w) => `${w.season_number}-${w.episode_number}`));

  for (const [season, count] of per) {
    const first = firstOf.get(season) ?? 1;
    for (let i = 0; i < count; i++) {
      const ep = first + i;
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

  /* 🆕 **الدفعةُ صفوفٌ لا حلقة**: كانت الدفعةُ (٥ مسلسلات + ٦٠ فيلماً)
     تُكتب رحلةً رحلةً — حتى ١٨٠ رحلةً متعاقبةً للأفلام وحدَها — والأفعال
     كلُّها upsert على مفاتيحَ فريدةٍ فالمصفوفةُ تكافئها أثراً.
     **والتكرارُ داخل الدفعة يُطوى أوّلاً**: Postgres يرفض إصابةَ الصفِّ
     مرّتين في أمرٍ واحد («cannot affect row a second time») — والحلقةُ
     القديمة كانت تبتلعه بالكتابة الأخيرة، فالطيُّ يحفظ ذلك الأثر. */
  const dedupe = <T,>(rows: T[], key: (r: T) => string | number): T[] => {
    const m = new Map<string | number, T>();
    for (const r of rows) m.set(key(r), r); // الأخيرُ يكسب كما في الحلقة
    return [...m.values()];
  };

  const showFollowRows = dedupe(
    shows.map((sh) => ({
      user_id: user.id,
      tmdb_id: intId(sh.tmdbId),
      media_type: "tv" as const,
      title: String(sh.title ?? "").slice(0, 300),
      poster_path: safeImagePath(sh.posterPath),
    })),
    (r) => r.tmdb_id,
  );
  const movieFollowRows = dedupe(
    movies.map((mv) => ({
      user_id: user.id,
      tmdb_id: intId(mv.tmdbId),
      media_type: "movie" as const,
      title: String(mv.title ?? "").slice(0, 300),
      poster_path: safeImagePath(mv.posterPath),
    })),
    (r) => r.tmdb_id,
  );
  const watchedMovieRows = dedupe(
    movies
      .filter((mv) => mv.watched)
      .map((mv) => ({
        user_id: user.id,
        movie_tmdb_id: intId(mv.tmdbId),
        runtime: null as number | null,
        watched_at: mv.at ?? stamp,
      })),
    (r) => r.movie_tmdb_id,
  );
  const ratingRows = dedupe(
    [
      ...shows
        .filter((sh) => sh.rating != null)
        .map((sh) => ({
          user_id: user.id,
          tmdb_id: intId(sh.tmdbId),
          media_type: "tv" as string,
          rating: intIn(Math.round(sh.rating as number), 1, 10),
          review: null as string | null,
          title: String(sh.title ?? "").slice(0, 300),
          poster_path: safeImagePath(sh.posterPath),
          updated_at: stamp,
        })),
      ...movies
        .filter((mv) => mv.rating != null)
        .map((mv) => ({
          user_id: user.id,
          tmdb_id: intId(mv.tmdbId),
          media_type: "movie" as string,
          rating: intIn(Math.round(mv.rating as number), 1, 10),
          review: null as string | null,
          title: String(mv.title ?? "").slice(0, 300),
          poster_path: safeImagePath(mv.posterPath),
          updated_at: stamp,
        })),
    ],
    (r) => `${r.media_type}-${r.tmdb_id}`,
  );

  /* المتابعاتُ أوّلاً (جداول الحلقات والتقييمات تُعرض من فوقها)، ثم
     الجداولُ الثلاثةُ الباقية معاً — مستقلّةٌ تماماً بعضُها عن بعض. */
  const followRows = [...showFollowRows, ...movieFollowRows];
  if (followRows.length) {
    await supabase
      .from("follows")
      .upsert(followRows, { onConflict: "user_id,tmdb_id,media_type" });
  }

  const episodeRows = dedupe(
    shows.flatMap((sh) =>
      (sh.episodes ?? []).slice(0, IMPORT_CAPS.episodesPerShow).map((ep) => ({
        user_id: user.id,
        show_tmdb_id: intId(sh.tmdbId),
        season_number: intIn(ep.s, 0, 100),
        episode_number: intIn(ep.e, 0, 20_000),
        runtime: null as number | null,
        watched_at: ep.at ?? stamp,
      })),
    ),
    (r) => `${r.show_tmdb_id}-${r.season_number}-${r.episode_number}`,
  );

  const writes: PromiseLike<unknown>[] = [];
  if (watchedMovieRows.length) {
    writes.push(
      supabase
        .from("watched_movies")
        .upsert(watchedMovieRows, { onConflict: "user_id,movie_tmdb_id" }),
    );
  }
  if (ratingRows.length) {
    writes.push(
      supabase
        .from("ratings")
        .upsert(ratingRows, { onConflict: "user_id,tmdb_id,media_type" }),
    );
  }
  // دفعات حتى لا يُرفض الطلب لضخامته — كما كان
  for (let i = 0; i < episodeRows.length; i += 500) {
    const slice = episodeRows.slice(i, i + 500);
    writes.push(
      supabase
        .from("watched_episodes")
        .upsert(slice, {
          onConflict: "user_id,show_tmdb_id,season_number,episode_number",
        })
        .then(({ error }) => {
          if (!error) epCount += slice.length;
        }),
    );
  }
  await Promise.all(writes);

  return { shows: shows.length, episodes: epCount, movies: movies.length };
}

/** يُستدعى مرّة عند نهاية الاستيراد — لا مع كل دفعة */
export async function finishImport() {
  const { supabase } = await requireUser("import-apply", 90, 60_000);
  /* 🆕 D-768: مستوردُ تاريخه تجاوز الأعمالَ الثلاثةَ دفعةً — دعوتُه
     تُحتسب هنا لا في انتظار متابعةٍ يدويّةٍ قد لا تأتي */
  await supabase.rpc("qualify_referral");
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
  /** 🆕 **السطرُ الثاني في وضع «المحلّي + الأصلي»** (D-544) — و`null` فيما سواه.
   *  ⚠️ **اختياريّةٌ لأجل ترتيب الكوميتات** (D-028) كأختها في `searchTypes`. */
  titleSecondary?: string | null;
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
  const { originalTitleOf } = await import("@/lib/media");

  const seen = new Set<string>();
  const results: AiSearchResult[] = [];
  /** الاسمُ الأصليُّ لكلِّ نتيجة — يُلتقط عند الدفع ويُقرأ عند الخروج (D-544) */
  const originals = new Map<string, string | null>();

  /**
   * 🆕 **حلُّ الأسماء مرّةً واحدةً قبل الخروج** (D-544).
   *
   * **بابُ الوصف يتبع طريقةَ العرض كبقيّة الأبواب** — **وقائمةُ نتائجٍ
   * باسمين مختلفين حسب البابِ الذي دخلتَ منه عطلٌ لا ميزة** (القاعدة ٦).
   * **ونداءٌ واحدٌ مجمَّعٌ للكتابات الصوتيّة** لا نداءٌ لكلِّ نتيجة،
   * **ولا نداءَ إطلاقاً في الأوضاع الثلاثة الأخرى.**
   */
  const finish = async (rows: AiSearchResult[]): Promise<AiSearchResult[]> => {
    const [{ getTitleMode }, { resolveMediaTitle, needsTranslit }] = await Promise.all([
      import("@/lib/locale"),
      import("@/lib/titleMode"),
    ]);
    const mode = await getTitleMode();
    if (mode === "localized") return rows;
    const { getTranslits } = await import("@/lib/titleAliases");
    const translits = needsTranslit(mode)
      ? await getTranslits(rows.map((r) => ({ tmdb_id: r.id, media_type: r.kind })))
      : new Map<string, string>();
    return rows.map((r) => {
      const key = `${r.kind}-${r.id}`;
      const out = resolveMediaTitle(
        { localized: r.title, original: originals.get(key) ?? null, translit: translits.get(key) ?? null },
        mode,
        r.title,
      );
      return { ...r, title: out.primary, titleSecondary: out.secondary };
    });
  };
  const push = (r: import("@/lib/tmdb").SearchResult, reason?: string) => {
    const kind = r.media_type === "tv" ? ("tv" as const) : ("movie" as const);
    const key = `${kind}-${r.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    /* 🆕 **والاسمُ الأصليُّ يُلتقط هنا ويُحلُّ عند الخروج** (D-544):
       **`push` متزامنةٌ والكتابةُ الصوتيّةُ نداءٌ** — **ونداءٌ داخل
       حلقةِ دفعٍ هو استعلامٌ لكلِّ نتيجة**، وهو ما تمنعه المواصفة.
       **فتُجمع الأصولُ هنا، ويُحلُّ الكلُّ مرّةً واحدةً في `finish`.** */
    originals.set(key, originalTitleOf(r));
    results.push({
      kind,
      id: r.id,
      title: titleOf(r),
      titleSecondary: null,
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
    if (results.length) return { ok: true, results: await finish(results) };
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
  return { ok: true, results: await finish(results.slice(0, 12)), fallback: true };
}

// ============================================================
//  أغلفة وبوسترات شخصية (title_art.sql، D-131)
// ============================================================

/**
 * 🆕 **هل صاحبُ الجلسة مشترِكٌ؟ — قراءةُ خطّةٍ واحدةٌ في الخادم** (D-786).
 *
 * 🔴 **ولماذا وُلدت هذه الدالّة أصلاً**: أقفالُ Loopz+ كلُّها كانت في
 * المتصفّح وحدَه (`ThemeSection` تقرأ `themeNeedsPlus` بمعامل `plus`)،
 * **ولا شرطَ خطّةٍ واحدٌ في أيِّ فعلِ خادم** — **وقفلٌ في الواجهة بلا
 * خادمٍ يقفل زينةٌ تُفتح بأدوات المطوّر**، وهو نصُّ التعليق في
 * `PlusGateHost` الذي كان يَعِد بحراسةٍ لم تكن موجودة. **فمَن يبيع
 * ميزةً يقفلها في الخادم أوّلاً.**
 *
 * **والقراءةُ عند الفعل لا مع الصفحة**: استعلامٌ بعمودين لا يُدفع ثمنُه
 * إلا حين يُطلب الفعلُ المقفول — **فصفحةُ العمل لا تحمل استعلاماً
 * إضافيّاً لأجل ورقةٍ قد لا تُفتح.**
 */
export async function viewerIsPlus(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("plan, plus_until")
    .eq("id", user.id)
    .maybeSingle();
  return isPlus(data);
}

/**
 * بوّابة الميزة (ق٩) — نقطةٌ واحدة.
 *
 * 🆕 **وقد أُغلقت بحكم أحمد** (٢٩ أغسطس، D-786): «يُقفل على البلس».
 * **ولا خاسرَ اليوم**: الأعضاءُ الحاليّون كلُّهم مؤسِّسون = Loopz+ مدى
 * الحياة (هجرة ١٤١)، **فقاعدةُ «لم أمنع خدماتٍ مجّانيّةً على الأعضاء»
 * محفوظةٌ حرفاً** — القفلُ يقع على جمهورٍ لم يأتِ بعد.
 *
 * ⚠️ **وشرطُ TMDB قائمٌ ولم يسقط**: شروطُهم تشترط ترخيصاً تجاريّاً حين
 * يكون توليدُ الإيراد غرضاً أساسيّاً، **والميزةُ مبنيّةٌ حرفاً على
 * صورهم** — **يُحسم قبل فتح الدفع لا بعده.**
 */
export async function canUseArt(): Promise<boolean> {
  return viewerIsPlus();
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
  /* 🔴 **ولا قفلَ هنا عمداً** (D-786): **هذه الدالّة مشتركةٌ مع
     `ListCoverSheet`** (غلافُ القائمة) — **وقفلُها كان سيقفل معها ميزةً
     لم يحكم عليها أحد**، ويردّ ورقةً فارغةً بلا سببٍ مكتوب. **القفلُ
     على الكتابة (`setTitleArt`) وهي الحارس، والورقةُ تسأل `canUseArt`
     عند فتحها لتقول الثمنَ بدل أن تصمت.** */

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
/**
 * **صاحبُ الردّ كما سيُقرأ** (D-241) — يُعاد مع كلِّ ردٍّ يُكتب.
 *
 * **والسببُ عيبان قاسهما أحمد في لقطةٍ واحدة:** الردُّ يظهر **مرّتين**،
 * وإحداهما باسم «Someone».
 *
 * **العيبُ الأوّل — النسخةُ التفاؤلية لا تُصالَح.** كانت تُضاف بمعرّفٍ
 * مؤقّت وتُحذف **عند الفشل وحده**؛ فإذا نجحت الكتابة أبطلَ الفعلُ المسارَ،
 * **فأعاد الخادمُ الردَّ الحقيقيَّ بينما المؤقّتُ لا يزال في الحالة** —
 * فصارا اثنين. **ومعرّفٌ حقيقيٌّ يعود مع الكتابة يحلّها من أصلها**:
 * الواجهةُ تُسقط نسختَها لحظةَ ظهور معرّفِها في حمولة الخادم.
 *
 * **والعيبُ الثاني — «Someone».** النسخةُ المؤقّتة كانت تُرسم `hide_name`
 * لأن «الصفحةَ لا تملك ملفّي». **وكانت حجّةً كسولة**: الخادمُ يملكه وهو من
 * يكتب. **فأن أرى كلامي باسم غريبٍ لثوانٍ أسوأُ من أن أراه بلا اسم** —
 * والاسمُ يعود مع الردّ لا بنداءٍ ثانٍ من الواجهة.
 */
async function replyAuthor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  hide_name: boolean;
}> {
  const { data } = await supabase
    .from("profiles")
    .select("nickname, username, avatar_url, hide_name")
    .eq("id", userId)
    .maybeSingle();
  const hidden = !!data?.hide_name;
  /* **والإخفاءُ يُطبَّق هنا كما يُطبَّق في القارئ** (D-011): من أخفى اسمَه
     يراه مخفيّاً في نسخته أيضاً، **وإلا رأى نفسَه بشكلٍ لا يراه به أحد.** */
  return {
    nickname: hidden ? null : (data?.nickname ?? null),
    username: hidden ? null : (data?.username ?? null),
    avatar_url: hidden ? null : (data?.avatar_url ?? null),
    hide_name: hidden,
  };
}

/** ما يعود من كتابة ردّ — **يكفي لرسم الصفّ نهائياً بلا نداءٍ ثانٍ** */
export type NewReply = {
  replyId: string;
  createdAt: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  hide_name: boolean;
};

export async function addReviewReply(input: {
  reviewUserId: string;
  tmdbId: number;
  mediaType: MediaType;
  body: string;
  parentId?: string | null;
}): Promise<NewReply | null> {
  const reviewUserId = uuid(input.reviewUserId);
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);
  const parentId = input.parentId ? uuid(input.parentId) : null;

  /* دلوٌ أضيقُ من الافتراضي: الردُّ نصٌّ يقرؤه الناس، لا نقرةُ قلب */
  const { supabase, user } = await requireUser("reply", 15, 60_000);

  const body = String(input.body ?? "").replace(/\s{3,}/g, "  ").trim().slice(0, 1000);
  if (!body) return null;

  const { data, error } = await supabase
    .from("review_replies")
    .insert({
      review_user_id: reviewUserId,
      tmdb_id: tmdbId,
      media_type: mediaType,
      user_id: user.id,
      body,
      parent_id: parentId,
    })
    /* **والمعرّفُ يعود مع الكتابة** (D-241) — انظر `replyAuthor` */
    .select("id, created_at")
    .single();
  if (error) fail(error);

  for (const p of talkPaths(tmdbId, mediaType)) revalidatePath(p);

  const who = await replyAuthor(supabase, user.id);
  return { replyId: String(data!.id), createdAt: String(data!.created_at), ...who };
}

/**
 * **ردٌّ على نشرةِ Loopz** (D-236) — جدولٌ ثالثٌ لأن نشرتَنا لا صاحبَ لها
 * في `auth.users`، والحجّةُ كاملةً في `supabase/news_post_replies.sql`.
 *
 * **ونفسُ دلوِ `addReviewReply` وحدودِه حرفاً** — خمسةَ عشرَ في الدقيقة
 * وألفُ حرف: **قاعدتان لفعلٍ واحد يتعلّمهما المستخدم مرّتين.**
 */
export async function addNewsReply(input: {
  postKey: string;
  body: string;
  parentId?: string | null;
}): Promise<NewReply | null> {
  const postKey = String(input.postKey ?? "").trim().slice(0, 120);
  if (!postKey) return null;
  const parentId = input.parentId ? uuid(input.parentId) : null;

  const { supabase, user } = await requireUser("reply", 15, 60_000);

  const body = String(input.body ?? "").replace(/\s{3,}/g, "  ").trim().slice(0, 1000);
  if (!body) return null;

  const { data, error } = await supabase
    .from("news_post_replies")
    .insert({
      post_key: postKey,
      user_id: user.id,
      body,
      parent_id: parentId,
    })
    .select("id, created_at")
    .single();
  if (error) fail(error);

  revalidatePath("/people");
  revalidatePath("/post/[key]", "page");

  const who = await replyAuthor(supabase, user.id);
  return { replyId: String(data!.id), createdAt: String(data!.created_at), ...who };
}

/**
 * **تسجيلُ مشاهداتِ منشورات** (D-237) — دفعةٌ واحدة لا صفٌّ صفّ.
 *
 * **ولا `revalidatePath` هنا** عن قصد: هذا **أثرٌ جانبيٌّ للقراءة**، ومن
 * أبطل مسارَ `/people` كلَّما مرّت عينُ قارئٍ على الخطّ **جعل القراءةَ
 * تكتب ثم تُعيد بناءَ نفسِها** — فالرقمُ يظهر في التحميل التالي، وهو
 * ما يكفي عدّاداً بطيءَ الأثر.
 *
 * **والسقوطُ صامتٌ**: عدّادٌ لا يُكتب لا يستحقّ أن يُفسد صفحةً تُقرأ —
 * وقبل الهجرة ٧٤ لا جدولَ أصلاً.
 */
export async function recordPostViews(keys: string[]): Promise<void> {
  const unique = [...new Set((keys ?? []).filter(isViewKey))].slice(0, 60);
  if (!unique.length) return;
  try {
    /* حدٌّ سخيّ: التمريرةُ الواحدة نداءٌ واحد، والقارئُ النهم يفتح
       الخطَّ مرّاتٍ في الدقيقة — **والخنقُ هنا يفقد عدّاداً لا يمنع أذى** */
    const { supabase, user } = await requireUser("view", 40, 60_000);
    await supabase.from("post_views").upsert(
      unique.map((post_key) => ({ post_key, user_id: user.id })),
      { onConflict: "post_key,user_id", ignoreDuplicates: true },
    );
  } catch {
    /* لا شيء — انظر أعلاه */
  }
}

/**
 * **حذفُ ردّي على نشرة** و**الإبلاغُ عن ردِّ غيري** (D-239) — توأما
 * `deleteMyReply` و`reportReply` بحرفيّتهما، على جدولِ النشرات.
 *
 * ⚠️ **ولماذا فعلان لا عَلَمٌ في الفعلين القائمين:** ذانك يشترطان
 * `tmdbId` و`mediaType` **مِرساةً لإبطال المسارات**، وهذه النشرةُ
 * مرساتُها مفتاحٌ نصّيّ. **وعَلَمٌ يقلب نصفَ الوسائط ليس عَلَماً.**
 * والمشترَكُ الحقيقيُّ بينهما — **صفُّ الردّ** — مُستخرَجٌ أصلاً
 * (`ReplyRow`).
 *
 * **وبابُ البلاغ من أوّل يوم**: سطحٌ عامٌّ جديد بلا بابِ بلاغ هو كيف
 * تُولد المشكلة (D-193).
 */
export async function deleteMyNewsReply(input: { replyId: string }): Promise<void> {
  const replyId = uuid(input.replyId);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("news_post_replies")
    .delete()
    .match({ id: replyId, user_id: user.id });
  if (error) fail(error);
  revalidatePath("/people");
}

/** صامتٌ بلا عدّاد، والإخفاءُ عند العاشر في مُشغِّل SQL لا هنا */
export async function reportNewsReply(input: {
  replyId: string;
  reason?: string;
}): Promise<void> {
  const replyId = uuid(input.replyId);
  const { supabase, user } = await requireUser("report", 10, 60_000);
  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const { error } = await supabase.from("news_reply_reports").upsert(
    { reply_id: replyId, reporter_id: user.id, reason: reason || null },
    { onConflict: "reply_id,reporter_id", ignoreDuplicates: true },
  );
  if (error) fail(error);
}

/* ============================================================
 *  مشاركاتُ النقاش (D-257، الهجرة ٧٨) — **الكتابةُ في `title_posts`**
 *
 *  **ولماذا فعلٌ ثالثٌ لا عَلَمٌ في `addReviewReply`:** ذاك يشترط
 *  `reviewUserId` — **مرساةً إلى رأي إنسان**، وهذا لا مرساةَ له غيرُ
 *  الغرفة. **وفعلٌ يتجاهل نصفَ وسائطه ليس نفسَ الفعل.**
 * ============================================================ */

/**
 * **مشاركةٌ في غرفة نقاش** — جذرٌ (`parentId = null`) أو ردٌّ عليه.
 *
 * **والعنوانُ والملصقُ والغلافُ يُرسَلون مع الصفّ** لا يُقرآن من TMDB
 * لاحقاً: نمطُ `ratings` نفسُه منذ أوّل يوم (D-048) — **وبديلُه أربعون
 * نداءَ TMDB لفتحةِ تبويب** (D-164). **والغلافُ خاصّةً لخلفيّة البطاقة**
 * (طلبُ أحمد: «الخلفية تكون من غلاف الفلم»).
 *
 * **ونفسُ دلوِ الردّ وحدودِه**: خمسةَ عشرَ في الدقيقة — **قاعدتان لفعلٍ
 * واحد يتعلّمهما المستخدم مرّتين.** **والسقفُ ألفان** لأن هذا سطرُ
 * نقاشٍ لا ردّاً عابراً، **والقاعدةُ تحرسه بنفسها** (`check`).
 */
export async function addTalkPost(input: {
  tmdbId: number;
  mediaType: MediaType;
  body: string;
  parentId?: string | null;
  title?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  /** **أعلن الكاتبُ أن فيها حرقاً** (D-268) — عَلَمٌ يرسله هو ولا يُستنتج */
  hasSpoiler?: boolean;
  /**
   * 🆕 **صورةٌ مرفوعةٌ مع المشاركة** (D-298) — **رابطُها العامُّ من مخزننا.**
   * **والرفعُ يقع في المتصفّح** (نمطُ صورة الملف حرفاً)، **ويصل هنا رابطاً.**
   */
  imageUrl?: string | null;
  /**
   * 🆕 **معرّفُ Giphy — لا رابط** (D-362، طلبُ أحمد: «خيار جنب الصور
   * GIF، سريع وبديل عن الصور»).
   *
   * 🔴 **ولماذا معرّفٌ لا رابط**: حارسُ D-298 يشترط بادئةَ مخزننا لأن
   * **رابطاً يصل من عميلٍ ونرسمه `<img>` للناس خطرٌ** — **والـGIF لا
   * يسكن مخزننا بحكم أنه «سريع» بلا رفع.** **فلا يعبر حدودَنا عنوانٌ
   * أصلاً**: يعبر معرّفٌ من حروفٍ وأرقام، **والرابطُ يُركَّب من قالبٍ
   * ثابتٍ عندنا** — **وحارسُه في القاعدة كذلك** (`check` في ١١١).
   */
  gifId?: string | null;
}): Promise<NewReply | null> {
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);
  const parentId = input.parentId ? uuid(input.parentId) : null;

  const { supabase, user } = await requireUser("reply", 15, 60_000);

  const body = String(input.body ?? "").replace(/\s{3,}/g, "  ").trim().slice(0, 2000);

  /**
   * 🔴 **والرابطُ يُحرَس ولا يُصدَّق** (D-298).
   *
   * **الرفعُ في المتصفّح، فالرابطُ يصل من العميل** — **وعميلٌ يستطيع أن
   * يرسل أيَّ رابطٍ في الدنيا**، ونحن نرسمه `<img>` لكلِّ من يفتح الغرفة:
   * **بكسلُ تتبّعٍ من نطاقٍ غريب، أو صورةٌ تُبدَّل بعد النشر، أو محتوًى
   * لا نملك حذفَه.**
   *
   * **فالشرطُ أن يكون من مخزننا نحن وحدَه** — بادئةُ المشروع الحقيقيّة
   * من البيئة لا من نصٍّ مكتوب. **وما لم يطابق يسقط صامتاً ولا يمنع
   * المشاركة**: النصُّ حقُّ صاحبه، **وصورةٌ لا نثق بها تغيب** (D-063).
   *
   * ⚠️ **وهذا حارسُ الشكل لا حارسُ الملكيّة**: القاعدةُ التي تمنع
   * الكتابةَ في مجلّد غيرك هي سياسةُ `storage.objects` نفسُها
   * (`foldername[1] = auth.uid()`) — **والحارسان طبقتان لا بديلان**.
   */
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const raw = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
  const imageUrl =
    base && raw.startsWith(`${base}/storage/v1/object/public/avatars/`) && raw.length < 500
      ? raw
      : null;

  /* 🆕 **والمعرّفُ يُحرَس بشكله لا بالثقة** (D-362) — طبقةٌ أولى هنا،
     **والثانيةُ قيدُ القاعدة في الهجرة ١١١**: **حارسان طبقتان لا
     بديلان** (D-066/D-221/D-298). */
  const rawGif = typeof input.gifId === "string" ? input.gifId.trim() : "";
  const gifId = /^[A-Za-z0-9]{1,64}$/.test(rawGif) ? rawGif : null;

  /* **ومشاركةٌ بصورةٍ بلا نصٍّ مشاركة** (D-298): **الصورةُ متنٌ كالمتن** —
     **وشرطٌ يطلب نصّاً بعد أن صار للمتن شكلان يرفض نصفَ ما يُرسَل**
     (D-214: الشرطُ يُوسَّع يومَ يُضاف إليه).
     🆕 **والشكلُ الثالث GIF** — **وتُوسَّع كلُّ حراساته لا حراسةُ طبقةٍ
     واحدة** (D-302 بنصّها: الواجهةُ والفعلُ والقاعدةُ معاً). */
  if (!body && !imageUrl && !gifId) return null;

  const { data, error } = await supabase
    .from("title_posts")
    .insert({
      tmdb_id: tmdbId,
      media_type: mediaType,
      user_id: user.id,
      body,
      parent_id: parentId,
      title: input.title?.slice(0, 200) || null,
      poster_path: input.posterPath || null,
      backdrop_path: input.backdropPath || null,
      /* **العَلَمُ من الكاتب وحده** (D-268): لا نستنتج الحرقَ من نصٍّ —
         **واستنتاجٌ خاطئٌ في هذا الباب يكشف ما أراد ستْرَه أو يستر ما
         أراد قولَه.** والقاعدةُ تحرس نوعَه، والافتراضُ `false`. */
      has_spoiler: input.hasSpoiler === true,
      /* 🆕 **والصورةُ في عمودها الحقيقيّ** (D-312، الهجرة ٩٧) — سكنت
         `data.img` يومَ D-298 لأن العمودَ كان يوجب `drop` خارجَ الإذن،
         **واليومَ أُذن فدارت الصفوفُ القديمة وكُتب الجديدُ في بيته**:
         `data` عادت حقيبةَ النشراتِ وحدَها (D-224: حقلٌ لمعنًى واحد). */
      image_path: imageUrl,
      /* 🆕 **والـGIF في عموده** (D-362، الهجرة ١١١) — **معرّفٌ لا رابط** */
      gif_id: gifId,
      /* **ولا `depth` هنا**: المُشغِّل يحسبه ويقيّده — **ورقمٌ يكتبه
         العميل يكذب**، وقيدُ العمق في القاعدة لا في الواجهة (D-193). */
    })
    .select("id, created_at")
    .single();
  if (error) fail(error);

  for (const p of talkPaths(tmdbId, mediaType)) revalidatePath(p);
  /* **وتبويبُ «نقاش» يُبطَل معها**: البطاقةُ تحمل عدّاداً ووقتَ آخر
     مشاركة، **فصفحةٌ لا تُبطَل تعرض غرفةً تحرّكت قبل دقيقةٍ ساكنةً.** */
  revalidatePath("/people");

  const who = await replyAuthor(supabase, user.id);
  return { replyId: String(data!.id), createdAt: String(data!.created_at), ...who };
}

/** حذفُ مشاركتي — والردودُ عليها تسقط معها (`on delete cascade`) */
export async function deleteMyTalkPost(input: {
  postId: string;
  tmdbId: number;
  mediaType: MediaType;
}): Promise<void> {
  const postId = uuid(input.postId);
  const tmdbId = intId(input.tmdbId);
  const mediaType = asMediaType(input.mediaType);

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("title_posts")
    .delete()
    .match({ id: postId, user_id: user.id });
  if (error) fail(error);

  for (const p of talkPaths(tmdbId, mediaType)) revalidatePath(p);
  revalidatePath("/people");
}

/** صامتٌ بلا عدّاد، والإخفاءُ عند العاشر في مُشغِّل SQL لا هنا */
export async function reportTalkPost(input: {
  postId: string;
  reason?: string;
}): Promise<void> {
  const postId = uuid(input.postId);
  const { supabase, user } = await requireUser("report", 10, 60_000);
  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const { error } = await supabase.from("title_post_reports").upsert(
    { post_id: postId, reporter_id: user.id, reason: reason || null },
    { onConflict: "post_id,reporter_id", ignoreDuplicates: true },
  );
  if (error) fail(error);
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


// ============================================================
//  التوثيق (157_verification_requests.sql · D-775)
// ============================================================

/** حالةُ الأهليّة كما تحسبها القاعدة — **لا تُحسب في الواجهة أبداً** */
export interface VerifyEligibility {
  complete: boolean;
  active: boolean;
  activeDays: number;
  needDays: number;
  clean: boolean;
  verified: boolean;
  eligible: boolean;
}

export type VerifyStatus = "pending" | "more_info" | "approved" | "rejected";

export interface VerifyState {
  status: VerifyStatus | null;
  kind: "person" | "org" | "media" | null;
  note: string | null;
  createdAt: string | null;
  decidedAt: string | null;
  nextApplyAt: string | null;
  canApply: boolean;
}

export interface LinkedProvider {
  provider: string;
  handle: string | null;
}

/**
 * 🆕 **قراءةُ شاشة التوثيق كاملةً في موجةٍ واحدة** (D-775).
 *
 * **ثلاثةُ نداءاتٍ متوازيةٍ لا متسلسلة** — والشاشةُ لا تُرسم قبل أبطئها
 * على كلّ حال، **فتسلسلُها يجمع أزمنتَها بلا فائدة** (عُرفُ D-470).
 * ⚠️ **والفشلُ يعني «غيرُ مؤهَّل» لا صفحةً مكسورة**: الأهليّةُ حارسٌ،
 * **وحارسٌ ينهار مفتوحاً أسوأُ من حارسٍ ينهار مغلقاً.**
 */
export async function getVerificationScreen(): Promise<{
  eligibility: VerifyEligibility;
  state: VerifyState;
  providers: LinkedProvider[];
}> {
  const closed: VerifyEligibility = {
    complete: false, active: false, activeDays: 0, needDays: 3,
    clean: false, verified: false, eligible: false,
  };
  const noState: VerifyState = {
    status: null, kind: null, note: null, createdAt: null,
    decidedAt: null, nextApplyAt: null, canApply: false,
  };
  try {
    const { supabase } = await requireUser("verify", 30, 60_000);
    const [e, s, p] = await Promise.all([
      supabase.rpc("verification_eligibility"),
      supabase.rpc("my_verification_state"),
      supabase.rpc("linked_providers"),
    ]);
    const ej = (e.data ?? {}) as Record<string, unknown>;
    const sj = (s.data ?? {}) as Record<string, unknown>;
    return {
      eligibility: {
        complete: !!ej.complete,
        active: !!ej.active,
        activeDays: Number(ej.activeDays ?? 0),
        needDays: Number(ej.needDays ?? 3),
        clean: !!ej.clean,
        verified: !!ej.verified,
        eligible: !!ej.eligible,
      },
      state: {
        status: (sj.status as VerifyStatus | null) ?? null,
        kind: (sj.kind as VerifyState["kind"]) ?? null,
        note: (sj.note as string | null) ?? null,
        createdAt: (sj.createdAt as string | null) ?? null,
        decidedAt: (sj.decidedAt as string | null) ?? null,
        nextApplyAt: (sj.nextApplyAt as string | null) ?? null,
        canApply: !!sj.canApply,
      },
      providers: ((p.data ?? []) as { provider: string; handle: string | null }[]).map((r) => ({
        provider: String(r.provider),
        handle: r.handle ?? null,
      })),
    };
  } catch {
    return { eligibility: closed, state: noState, providers: [] };
  }
}

/**
 * 🆕 **تقديمُ طلب التوثيق** (D-775).
 *
 * ⚠️ **ولا حارسَ أهليّةٍ هنا**: هو في جسم الدالّة (D-011) — **والواجهةُ
 * تُخفي الزرَّ، والقاعدةُ تمنع الطلب**، فمن نادى الفعلَ بلا شاشةٍ ارتدّ.
 * **والروابطُ تُنقّى قبل الإرسال**: `https` وحدَها وستّةٌ بحدٍّ أقصى —
 * **وحقلٌ حرٌّ يصل المراجعَ كما وصل يصير باباً لما ليس رابطاً.**
 */
export async function requestVerification(input: {
  kind: string;
  links: string[];
  website: string;
  sources: string;
  reason: string;
}) {
  const { supabase } = await requireUser("verify", 5, 60_000);
  const kind = ["person", "org", "media"].includes(input.kind) ? input.kind : "person";
  const links = (input.links ?? [])
    .map((l) => String(l ?? "").trim().slice(0, 300))
    .filter((l) => /^https:\/\/.+\..+/.test(l))
    .slice(0, 6);
  const website = String(input.website ?? "").trim().slice(0, 300);
  const reason = String(input.reason ?? "").trim().slice(0, 600);
  if (reason.length < 10) {
    throw new Error("اكتب سببَ الطلب بجملةٍ واضحة / Give a clear reason");
  }
  const { error } = await supabase.rpc("request_verification", {
    p_kind: kind,
    p_links: links,
    p_website: /^https:\/\/.+\..+/.test(website) ? website : null,
    p_sources: String(input.sources ?? "").trim().slice(0, 600) || null,
    p_reason: reason,
  });
  if (error) {
    /* **ورسالةُ القاعدة لا تُعرض كما هي**: `not eligible` ليست جملةً
       لقارئ. **والحالاتُ الثلاثُ تُترجم، وما عداها رسالةٌ عامّة.** */
    const m = error.message || "";
    if (m.includes("not eligible"))
      throw new Error("لم تكتمل الشروط بعد / Requirements not met yet");
    if (m.includes("cannot apply"))
      throw new Error("لا يمكن التقديم الآن / You cannot apply right now");
    throw new Error("تعذّر إرسال الطلب — حاول مجدداً / Could not submit, try again");
  }
  revalidatePath("/profile/settings/verify");
}

/** 🆕 طابورُ المراجعة — **الحارسُ في جسم الدالّة، والصفحةُ تُخفي لا تمنع** */
export async function adminVerificationQueue() {
  const { supabase } = await requireUser("adminverify", 60, 60_000);
  const { data, error } = await supabase.rpc("admin_verification_queue");
  if (error) return [];
  return (data ?? []) as {
    id: string;
    user_id: string;
    kind: "person" | "org" | "media";
    status: VerifyStatus;
    links: string[];
    website: string | null;
    sources: string | null;
    reason: string;
    proven: { provider: string; handle: string | null }[];
    created_at: string;
    note: string | null;
  }[];
}

/**
 * 🆕 **القرار** (D-775) — **وهو الطريقُ الوحيدُ إلى ختم التوثيق**:
 * لا منحةَ كتابةٍ على `profiles.verified_at` لأحد (الهجرة ١٥٦)،
 * **فالختمُ لا يُنال إلّا من مراجعٍ إنسان.**
 */
export async function adminDecideVerification(
  id: string,
  decision: "approved" | "rejected" | "more_info",
  note: string,
) {
  const { supabase } = await requireUser("adminverify", 30, 60_000);
  const { error } = await supabase.rpc("admin_decide_verification", {
    p_id: uuid(id),
    p_decision: decision,
    p_note: String(note ?? "").trim().slice(0, 400) || null,
  });
  if (error) throw new Error("تعذّر تنفيذ القرار / Could not apply the decision");
  revalidatePath("/admin/verify");
}
