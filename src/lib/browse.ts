import { AWARDS } from "./awards";

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
 * تبويبات «اكتشف» الثلاثة — أفلام، مسلسلات، قوائم (طلب أحمد 9 Aug:
 * «خلها ثلاث تبويبات عشان نخفف الضغط»).
 *
 * كان الرأس تبويبين (أعمال/قوائم) وجهةُ المحتوى فلتراً في الورقة —
 * فانقسم تبويب الأعمال إلى جهتيه: كل تبويبٍ نصفُ الصفوف، والجهة صعدت
 * من الورقة إلى الرأس (نفس درس D-099: المحور الذي صار في الرأس يغادر
 * الورقة — أداتان على نفس السؤال لبس). الافتراضي «أفلام».
 */
export type DiscoverTab = "movies" | "shows" | "anime" | "lists";

/** قراءة التبويب من الرابط — والروابط القديمة تُهدى لموضعها الجديد:
    `tab=titles` ومعامل `type` القديم يحسمان بين أفلام ومسلسلات */
export function parseDiscoverTab(v: string | undefined, legacyType?: string): DiscoverTab {
  if (v === "lists") return "lists";
  if (v === "shows") return "shows";
  /* تبويبٌ رابع للأنمي (D-169، طلب أحمد): كان الأنمي صفَّين يتيمين داخل
     تبويب المسلسلات — و**أفلامه لم يكن لها صفٌّ قطّ**. صار له بابه. */
  if (v === "anime") return "anime";
  return legacyType === "tv" ? "shows" : "movies";
}

/**
 * نافذة الترتيب — المحور الأعلى في «اكتشف» بعد نقل الأنواع إلى الفلتر
 * (طلب المالك). ليست فلتر تاريخٍ بل معنى «الأفضل»: أسبوعي = الرائج هذا
 * الأسبوع، سنوي = أعلى هذه السنة، كل الأوقات = الأعلى تاريخياً. تُعيد ضبط
 * كل الرفوف دفعةً واحدة، فيضغط الشخص «سنوي» فتتحوّل «أفضل هذا الأسبوع»
 * كلّها إلى «هذه السنة».
 */
/** نافذة صفوف «أفضل ١٠» — لكل صفٍّ نافذته (D-099، طلب أحمد): أزرار
    خفيفة في عنوان الصف بدل محور النافذة العام الذي كان في ورقة
    الفلاتر (يعدّل D-056/D-075). «كل الأوقات» القديمة يمثّلها ذيل
    Top 50 الثابت، و«شهر» جديدة = آخر ثلاثين يوماً. */
export type RailWin = "week" | "month" | "year";

/** قراءة نافذة صفٍّ من معامل رابط (wm/ws/wa) — المجهول يسقط لأسبوع */
export function parseRailWin(v: string | undefined): RailWin {
  return v === "month" || v === "year" ? v : "week";
}

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
 * بلد الإنتاج (الجنسية) — محورٌ مستقلّ (طلب أحمد 9 Aug: «أضف اختيار
 * بالجنسية»).
 *
 * كان يظهر مع العربية وحدها لأنه وُلد لتفريق السعودي عن المصري (كلاهما
 * `ar`). لكن السؤال نفسه يُطرح خارج العربية: «مسلسلات كورية» ليست كل ما
 * لغته `ko`، و«أفلام هندية» أوسع من الهندية لغةً. فصار محوراً عاماً —
 * `with_origin_country` مدعومٌ في `/discover` للجهتين.
 *
 * والقائمة بلدانُ إنتاجٍ حقيقية في TMDB: العربية أولاً (جمهور التطبيق)
 * ثم الأشهر عالمياً. خانةٌ تعود فارغةً دائماً خيارٌ كاذب.
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
  // ===== عالمياً =====
  { code: "US", ar: "أمريكا", en: "United States" },
  { code: "GB", ar: "بريطانيا", en: "United Kingdom" },
  { code: "KR", ar: "كوريا الجنوبية", en: "South Korea" },
  { code: "JP", ar: "اليابان", en: "Japan" },
  { code: "TR", ar: "تركيا", en: "Türkiye" },
  { code: "IN", ar: "الهند", en: "India" },
  { code: "FR", ar: "فرنسا", en: "France" },
  { code: "ES", ar: "إسبانيا", en: "Spain" },
  { code: "IT", ar: "إيطاليا", en: "Italy" },
  { code: "DE", ar: "ألمانيا", en: "Germany" },
  { code: "CN", ar: "الصين", en: "China" },
  { code: "MX", ar: "المكسيك", en: "Mexico" },
  { code: "BR", ar: "البرازيل", en: "Brazil" },
  { code: "CA", ar: "كندا", en: "Canada" },
  { code: "AU", ar: "أستراليا", en: "Australia" },
  { code: "SE", ar: "السويد", en: "Sweden" },
  { code: "DK", ar: "الدنمارك", en: "Denmark" },
  { code: "IR", ar: "إيران", en: "Iran" },
  { code: "TH", ar: "تايلاند", en: "Thailand" },
];

export function browseCountryName(c: BrowseCountry, locale: "ar" | "en") {
  return locale === "en" ? c.en : c.ar;
}



/**
 * الوسوم — المحور الذي يسأل «عن ماذا؟» لا «من أيّ نوع؟» (طلب أحمد ١١
 * أغسطس: «في الفلتر احتاجك تضيف ماكرو جينرز»، ثم اختار الأدقّ: «وسوم مثل
 * زومبي وسرقات»).
 *
 * **ولماذا محورٌ ثانٍ بجانب النوع الدرامي لا توسعةٌ له:** أنواع TMDB
 * الخمسة عشر تصف **الشكل** (أكشن، دراما، رعب)، والوسم يصف **الموضوع**
 * (زومبي، سرقة، سفرٌ عبر الزمن). ومن يبحث عن فيلم سرقةٍ لا يجد محوراً
 * يقوله اليوم: «جريمة» تعطيه المافيا والمخدّرات والسرقة معاً. المحوران
 * يتقاطعان ولا يتبادلان.
 *
 * **والمخزون هنا كلماتٌ إنجليزية لا معرّفاتٌ رقمية** — وهذا مقصود.
 * معرّفات كلمات TMDB المفتاحية لا تُنشر في وثيقةٍ ولا تُشتقّ، فكتابتُها
 * بالتخمين تعني رقماً خاطئاً يعيد صفّاً فارغاً **بصمت**. الكلمة تُحلّ إلى
 * معرّفها عند الطلب عبر `/search/keyword` (`keywordId` في `tmdb.ts`)،
 * والنتيجة مخبّأةٌ ساعةً كسائر نداءات TMDB — فالثمن نداءٌ واحد في الساعة،
 * والمقابل أن الوسم **يصحّح نفسه** يوم يغيّر TMDB فهرسه.
 */
export interface BrowseTag {
  slug: string;
  ar: string;
  en: string;
  /** استعلام `/search/keyword` — إنجليزيٌّ لأن كلمات TMDB إنجليزية */
  q: string;
}

/** الترتيب بالطلب المتوقَّع لا بالأبجدية — أوّلُ خمسةٍ يغطّون أكثر ما يُسأل */
export const BROWSE_TAGS: BrowseTag[] = [
  { slug: "zombie", ar: "زومبي", en: "Zombie", q: "zombie" },
  { slug: "heist", ar: "سرقات", en: "Heist", q: "heist" },
  { slug: "superhero", ar: "أبطال خارقون", en: "Superhero", q: "superhero" },
  { slug: "time-travel", ar: "سفر عبر الزمن", en: "Time travel", q: "time travel" },
  { slug: "true-story", ar: "قصة حقيقية", en: "Based on a true story", q: "based on true story" },
  { slug: "serial-killer", ar: "قاتل متسلسل", en: "Serial killer", q: "serial killer" },
  { slug: "post-apocalyptic", ar: "ما بعد النهاية", en: "Post-apocalyptic", q: "post-apocalyptic" },
  { slug: "dystopia", ar: "عالمٌ بائس", en: "Dystopia", q: "dystopia" },
  { slug: "space", ar: "فضاء", en: "Space", q: "space" },
  { slug: "spy", ar: "جواسيس", en: "Spy", q: "spy" },
  { slug: "survival", ar: "نجاة", en: "Survival", q: "survival" },
  { slug: "revenge", ar: "انتقام", en: "Revenge", q: "revenge" },
  { slug: "vampire", ar: "مصّاصو دماء", en: "Vampire", q: "vampire" },
  { slug: "martial-arts", ar: "فنون قتالية", en: "Martial arts", q: "martial arts" },
  { slug: "coming-of-age", ar: "بلوغ", en: "Coming of age", q: "coming of age" },
  { slug: "courtroom", ar: "محاكم", en: "Courtroom", q: "courtroom" },
  { slug: "sports", ar: "رياضة", en: "Sports", q: "sports" },
  { slug: "musical", ar: "استعراضي", en: "Musical", q: "musical" },
  { slug: "supernatural", ar: "خوارق", en: "Supernatural", q: "supernatural" },
  { slug: "isekai", ar: "عالمٌ آخر (إيسيكاي)", en: "Isekai", q: "isekai" },
  { slug: "mecha", ar: "روبوتات (ميكا)", en: "Mecha", q: "mecha" },
];

export function browseTagName(x: BrowseTag, locale: "ar" | "en") {
  return locale === "en" ? x.en : x.ar;
}

/** حقبة الإصدار — مدىً لا سنةً مفردة: السنة الواحدة تُفرغ الصفّ */
export interface BrowseEra {
  slug: string;
  ar: string;
  en: string;
  /** أوّل تاريخٍ مقبول (شامل) — «القادم» يتركه فارغاً ويُحسب في `eraRange` */
  from: string | null;
  /** آخر تاريخٍ مقبول (شامل) */
  to: string | null;
  /** حقبة المستقبل: مداها يتحرّك مع اليوم فيُحسب عند الطلب لا يُكتب هنا */
  upcoming?: boolean;
}

/**
 * الترتيب زمنيٌّ تنازلي: القادم (المستقبل) أوّلاً ثم العقود من الأحدث.
 * التسعينات والسبعينات عقدان مطلوبان بالاسم (طلب المالك) لا سلسلة عقودٍ
 * كاملة — و«أقدم» يبقى سلّة ما قبل ٢٠٠٠ كلّها كي لا يضيع عقدٌ بلا رقاقة
 * (الثمانينات مثلاً)؛ تداخُله مع العقدين لا يضرّ لأن الاختيار واحدٌ دائماً.
 */
export const BROWSE_ERAS: BrowseEra[] = [
  { slug: "upcoming", ar: "القادم", en: "Upcoming", from: null, to: null, upcoming: true },
  { slug: "2020s", ar: "٢٠٢٠ فما بعد", en: "2020s", from: "2020-01-01", to: null },
  { slug: "2010s", ar: "٢٠١٠–٢٠١٩", en: "2010s", from: "2010-01-01", to: "2019-12-31" },
  { slug: "2000s", ar: "٢٠٠٠–٢٠٠٩", en: "2000s", from: "2000-01-01", to: "2009-12-31" },
  { slug: "90s", ar: "التسعينات", en: "1990s", from: "1990-01-01", to: "1999-12-31" },
  { slug: "70s", ar: "السبعينات", en: "1970s", from: "1970-01-01", to: "1979-12-31" },
  { slug: "older", ar: "أقدم", en: "Older", from: null, to: "1999-12-31" },
];

export function browseEraName(e: BrowseEra, locale: "ar" | "en") {
  return locale === "en" ? e.en : e.ar;
}

/**
 * المدى الفعليّ للحقبة.
 *
 * لماذا دالةٌ لا حقلان: «القادم» مداه اليوم حتى بعد ستة أشهر، واليوم
 * يتغيّر كل يوم — فلو كُتب في المصفوفة لتجمّد على لحظة تحميل الوحدة في
 * الخادم وصار «القادم» يعرض ما صدر أمس. الحقب الثابتة تمرّ كما هي.
 */
export function eraRange(e: BrowseEra | null): { from: string | null; to: string | null } {
  if (!e) return { from: null, to: null };
  if (!e.upcoming) return { from: e.from, to: e.to };
  const now = new Date();
  const end = new Date(now);
  end.setUTCMonth(end.getUTCMonth() + 6);
  return { from: now.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
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
  /** وسمُ الموضوع — «عن ماذا؟» بجانب «من أيّ نوع؟» */
  tag: BrowseTag | null;
  /** slug جائزة من `awards.ts` — يحوّل الصفوف إلى فائزيها (طلب أحمد) */
  award: string | null;
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
  tag?: string;
  award?: string;
}): BrowseQuery {
  const type: BrowseType =
    params.type === "movie" || params.type === "tv" ? params.type : "all";

  // `win` القديم (محور الورقة قبل D-099) يُقرأ ويُتجاهل كـ`sort` —
  // الروابط المشارَكة لا تنكسر، والنوافذ صارت لكل صفٍّ في wm/ws/wa

  const found = BROWSE_GENRES.find((g) => g.slug === params.g) ?? null;
  const genre = found && genreFitsType(found, type) ? found : null;

  const lang = BROWSE_LANGS.find((l) => l.code === params.lang) ?? null;
  // الجنسية محورٌ مستقلّ الآن — لا تتبع اللغة (طلب أحمد 9 Aug)
  const country = BROWSE_COUNTRIES.find((c) => c.code === params.co) ?? null;
  const providerNum = Number(params.p);
  const provider = Number.isInteger(providerNum) && providerNum > 0 ? providerNum : null;
  const era = BROWSE_ERAS.find((e) => e.slug === params.era) ?? null;
  const rateNum = Number(params.rate);
  const rate = (BROWSE_RATES as readonly number[]).includes(rateNum)
    ? (rateNum as BrowseRate)
    : null;
  const tag = BROWSE_TAGS.find((x) => x.slug === params.tag) ?? null;
  const award = AWARDS.some((a) => a.slug === params.award) ? params.award! : null;

  return {
    type,
    genre,
    lang,
    country,
    provider,
    era,
    rate,
    tag,
    award,
    // الجهة (type) لا تجعل التصفّح «نشطاً»: صارت تبويبَ رأسٍ (أفلام/
    // مسلسلات — طلب أحمد) لا فلتراً، وتبديلها يعيد ضبط الرفوف —
    // كالنافذة تماماً. الفلاتر الحقيقية وحدها تقلب الصفحة لوضع النتائج
    active:
      genre !== null ||
      lang !== null ||
      country !== null ||
      provider !== null ||
      era !== null ||
      rate !== null ||
      tag !== null ||
      award !== null,
  };
}

/**
 * هل يتجاوز الفلتر ما تقدر عليه قوائم TMDB الجاهزة؟
 *
 * `/trending` و`/movie/upcoming` و`/tv/on_the_air` لا تقبل لغةً ولا مدىً
 * زمنياً ولا عتبة تقييم — تقبل الجهة والنوع الدرامي فقط (والأخير بتصفيةٍ
 * عندنا). فمتى طُلب أحد الثلاثة انتقلنا إلى `/discover` الذي يقبلها كلّها،
 * وضحّينا بجودة الانتقاء التحريري مقابل أن يصل المستخدم إلى ما طلبه.
 *
 * **والوسم منها:** `with_keywords` معاملُ `/discover` وحده، ولا سبيل
 * لتصفية «الرائج» به عندنا — الرائجُ لا يحمل كلماته المفتاحية في نتيجته،
 * فتصفيتُه محلياً تعني نداءً لكل عمل.
 */
export function needsDiscover(q: BrowseQuery) {
  return (
    q.lang !== null ||
    q.country !== null ||
    q.provider !== null ||
    q.era !== null ||
    q.rate !== null ||
    q.tag !== null
  );
}

/**
 * بناء رابط «اكتشف» من فلترٍ — القيم الافتراضية تُحذف فيبقى نظيفاً.
 *
 * **وهذه الدالةُ صارت البانيَ الوحيد (D-174):** كان رأس اكتشف يبني الرابط
 * بيده في موضعين (`go` و`goTab`) بنفس السطور السبعة، وهذه الدالة ثالثةً —
 * **ثلاثُ نسخٍ من قاعدةٍ واحدة**، ويوم يُضاف محورُ فلترٍ رابع يُنسى أحدُها.
 * وD-145 تقول: منطقٌ منسوخٌ في ملفّين عيب. فنُودي من الجميع.
 *
 * **و`tab` يسبق `type`:** التبويب هو الشكل الحاليّ (`?tab=shows`)، و`type`
 * شكلٌ قديم يهديه `parseDiscoverTab` إلى تبويبه — فيبقى مقبولاً للروابط
 * المحفوظة، ولا يُكتب من جديد.
 */
export function browseHref(q: {
  /** التبويب المقصود — الشكل الحاليّ، ويسبق `type` */
  tab?: DiscoverTab;
  type?: BrowseType;
  g?: string | null;
  lang?: string | null;
  co?: string | null;
  p?: number | null;
  era?: string | null;
  rate?: number | null;
  tag?: string | null;
  award?: string | null;
}) {
  const p = new URLSearchParams();
  if (q.tab) {
        /* **كلُّ تبويبٍ يكتب اسمه الآن — ولا تبويبَ «افتراضيّ» في الرابط.**
               كان «الأفلام» يُحذف فيبقى `/news` عارياً، وذاك صحيحٌ يوم كان
                      الافتراضُ ثابتاً في الشيفرة. **وقد صار الافتراض يخصّ صاحبه**
                             (D-179 + عكسُ الترتيب بطلب أحمد) — فالرابط الأعزل معناه «افتح على
                                    تبويبي الأوّل». ولو بقي يعني «الأفلام» أيضاً لتناقض المعنيان:
                                           لمسةُ «أفلام» تكتب `/news`، وصاحبُ ترتيبٍ يبدأ بالمسلسلات يهبط
                                                  عليها. **ورابطٌ يعني شيئين ليس رابطاً.** */
    p.set("tab", q.tab);
  } else if (q.type && q.type !== "all") p.set("type", q.type);
  if (q.g) p.set("g", q.g);
  if (q.lang) p.set("lang", q.lang);
  if (q.co) p.set("co", q.co);
  if (q.p) p.set("p", String(q.p));
  if (q.era) p.set("era", q.era);
  if (q.rate) p.set("rate", String(q.rate));
  if (q.tag) p.set("tag", q.tag);
  if (q.award) p.set("award", q.award);
  const qs = p.toString();
  return qs ? `/news?${qs}` : "/news";
}

/** مفتاحٌ يتغيّر بتغيّر الفلتر — يُستخدم لإعادة تركيب النتائج وهياكلها */
export function browseKey(q: BrowseQuery, page = 1) {
  return [
    q.type,
    q.genre?.slug ?? "all",
    q.lang?.code ?? "any",
    q.country?.code ?? "any",
    q.provider ?? "any",
    q.era?.slug ?? "any",
    q.rate ?? "any",
    q.tag?.slug ?? "any",
    q.award ?? "any",
    page,
  ].join(":");
}
