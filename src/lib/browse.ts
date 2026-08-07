// تصنيف التصفّح — آمن للاستخدام في الخادم والمتصفح معاً (لا next/headers).
//
// لماذا تصنيفٌ خاصّ بدل GENRES في media.ts: قوائم TMDB منفصلة للأفلام
// وللمسلسلات، ومعرّفاتها تختلف لنفس النوع الدرامي. «أكشن» في الأفلام
// معرّفان (28 أكشن، 12 مغامرة) وفي المسلسلات معرّف واحد (10759 أكشن
// ومغامرة)، و«خيال علمي» ينقسم في الأفلام إلى 878 و14 ويجتمع في
// المسلسلات في 10765. فلو عرضنا قائمةً واحدة بمعرّفات المسلسلات — وهو
// ما تفعله GENRES لأنها لتفضيلات الملف الشخصي — لعادت فلاتر الأفلام
// فارغة. هنا كل نوعٍ يحمل معرّفاته في الجهتين، وما لا مقابل له في جهة
// (الرعب والرومانسي في المسلسلات، الواقع في الأفلام) يُخفى تلقائياً
// عند اختيار تلك الجهة بدل أن يعطي نتيجةً فارغة.

export type BrowseType = "all" | "movie" | "tv";

/**
 * نافذة الترتيب — المحور الأعلى في «اكتشف» بعد نقل الأنواع إلى الفلتر
 * (طلب المالك). ليست فلتر تاريخٍ بل معنى «الأفضل»: أسبوعي = الرائج هذا
 * الأسبوع، سنوي = أعلى هذه السنة، كل الأوقات = الأعلى تاريخياً. تُعيد ضبط
 * كل الرفوف دفعةً واحدة، فيضغط الشخص «سنوي» فتتحوّل «أفضل هذا الأسبوع»
 * كلّها إلى «هذه السنة».
 */
export type BrowseWin = "week" | "year" | "all";

export interface BrowseGenre {
  /** المعرّف في الرابط — ثابتٌ لا يتغيّر بتغيّر اللغة */
  slug: string;
  ar: string;
  en: string;
  /** معرّفات TMDB للأفلام — فارغة تعني: لا مقابل لهذا النوع في الأفلام */
  movie: number[];
  /** معرّفات TMDB للمسلسلات */
  tv: number[];
}

/** الترتيب مقصود: الأكثر طلباً أولاً، فأول ثلاث رقائق تكفي أكثر الناس */
export const BROWSE_GENRES: BrowseGenre[] = [
  { slug: "action", ar: "أكشن ومغامرة", en: "Action & Adventure", movie: [28, 12], tv: [10759] },
  { slug: "comedy", ar: "كوميدي", en: "Comedy", movie: [35], tv: [35] },
  { slug: "drama", ar: "دراما", en: "Drama", movie: [18], tv: [18] },
  { slug: "crime", ar: "جريمة", en: "Crime", movie: [80], tv: [80] },
  { slug: "thriller", ar: "إثارة وتشويق", en: "Thriller", movie: [53], tv: [] },
  { slug: "mystery", ar: "غموض", en: "Mystery", movie: [9648], tv: [9648] },
  { slug: "scifi", ar: "خيال علمي وفانتازيا", en: "Sci-Fi & Fantasy", movie: [878, 14], tv: [10765] },
  { slug: "horror", ar: "رعب", en: "Horror", movie: [27], tv: [] },
  { slug: "romance", ar: "رومانسي", en: "Romance", movie: [10749], tv: [] },
  { slug: "animation", ar: "رسوم متحركة", en: "Animation", movie: [16], tv: [16] },
  { slug: "documentary", ar: "وثائقي", en: "Documentary", movie: [99], tv: [99] },
  { slug: "family", ar: "عائلي", en: "Family", movie: [10751], tv: [10751] },
  { slug: "war", ar: "حربي وسياسي", en: "War & Politics", movie: [10752], tv: [10768] },
  { slug: "reality", ar: "تلفزيون الواقع", en: "Reality", movie: [], tv: [10764] },
  { slug: "western", ar: "غربي", en: "Western", movie: [37], tv: [37] },
];

export function browseGenreName(g: BrowseGenre, locale: "ar" | "en") {
  return locale === "en" ? g.en : g.ar;
}

/**
 * لغة العمل الأصلية.
 *
 * `with_original_language` لا `with_origin_country`: البلد يُخطئ كثيراً —
 * مسلسلٌ تركيّ تنتجه نتفلكس يُسجَّل أمريكيّ الأصل، وعملٌ عربيّ صُوِّر في
 * لندن يُسجَّل بريطانيّاً. اللغة أصدق دلالةً على ما يقصده من يقول «أبي
 * شيئاً تركياً».
 *
 * والقائمة قصيرة عمداً: سبعُ لغاتٍ تغطّي ما يُطلب فعلاً، وقائمةٌ بثمانين
 * لغةً تُقرأ جداراً لا خياراً.
 */
export interface BrowseLang {
  code: string;
  ar: string;
  en: string;
}

export const BROWSE_LANGS: BrowseLang[] = [
  { code: "ar", ar: "عربي", en: "Arabic" },
  { code: "tr", ar: "تركي", en: "Turkish" },
  { code: "en", ar: "إنجليزي", en: "English" },
  { code: "ko", ar: "كوري", en: "Korean" },
  { code: "es", ar: "إسباني", en: "Spanish" },
  { code: "hi", ar: "هندي", en: "Hindi" },
  { code: "ja", ar: "ياباني", en: "Japanese" },
];

export function browseLangName(l: BrowseLang, locale: "ar" | "en") {
  return locale === "en" ? l.en : l.ar;
}

/**
 * بلد الإنتاج — محورٌ يظهر مع العربية وحدها.
 *
 * اللغة تفصل التركيّ عن الكوريّ فصلاً تامّاً، لكنها **لا تفصل السعوديّ عن
 * المصريّ عن الكويتيّ**: ثلاثتها `ar`. ومن يكتب «مسلسلات سعودية» يقصد
 * البلد لا اللغة. فالبلد هنا ليس بديلاً عن اللغة بل تفريعٌ لها عند اللغة
 * الوحيدة التي تحتاجه.
 *
 * ولماذا لا يظهر مع بقيّة اللغات: يصير محورين يقولان الشيء نفسه —
 * «تركي» في اللغة و«تركيا» في البلد — واختلافُهما في الحواف (مسلسل تركيّ
 * تنتجه نتفلكس) يعطي نتيجتين مختلفتين لسؤالٍ واحد، وهو أسوأ من غياب
 * الخيار. `with_origin_country` مدعومٌ في `/discover` للأفلام والمسلسلات
 * معاً.
 *
 * والقائمة بلدان الإنتاج العربية التي لها إنتاجٌ فعليّ مسجَّل في TMDB —
 * لا كل الدول: خانةٌ تعود فارغةً دائماً خيارٌ كاذب.
 */
export interface BrowseCountry {
  code: string;
  ar: string;
  en: string;
}

export const BROWSE_COUNTRIES: BrowseCountry[] = [
  { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { code: "EG", ar: "مصر", en: "Egypt" },
  { code: "KW", ar: "الكويت", en: "Kuwait" },
  { code: "AE", ar: "الإمارات", en: "UAE" },
  { code: "LB", ar: "لبنان", en: "Lebanon" },
  { code: "SY", ar: "سوريا", en: "Syria" },
  { code: "JO", ar: "الأردن", en: "Jordan" },
  { code: "IQ", ar: "العراق", en: "Iraq" },
  { code: "MA", ar: "المغرب", en: "Morocco" },
  { code: "TN", ar: "تونس", en: "Tunisia" },
  { code: "QA", ar: "قطر", en: "Qatar" },
  { code: "BH", ar: "البحرين", en: "Bahrain" },
];

export function browseCountryName(c: BrowseCountry, locale: "ar" | "en") {
  return locale === "en" ? c.en : c.ar;
}

/** محور البلد لا معنى له إلا مع العربية — انظر التعليق أعلاه */
export function countryApplies(lang: BrowseLang | null): boolean {
  return lang?.code === "ar";
}

/** حقبة الإصدار — مدىً لا سنةً مفردة: السنة الواحدة تُفرغ الصفّ */
export interface BrowseEra {
  slug: string;
  ar: string;
  en: string;
  /** أوّل تاريخٍ مقبول (شامل) */
  from: string | null;
  /** آخر تاريخٍ مقبول (شامل) */
  to: string | null;
}

export const BROWSE_ERAS: BrowseEra[] = [
  { slug: "2020s", ar: "٢٠٢٠ فما بعد", en: "2020s", from: "2020-01-01", to: null },
  { slug: "2010s", ar: "٢٠١٠–٢٠١٩", en: "2010s", from: "2010-01-01", to: "2019-12-31" },
  { slug: "2000s", ar: "٢٠٠٠–٢٠٠٩", en: "2000s", from: "2000-01-01", to: "2009-12-31" },
  { slug: "older", ar: "أقدم", en: "Older", from: null, to: "1999-12-31" },
];

export function browseEraName(e: BrowseEra, locale: "ar" | "en") {
  return locale === "en" ? e.en : e.ar;
}

/** أدنى تقييم — ثلاث عتباتٍ تكفي، وعشرُ خاناتٍ تُشلّ الاختيار */
export const BROWSE_RATES = [7, 8, 9] as const;
export type BrowseRate = (typeof BROWSE_RATES)[number];

/** هل لهذا النوع الدرامي مقابلٌ في جهة المحتوى المختارة؟ */
export function genreFitsType(g: BrowseGenre, type: BrowseType): boolean {
  if (type === "movie") return g.movie.length > 0;
  if (type === "tv") return g.tv.length > 0;
  return g.movie.length > 0 || g.tv.length > 0;
}

/** العمل كما ترسمه بطاقة الشبكة — بلا حقول TMDB التي لا تظهر */
export interface BrowseItem {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  poster: string | null;
  year: string;
}

export interface BrowseQuery {
  type: BrowseType;
  /** نافذة الترتيب — أسبوعي/سنوي/كل الأوقات، المحور الأعلى */
  win: BrowseWin;
  genre: BrowseGenre | null;
  /** لغة العمل الأصلية */
  lang: BrowseLang | null;
  /** بلد الإنتاج — مع العربية وحدها */
  country: BrowseCountry | null;
  /** معرّف منصّة الاشتراك عند TMDB — القائمة تُجلب من TMDB لا تُكتب هنا */
  provider: number | null;
  /** حقبة الإصدار */
  era: BrowseEra | null;
  /** أدنى تقييم */
  rate: BrowseRate | null;
  /** هل المستخدم يتصفّح فعلاً؟ لو لا، تبقى صفحة اكتشف على صفوفها المنسّقة */
  active: boolean;
}

/**
 * قراءة الفلتر من معاملات الرابط.
 *
 * كل قيمة غير معروفة تسقط إلى الافتراضي بدل أن ترفع خطأً: الرابط مدخلُ
 * مستخدمٍ يمكن أن يُكتب باليد أو يُشارك بعد تغيّر التصنيف — والروابط
 * القديمة تحمل `sort` الذي سقط من الواجهة، فيُقرأ ويُتجاهل بلا كسر.
 */
export function parseBrowse(params: {
  type?: string;
  win?: string;
  g?: string;
  sort?: string;
  lang?: string;
  co?: string;
  p?: string;
  era?: string;
  rate?: string;
}): BrowseQuery {
  const type: BrowseType =
    params.type === "movie" || params.type === "tv" ? params.type : "all";

  // النافذة: أسبوعي هو الافتراضي فيُحذف من الرابط، وغيرُه يُثبَّت
  const win: BrowseWin = params.win === "year" || params.win === "all" ? params.win : "week";

  const found = BROWSE_GENRES.find((g) => g.slug === params.g) ?? null;
  const genre = found && genreFitsType(found, type) ? found : null;

  const lang = BROWSE_LANGS.find((l) => l.code === params.lang) ?? null;
  /* البلد يسقط تلقائياً متى لم تكن اللغة عربية: الرابط قد يُكتب باليد أو
     يُشارَك ثم تُبدَّل لغته، وخيارٌ مطبَّقٌ لا يظهر في الواجهة أسوأ من
     خيارٍ ضائع */
  const country = countryApplies(lang)
    ? (BROWSE_COUNTRIES.find((c) => c.code === params.co) ?? null)
    : null;
  const providerNum = Number(params.p);
  const provider = Number.isInteger(providerNum) && providerNum > 0 ? providerNum : null;
  const era = BROWSE_ERAS.find((e) => e.slug === params.era) ?? null;
  const rateNum = Number(params.rate);
  const rate = (BROWSE_RATES as readonly number[]).includes(rateNum)
    ? (rateNum as BrowseRate)
    : null;

  return {
    type,
    win,
    genre,
    lang,
    country,
    provider,
    era,
    rate,
    // النافذة لا تجعل التصفّح «نشطاً»: هي المحور الافتراضي كالتبويبات
    // سابقاً، وتغييرها يُعيد ضبط الرفوف لا يستبدلها بشبكة نتائج
    active:
      type !== "all" ||
      genre !== null ||
      lang !== null ||
      country !== null ||
      provider !== null ||
      era !== null ||
      rate !== null,
  };
}

/**
 * عدد الفلاتر المخفيّة خلف الورقة — للعدّاد على زرّ الفلاتر.
 *
 * النوع الدرامي **يُحسب الآن**: انتقل إلى داخل الورقة (طلب المالك) بعد أن
 * حلّت نافذةُ الترتيب محلّ صفّ تبويباته، فصار كبقيّة الفلاتر المخفيّة.
 * النافذة نفسها لا تُحسب: هي المحور الظاهر، لا شيءٌ وراء الزرّ.
 */
export function browseCount(q: BrowseQuery) {
  return (
    (q.type !== "all" ? 1 : 0) +
    (q.genre ? 1 : 0) +
    (q.lang ? 1 : 0) +
    (q.country ? 1 : 0) +
    (q.provider ? 1 : 0) +
    (q.era ? 1 : 0) +
    (q.rate ? 1 : 0)
  );
}

/**
 * هل يتجاوز الفلتر ما تقدر عليه قوائم TMDB الجاهزة؟
 *
 * `/trending` و`/movie/upcoming` و`/tv/on_the_air` لا تقبل لغةً ولا مدىً
 * زمنياً ولا عتبة تقييم — تقبل الجهة والنوع الدرامي فقط (والأخير بتصفيةٍ
 * عندنا). فمتى طُلب أحد الثلاثة انتقلنا إلى `/discover` الذي يقبلها كلّها،
 * وضحّينا بجودة الانتقاء التحريري مقابل أن يصل المستخدم إلى ما طلبه.
 */
export function needsDiscover(q: BrowseQuery) {
  return (
    q.lang !== null ||
    q.country !== null ||
    q.provider !== null ||
    q.era !== null ||
    q.rate !== null
  );
}

/** بناء رابط «اكتشف» من فلترٍ — القيم الافتراضية تُحذف فيبقى نظيفاً */
export function browseHref(q: {
  type?: BrowseType;
  win?: BrowseWin;
  g?: string | null;
  lang?: string | null;
  co?: string | null;
  p?: number | null;
  era?: string | null;
  rate?: number | null;
}) {
  const p = new URLSearchParams();
  if (q.type && q.type !== "all") p.set("type", q.type);
  if (q.win && q.win !== "week") p.set("win", q.win);
  if (q.g) p.set("g", q.g);
  if (q.lang) p.set("lang", q.lang);
  if (q.co) p.set("co", q.co);
  if (q.p) p.set("p", String(q.p));
  if (q.era) p.set("era", q.era);
  if (q.rate) p.set("rate", String(q.rate));
  const qs = p.toString();
  return qs ? `/news?${qs}` : "/news";
}

/** مفتاحٌ يتغيّر بتغيّر الفلتر — يُستخدم لإعادة تركيب النتائج وهياكلها */
export function browseKey(q: BrowseQuery, page = 1) {
  return [
    q.type,
    q.win,
    q.genre?.slug ?? "all",
    q.lang?.code ?? "any",
    q.country?.code ?? "any",
    q.provider ?? "any",
    q.era?.slug ?? "any",
    q.rate ?? "any",
    page,
  ].join(":");
}
