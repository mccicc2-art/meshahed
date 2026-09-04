// بحثٌ يفهم النية (طريق ١٠/١٠ — بند ٧): «افلام كوميدية 2023» في خانة
// البحث ليست عنوان عمل — هي فلترُ اكتشف مكتوبٌ كلاماً. TMDB يطابق
// العناوين وحدها فيعيد ضجيجاً، فبدل ذلك نقترح الطريق الصحيح: رقاقةٌ
// فوق النتائج تفتح اكتشف بالفلاتر مضبوطة (نفس نمط رقاقة الجنسية في
// nationality.ts — اقتراحٌ يُؤخذ أو يُتجاهل بلا ثمن).

import { BROWSE_GENRES, BROWSE_ERAS, genreFitsType, browseGenreName, browseEraName } from "./browse";

/** كلماتُ كل نوعٍ كما يكتبها الناس — لا أسماء القاموس الرسمية وحدها */
const GENRE_WORDS: [RegExp, string][] = [
  [/أكشن|اكشن|action/i, "action"],
  [/كوميد|comed/i, "comedy"],
  [/دراما|drama/i, "drama"],
  [/جريمة|جرائم|crime/i, "crime"],
  [/إثارة|اثارة|تشويق|thriller/i, "thriller"],
  [/غموض|myster/i, "mystery"],
  [/خيال علمي|فانتازيا|sci-?fi|fantasy/i, "scifi"],
  [/رعب|horror/i, "horror"],
  [/رومانس|رومنس|roman/i, "romance"],
  [/رسوم|أنيميشن|انيميشن|animat/i, "animation"],
  [/وثائقي|document/i, "documentary"],
  [/عائلي|family/i, "family"],
  [/حرب|war /i, "war"],
  [/غربي|western/i, "western"],
];

/** سنةٌ مكتوبة → حقبة القاموس التي تحتويها */
function eraOfYear(y: number): string | null {
  if (y >= 2020) return "2020s";
  if (y >= 2010) return "2010s";
  if (y >= 2000) return "2000s";
  if (y >= 1990) return "90s";
  if (y >= 1970 && y <= 1979) return "70s";
  if (y < 2000) return "older";
  return null;
}

export interface BrowseIntent {
  /** رابط اكتشف بالفلاتر مضبوطة */
  href: string;
  /** وصف ما فُهم — يُركَّب في نص الرقاقة */
  label: string;
}

/**
 * يفهم النية من نص البحث — نوعٌ درامي و/أو سنة، مع جهةٍ اختيارية.
 * يعيد null ما لم يُفهم نوعٌ أو سنة: اسم عملٍ عاديّ لا يستحق رقاقة.
 */
export function matchBrowseIntent(q: string, loc: "ar" | "en"): BrowseIntent | null {
  const s = q.trim();
  if (s.length < 3) return null;

  const wantsShows = /مسلسل|مسلسلات|أنمي|انمي|series|shows?|anime/i.test(s);
  const wantsMovies = /فيلم|أفلام|افلام|فلم|movies?|films?/i.test(s);
  const shows = wantsShows && !wantsMovies;

  let genre = GENRE_WORDS.find(([re]) => re.test(s))?.[1] ?? null;
  const g = BROWSE_GENRES.find((x) => x.slug === genre) ?? null;
  // نوعٌ لا مقابل له في الجهة المطلوبة (رعب في المسلسلات) يسقط بصمت
  if (g && !genreFitsType(g, shows ? "tv" : "movie")) genre = null;

  const yearMatch = s.match(/\b(19|20)\d{2}\b/);
  const era = yearMatch ? eraOfYear(Number(yearMatch[0])) : null;
  const e = era ? (BROWSE_ERAS.find((x) => x.slug === era) ?? null) : null;

  // بلا نوعٍ ولا سنة لا نية — والسنة وحدها بلا كلمة جهةٍ أو نوعٍ
  // غالباً جزءٌ من عنوان («2012» فيلم!) فلا رقاقة لها
  if (!genre && !e) return null;
  if (!genre && e && !wantsShows && !wantsMovies) return null;

  const p = new URLSearchParams();
  if (shows) p.set("tab", "shows");
  if (genre) p.set("g", genre);
  if (e) p.set("era", e.slug);

  const what = [
    shows ? (loc === "en" ? "shows" : "مسلسلات") : loc === "en" ? "movies" : "أفلام",
    g ? browseGenreName(g, loc) : null,
    e ? browseEraName(e, loc) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { href: `/news?${p.toString()}`, label: what };
}
