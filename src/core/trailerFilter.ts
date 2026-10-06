import { BROWSE_GENRES, BROWSE_LANGS, type BrowseGenre } from "./browse.ts";
import type { TrailerTab } from "./trailerTabs.ts";

/**
 * 🆕 **فلترُ صفحة الترايلرات — مفرداتُه وقاعدتُه** (D-1311، طلبُ أحمد: «على نفس خط تريلر فور يو اقصى
 * اليمين بضيف زر فلتر»).
 *
 * 🔑 **ثلاثةُ محاور لا رابع**: النوع · الإصدار · اللغة. **وجهةُ المحتوى (فيلم · مسلسل · أنمي) ليست
 * محوراً هنا** — التبويباتُ تقولها، ومحورٌ يكرّر ما يقوله شريطٌ فوقه يُخرج إجابتين لسؤالٍ واحد.
 *
 * ⚠️ **والمفرداتُ مفرداتُ «اكتشف» بأعيانها** (`BROWSE_GENRES` · `BROWSE_LANGS`) لا قائمةٌ ثانية:
 * «أكشن ومغامرة» هنا هي هي هناك، وقائمتان تفترقان عند أوّل إضافة (D-145).
 *
 * ⚠️ **والبيتُ هنا لا في `trailerTabs.ts`**: ذاك لا يستورد شيئاً عمداً، وهذا يحتاج `browse.ts`.
 * وكلاهما بلا خادم، فيقرؤه الطرفان: الصفحةُ تبني العلفَ به والورقةُ ترسم رقائقَها منه.
 */
export type TrailerRelease = "all" | "soon" | "out";

export const TRAILER_RELEASES: TrailerRelease[] = ["all", "soon", "out"];

export interface TrailerFilter {
  /** مفاهيمُ النوع (`slug`) — تُجمع بـ«أو» */
  genres: string[];
  release: TrailerRelease;
  /** لغاتُ العمل الأصليّة (ISO 639-1) — تُجمع بـ«أو» */
  langs: string[];
}

/** ما يحمله الرابطُ — **والغائبُ لا يُكتب**: رابطٌ بلا فلترٍ هو رابطُ الصفحة كما كان */
export interface TrailerFilterParams {
  g?: string;
  rel?: string;
  lang?: string;
}

export const EMPTY_TRAILER_FILTER: TrailerFilter = { genres: [], release: "all", langs: [] };

function listOf(raw: string | null | undefined, allowed: readonly string[]): string[] {
  if (!raw) return [];
  const asked = new Set(raw.split(","));
  /* **بترتيب السجلّ لا بترتيب الرابط**: `drama,crime` و`crime,drama` فلترٌ واحد، ومفتاحان له علفان */
  return allowed.filter((x) => asked.has(x));
}

/** **ولا يُصدَّق ما يصل**: مجهولٌ يسقط، ولا يُفرغ الصفحةَ نوعٌ لا وجودَ له */
export function parseTrailerFilter(p: {
  g?: string | null;
  rel?: string | null;
  lang?: string | null;
}): TrailerFilter {
  return {
    genres: listOf(p.g, BROWSE_GENRES.map((g) => g.slug)),
    release: p.rel === "soon" || p.rel === "out" ? p.rel : "all",
    langs: listOf(p.lang, BROWSE_LANGS.map((l) => l.code)),
  };
}

export function trailerFilterParams(f: TrailerFilter): TrailerFilterParams {
  const out: TrailerFilterParams = {};
  if (f.genres.length) out.g = f.genres.join(",");
  if (f.release !== "all") out.rel = f.release;
  if (f.langs.length) out.lang = f.langs.join(",");
  return out;
}

export function trailerFilterActive(f: TrailerFilter): boolean {
  return f.genres.length > 0 || f.release !== "all" || f.langs.length > 0;
}

/** هويّةُ الفلتر — مفتاحُ `Suspense`: علفٌ بفلترٍ جديدٍ مكوّنٌ جديد (العلفُ مثبَّتٌ على حمولته، D-1296) */
export function trailerFilterKey(f: TrailerFilter): string {
  return `${f.genres.join(",")}|${f.release}|${f.langs.join(",")}`;
}

/**
 * **الأنواعُ التي تُعرض رقائقَ في تبويبٍ بعينه.**
 * ⚠️ **الرعبُ والإثارةُ والرومانسيّة بلا مقابلٍ للمسلسلات عند TMDB** (`tv: []`) — فتغيب في «مسلسلات»
 * بدل أن تُعرض وتُفرغ الصفحة. و«لك» و«رائج» يخلطان الجهتين فيعرضان الكلّ.
 */
export function trailerGenresFor(tab: TrailerTab): BrowseGenre[] {
  if (tab === "movies") return BROWSE_GENRES.filter((g) => g.movie.length > 0);
  if (tab === "shows") return BROWSE_GENRES.filter((g) => g.tv.length > 0);
  return BROWSE_GENRES;
}

/** أرقامُ TMDB لمفاهيمَ مختارة في جهةٍ واحدة — فارغةٌ تعني: لا مقابلَ لها في هذه الجهة */
export function trailerGenreIds(slugs: readonly string[], side: "movie" | "tv"): number[] {
  const ids = new Set<number>();
  for (const g of BROWSE_GENRES) {
    if (slugs.includes(g.slug)) for (const id of g[side]) ids.add(id);
  }
  return [...ids];
}

/**
 * **هل يطابق صفُّ TMDB الفلتر؟** — القاعدةُ الواحدةُ لكلِّ مصدرٍ يُصفّى بعد سحبه («لك» · «رائج»)،
 * وحارسٌ ثانٍ على ما يُصفّى عند المصدر.
 *
 * ⚠️ **والنوعُ يُقرأ بجهة الصفّ**: «أكشن» فيلماً ٢٨ ومسلسلاً ١٠٧٥٩ — ورقمٌ يُقارن بلا جهته يُخطئ.
 * ⚠️ **وصفٌّ بلا تاريخٍ يُعدّ «قريباً»**: ما لم يُعلن موعدُه لم يصدر.
 */
export function matchesTrailerFilter(
  row: {
    genre_ids?: number[];
    original_language?: string;
    release_date?: string;
    first_air_date?: string;
  },
  f: TrailerFilter,
  side: "movie" | "tv",
  today: string,
): boolean {
  if (f.genres.length) {
    const wanted = trailerGenreIds(f.genres, side);
    if (!row.genre_ids?.some((id) => wanted.includes(id))) return false;
  }
  if (f.langs.length && !f.langs.includes(row.original_language ?? "")) return false;
  if (f.release !== "all") {
    const date = (side === "movie" ? row.release_date : row.first_air_date) || row.release_date || row.first_air_date || "";
    const out = date !== "" && date <= today;
    if (f.release === "out" ? !out : out) return false;
  }
  return true;
}
