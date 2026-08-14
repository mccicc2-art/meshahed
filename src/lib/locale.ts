import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, getDict, type Locale, type Dict } from "@/lib/i18n";
import { REGION_COOKIE, DEFAULT_REGION, normalizeRegion } from "@/lib/region";
import {
  TAB_SURFACES,
  parseTabPrefs,
  FEED_STRANGERS_COOKIE,
  parseFeedStrangers,
  type TabPref,
  type TabSurface,
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
