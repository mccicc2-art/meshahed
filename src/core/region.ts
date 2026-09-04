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

/**
 * 🆕 **نسبةُ العمل إلى بلده** (D-562، طلبُ أحمد بلقطةٍ من تطبيقٍ آخر:
 * «أبغاك تكتب أعمال تركية أو أعمال مصرية بحيث الشخص يعرف اللهجة
 * المستخدمة في الفلم»).
 *
 * **ولماذا الصفةُ لا اسمُ البلد**: السطرُ يصف العملَ لا يذكر مكاناً —
 * **«فيلم مصري» جملةٌ، و«فيلم مصر» ليست**. **والصفةُ المذكّرةُ المفردةُ
 * تكفي للاثنين** («فيلم» و«مسلسل» مذكّران).
 *
 * **ولماذا جدولٌ مكتوبٌ لا `Intl.DisplayNames`:** تلك تُرجع **اسمَ
 * البلد** («تركيا») **لا نسبتَه** («تركي») — **ولا صيغةَ نسبةٍ في
 * المعيار أصلاً.** **فالجدولُ هو الجواب، وهي الاحتياط** حين يعود رمزٌ
 * لا نعرفه: **اسمُ بلدٍ يُقرأ خيرٌ من رمزَي حرفٍ لا يعنيان شيئاً**
 * (D-217) — **وهو أسوأُ ما يقع، ويبقى مفهوماً.**
 *
 * ⚠️ **والقائمةُ قصيرةٌ عمداً كأختها أعلاه**: بلدانُ الإنتاج التي تصل
 * صفحاتِنا فعلاً. **وإضافةُ بلدٍ سطرٌ واحد.**
 */
const COUNTRY_ADJECTIVES: Record<string, { ar: string; en: string }> = {
  // العربية والجوار — أوّلاً لأنها أكثر ما يُقرأ عندنا
  EG: { ar: "مصري", en: "Egyptian" },
  SA: { ar: "سعودي", en: "Saudi" },
  AE: { ar: "إماراتي", en: "Emirati" },
  KW: { ar: "كويتي", en: "Kuwaiti" },
  QA: { ar: "قطري", en: "Qatari" },
  BH: { ar: "بحريني", en: "Bahraini" },
  OM: { ar: "عُماني", en: "Omani" },
  JO: { ar: "أردني", en: "Jordanian" },
  LB: { ar: "لبناني", en: "Lebanese" },
  SY: { ar: "سوري", en: "Syrian" },
  IQ: { ar: "عراقي", en: "Iraqi" },
  PS: { ar: "فلسطيني", en: "Palestinian" },
  YE: { ar: "يمني", en: "Yemeni" },
  SD: { ar: "سوداني", en: "Sudanese" },
  LY: { ar: "ليبي", en: "Libyan" },
  MA: { ar: "مغربي", en: "Moroccan" },
  DZ: { ar: "جزائري", en: "Algerian" },
  TN: { ar: "تونسي", en: "Tunisian" },
  MR: { ar: "موريتاني", en: "Mauritanian" },
  SO: { ar: "صومالي", en: "Somali" },
  TR: { ar: "تركي", en: "Turkish" },
  IR: { ar: "إيراني", en: "Iranian" },
  IL: { ar: "إسرائيلي", en: "Israeli" },
  // الغرب
  US: { ar: "أمريكي", en: "American" },
  GB: { ar: "بريطاني", en: "British" },
  IE: { ar: "إيرلندي", en: "Irish" },
  CA: { ar: "كندي", en: "Canadian" },
  AU: { ar: "أسترالي", en: "Australian" },
  NZ: { ar: "نيوزيلندي", en: "New Zealand" },
  FR: { ar: "فرنسي", en: "French" },
  DE: { ar: "ألماني", en: "German" },
  IT: { ar: "إيطالي", en: "Italian" },
  ES: { ar: "إسباني", en: "Spanish" },
  PT: { ar: "برتغالي", en: "Portuguese" },
  NL: { ar: "هولندي", en: "Dutch" },
  BE: { ar: "بلجيكي", en: "Belgian" },
  CH: { ar: "سويسري", en: "Swiss" },
  AT: { ar: "نمساوي", en: "Austrian" },
  SE: { ar: "سويدي", en: "Swedish" },
  NO: { ar: "نرويجي", en: "Norwegian" },
  DK: { ar: "دنماركي", en: "Danish" },
  FI: { ar: "فنلندي", en: "Finnish" },
  IS: { ar: "آيسلندي", en: "Icelandic" },
  PL: { ar: "بولندي", en: "Polish" },
  CZ: { ar: "تشيكي", en: "Czech" },
  HU: { ar: "مجري", en: "Hungarian" },
  RO: { ar: "روماني", en: "Romanian" },
  GR: { ar: "يوناني", en: "Greek" },
  RU: { ar: "روسي", en: "Russian" },
  UA: { ar: "أوكراني", en: "Ukrainian" },
  // آسيا
  JP: { ar: "ياباني", en: "Japanese" },
  KR: { ar: "كوري", en: "Korean" },
  CN: { ar: "صيني", en: "Chinese" },
  HK: { ar: "هونغ كونغي", en: "Hong Kong" },
  TW: { ar: "تايواني", en: "Taiwanese" },
  IN: { ar: "هندي", en: "Indian" },
  PK: { ar: "باكستاني", en: "Pakistani" },
  BD: { ar: "بنغلاديشي", en: "Bangladeshi" },
  TH: { ar: "تايلندي", en: "Thai" },
  VN: { ar: "فيتنامي", en: "Vietnamese" },
  ID: { ar: "إندونيسي", en: "Indonesian" },
  MY: { ar: "ماليزي", en: "Malaysian" },
  PH: { ar: "فلبيني", en: "Filipino" },
  SG: { ar: "سنغافوري", en: "Singaporean" },
  // أمريكا اللاتينية وأفريقيا
  BR: { ar: "برازيلي", en: "Brazilian" },
  MX: { ar: "مكسيكي", en: "Mexican" },
  AR: { ar: "أرجنتيني", en: "Argentine" },
  CL: { ar: "تشيلي", en: "Chilean" },
  CO: { ar: "كولومبي", en: "Colombian" },
  ZA: { ar: "جنوب أفريقي", en: "South African" },
  NG: { ar: "نيجيري", en: "Nigerian" },
  KE: { ar: "كيني", en: "Kenyan" },
};

/** نسبةُ بلدٍ واحد — الجدولُ أوّلاً، ثم اسمُ البلد، ثم الرمزُ كما هو */
export function countryAdjective(code: string, locale: "ar" | "en"): string {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  const known = COUNTRY_ADJECTIVES[c];
  if (known) return locale === "en" ? known.en : known.ar;
  /* **الاحتياطُ لا يكذب**: يقول اسمَ البلد لا نسبتَه — **وخلطُ صيغتين
     في سطرٍ نادرٍ أهونُ من رمزٍ لا يُقرأ.** و`try` لأن `DisplayNames`
     قد تغيب في محرّكٍ قديم. */
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(c) ?? c;
  } catch {
    return c;
  }
}

/**
 * نسبُ العمل مرتّبةً ومنقّاة — **بلدُ المنشأ أوّلاً ثم بلدانُ الإنتاج**.
 *
 * **والترتيبُ هو الرسالة**: **الأوّلُ هو اللهجةُ** التي سأل عنها أحمد —
 * **وبلدانُ الإنتاج بعده تمويلٌ وشراكة**، تُقال ولا تتصدّر. **والسقفُ
 * ثلاثةٌ كسقف الأنواع** في الصفِّ نفسِه.
 */
export function originAdjectives(
  input: {
    origin?: string[] | null;
    production?: { iso_3166_1?: string }[] | null;
  },
  locale: "ar" | "en",
  limit = 3,
): string[] {
  const codes: string[] = [];
  const push = (raw: string | undefined | null) => {
    const c = (raw ?? "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(c) && !codes.includes(c)) codes.push(c);
  };
  for (const c of input.origin ?? []) push(c);
  for (const p of input.production ?? []) push(p?.iso_3166_1);
  return codes
    .slice(0, limit)
    .map((c) => countryAdjective(c, locale))
    .filter(Boolean);
}
