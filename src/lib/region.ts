// منطقة المشاهدة — آمنة للاستخدام في الخادم والمتصفح معاً (لا next/headers).

/**
 * أين يعيش المستخدم، لأجل «أين أشاهده».
 *
 * توفّر الأعمال على المنصّات يختلف بين بلدٍ وبلد اختلافاً جوهرياً: عملٌ على
 * نتفلكس السعودية قد لا يكون على نتفلكس مصر، و«شاهد» لا يعمل في أوروبا.
 * وكان التطبيق يجرّب السعودية ثم الإمارات ثم مصر ثم أمريكا ويعرض أوّل ما
 * وجده — فيرى المستخدم في القاهرة منصّةً لا يستطيع فتحها، بلا أن يُقال له
 * إنّ الجواب عن بلدٍ آخر.
 *
 * فالمنطقة صارت اختياراً محفوظاً في كوكي، كما الثيم واللغة (D-014): يقرأها
 * الخادم قبل أوّل رسمة، فلا تحتاج عموداً في قاعدة البيانات ولا هجرةً —
 * وهي تفضيلُ عرضٍ لا بيانات حساب.
 */

export const REGION_COOKIE = "region";

/** الافتراضي حين لا اختيار — جمهور التطبيق الأول */
export const DEFAULT_REGION = "SA";

export interface WatchRegion {
  code: string;
  ar: string;
  en: string;
}

/**
 * القائمة قصيرة عمداً: البلدان العربية التي لها سوق بثٍّ حقيقي، ثم
 * أمريكا وبريطانيا للمغترِبين. قائمةٌ بستّين بلداً تُقرأ جداراً لا خياراً —
 * ومن يحتاج غيرها يفتح رابط JustWatch من صفحة العمل.
 */
export const WATCH_REGIONS: WatchRegion[] = [
  { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { code: "AE", ar: "الإمارات", en: "UAE" },
  { code: "KW", ar: "الكويت", en: "Kuwait" },
  { code: "QA", ar: "قطر", en: "Qatar" },
  { code: "BH", ar: "البحرين", en: "Bahrain" },
  { code: "OM", ar: "عُمان", en: "Oman" },
  { code: "EG", ar: "مصر", en: "Egypt" },
  { code: "JO", ar: "الأردن", en: "Jordan" },
  { code: "LB", ar: "لبنان", en: "Lebanon" },
  { code: "IQ", ar: "العراق", en: "Iraq" },
  { code: "MA", ar: "المغرب", en: "Morocco" },
  { code: "DZ", ar: "الجزائر", en: "Algeria" },
  { code: "TN", ar: "تونس", en: "Tunisia" },
  { code: "US", ar: "الولايات المتحدة", en: "United States" },
  { code: "GB", ar: "بريطانيا", en: "United Kingdom" },
];

export function normalizeRegion(value: string | undefined | null): string {
  const up = (value ?? "").trim().toUpperCase();
  return WATCH_REGIONS.some((r) => r.code === up) ? up : DEFAULT_REGION;
}

export function regionName(code: string, locale: "ar" | "en"): string {
  const found = WATCH_REGIONS.find((r) => r.code === code);
  if (!found) return code;
  return locale === "en" ? found.en : found.ar;
}

/**
 * ترتيب المحاولة: بلد المستخدم أوّلاً، ثم جيرانه، ثم أمريكا.
 *
 * السقوط لم يُلغَ بل أُعيد ترتيبه — وصفحةٌ تقول «غير متاح» لعملٍ متاحٍ في
 * الجوار أسوأ من إجابةٍ عن الجوار **ما دامت الصفحة تسمّي البلد الذي
 * أجابت عنه**. وهذا ما تفعله `WatchChip` الآن حين يختلف البلدان.
 */
export function regionChain(region: string): string[] {
  const base = normalizeRegion(region);
  const rest = ["SA", "AE", "EG", "US"].filter((r) => r !== base);
  return [base, ...rest];
}

/**
 * 🆕 **علمُ البلد من رمزه** (D-557، تصميمُ أحمد: مربّعُ علمٍ قبل الاسم).
 *
 * **ولا صورةَ ولا مكتبة**: حرفا ISO-2 يُزاحان إلى نطاق «مؤشّرات
 * الأقاليم» في يونيكود فيرسمهما النظامُ علماً — **صفرُ بايتٍ على
 * الشبكة، وصفرُ أصلٍ يُصان.**
 *
 * ⚠️ **وما لا يعرفه النظامُ يُرسم حرفين** لا مربّعاً فارغاً — **وهو
 * أسوأُ ما يمكن أن يقع، ويبقى مقروءاً.**
 */
export function regionFlag(code: string): string {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(
    0x1f1e6 + c.charCodeAt(0) - 65,
    0x1f1e6 + c.charCodeAt(1) - 65,
  );
}
