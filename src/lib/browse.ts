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
export type BrowseSort = "trending" | "top" | "new";

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

export const BROWSE_SORTS: BrowseSort[] = ["trending", "top", "new"];

export function browseGenreName(g: BrowseGenre, locale: "ar" | "en") {
  return locale === "en" ? g.en : g.ar;
}

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
  sort: BrowseSort;
  /** هل المستخدم يتصفّح فعلاً؟ لو لا، تبقى صفحة اكتشف على صفوفها المنسّقة */
  active: boolean;
}

/**
 * قراءة الفلتر من معاملات الرابط.
 *
 * كل قيمة غير معروفة تسقط إلى الافتراضي بدل أن ترفع خطأً: الرابط مدخلُ
 * مستخدمٍ يمكن أن يُكتب باليد أو يُشارك بعد تغيّر التصنيف.
 */
export function parseBrowse(params: {
  type?: string;
  g?: string;
  sort?: string;
}): BrowseQuery {
  const type: BrowseType =
    params.type === "movie" || params.type === "tv" ? params.type : "all";

  const found = BROWSE_GENRES.find((g) => g.slug === params.g) ?? null;
  const genre = found && genreFitsType(found, type) ? found : null;

  const sort: BrowseSort = BROWSE_SORTS.includes(params.sort as BrowseSort)
    ? (params.sort as BrowseSort)
    : "trending";

  return { type, genre, sort, active: type !== "all" || genre !== null };
}

/** مفتاحٌ يتغيّر بتغيّر الفلتر — يُستخدم لإعادة تركيب النتائج وهياكلها */
export function browseKey(q: BrowseQuery, page = 1) {
  return `${q.type}:${q.genre?.slug ?? "all"}:${q.sort}:${page}`;
}
