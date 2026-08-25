import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, getDict, type Locale, type Dict } from "@/lib/i18n";
import { REGION_COOKIE, DEFAULT_REGION, normalizeRegion } from "@/lib/region";
import { TITLE_MODE_COOKIE, parseTitleMode, type TitleMode } from "@/lib/titleMode";
import {
  TAB_SURFACES,
  parseTabPrefs,
  FEED_STRANGERS_COOKIE,
  parseFeedStrangers,
  type TabPref,
  type TabSurface,
  FEED_SORT_COOKIE,
  parseFeedSort,
  TALK_FOLLOWED_COOKIE,
  parseTalkFollowed,
  TRANSLATE_COOKIE,
  parseTranslate,
} from "@/lib/tabPrefs";

export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    const saved = store.get(LOCALE_COOKIE)?.value;
    if (saved) return normalizeLocale(saved);

    // زائرٌ جديد بلا اختيار محفوظ: لغة جهازه هي لغته الافتراضية —
    // أول وسمٍ في Accept-Language يحسم، والعربية للبقية
    const accept = (await headers()).get("accept-language") ?? "";
    const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
    return first.startsWith("en") ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export async function getT(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale();
  return { locale, t: getDict(locale) };
}

/**
 * بلد المشاهدة — من الكوكي، فإن لم يوجد فمن رأس `x-vercel-ip-country`.
 *
 * التخمين من عنوان الشبكة يُستعمل مرّةً كافتراضٍ أوّلي لا أكثر: الرأس يأتي
 * مجّاناً من Vercel، ويُخطئ مع VPN — ولذلك لا يُكتب في الكوكي ولا يَغلب
 * اختياراً صريحاً. من اختار بلده مرّة بقي اختياره.
 */
export async function getWatchRegion(): Promise<string> {
  try {
    const store = await cookies();
    const saved = store.get(REGION_COOKIE)?.value;
    if (saved) return normalizeRegion(saved);

    const guess = (await headers()).get("x-vercel-ip-country");
    return normalizeRegion(guess);
  } catch {
    return DEFAULT_REGION;
  }
}

/**
 * تفضيلاتُ تبويبات سطحٍ واحد (الترتيب + الإظهار) — من الكوكي، **قبل أوّل
 * رسمة**: الرأس يُرسم مرتَّباً مصفّىً من أوّل بايت، فلا يومض تبويبٌ ثم
 * يختفي ولا يقفز إلى موضعه.
 *
 * والقصُّ يتكرّر هنا عمداً (نفس ثلاثيّة D-177): العميل يُعطّل، والكاتب
 * يقصّ، والقارئ يقصّ. **حارسٌ على طرفٍ واحد ليس حارساً.**
 */
/**
 * **هل يُظهر خطُّ النشاط من لا يتابعهم؟** (D-255) — يُقرأ على الخادم
 * قبل أوّل رسمة، **فلا يومض صفُّ غريبٍ ثم يختفي.**
 */
export async function getFeedStrangers(): Promise<boolean> {
  try {
    const store = await cookies();
    return parseFeedStrangers(store.get(FEED_STRANGERS_COOKIE)?.value);
  } catch {
    return true;
  }
}

/** 🆕 **ترتيبُ خطّ النشاط** (D-306) — من الخادم قبل أوّل رسمة */
export async function getFeedSort(): Promise<"smart" | "latest"> {
  try {
    const store = await cookies();
    return parseFeedSort(store.get(FEED_SORT_COOKIE)?.value);
  } catch {
    return "smart";
  }
}

/** 🆕 **«النقاشات»: أعمالي المتابَعة فقط؟** (D-306) */
export async function getTalkFollowedOnly(): Promise<boolean> {
  try {
    const store = await cookies();
    return parseTalkFollowed(store.get(TALK_FOLLOWED_COOKIE)?.value);
  } catch {
    return false;
  }
}

/** 🆕 **هل الترجمةُ التلقائيّة مفعّلة؟** (D-309) */
export async function getTranslateEnabled(): Promise<boolean> {
  try {
    const store = await cookies();
    return parseTranslate(store.get(TRANSLATE_COOKIE)?.value);
  } catch {
    return true;
  }
}

export async function getTabPrefs(surface: TabSurface): Promise<TabPref[]> {
  const spec = TAB_SURFACES[surface];
  try {
    const store = await cookies();
    return parseTabPrefs(
      surface,
      store.get(spec.cookie)?.value,
      spec.legacyHiddenCookie ? store.get(spec.legacyHiddenCookie)?.value : null,
    );
  } catch {
    return parseTabPrefs(surface, null);
  }
}

/**
 * 🆕 **طريقةُ عرض أسماء الأعمال** (D-544) — **تُقرأ على الخادم قبل أوّل
 * رسمة**، **فلا يومض اسمٌ بطريقةٍ ثمّ يُستبدل** ولا يختلف ما يرسمه
 * الخادمُ عمّا يرسمه العميل (`hydration mismatch`).
 *
 * **وكوكيٌّ لا عمود** — نفسُ حجّة `setWatchRegion` (D-014): **تفضيلُ
 * عرضٍ يعمل للزائر بلا حساب**، ولا يستحقّ هجرةً ولا صفّاً.
 *
 * ⚖️ 🆕 **واللغةُ خرجت من القراءة** (D-593): كانت الصوتيّةُ تُردّ إلى
 * الافتراض في الواجهة الإنجليزيّة — **وسقط القيدُ من الكاتب والقارئ
 * معاً بحكم أحمد** (نقضُ سطرِ مواصفة D-544).
 */
export async function getTitleMode(): Promise<TitleMode> {
  try {
    const store = await cookies();
    return parseTitleMode(store.get(TITLE_MODE_COOKIE)?.value);
  } catch {
    return "localized";
  }
}
