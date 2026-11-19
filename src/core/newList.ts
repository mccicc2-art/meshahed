import type { Dict } from "./i18n";
import { BROWSE_COUNTRIES, BROWSE_COUNTRY_TOP, BROWSE_ERAS, BROWSE_GENRES, BROWSE_LANGS, BROWSE_RATES, genreFitsType } from "./browse";
import { MY_RATING_MIN } from "./smartListKeys";
import type { PickerItem } from "./contracts/library";

/**
 * ====== 🆕 T450 — مفرداتُ صفحة «قائمة جديدة» — للويب والتطبيق معاً ======
 *
 * الرقائقُ وخياراتُها وتصفيةُ الاختيار المحلّيّة **في النواة مرّةً** (D-145): صفحةُ الويب (`NewListFlow`) وشاشةُ التطبيق
 * (`NewListScreen`) ترسمان القائمةَ نفسَها بالترتيب نفسِه، فخيارٌ يُضاف هنا يظهر في الاثنين في الدفعة نفسِها.
 */

export type NewListTab = "list" | "smart";
/** المكتبةُ: `recent · watched · watching` — و«اكتشف» (🆕 T454): الكتالوجُ `pop · rate · new` ومكتبتُك `mine` */
export type NewListSource = "recent" | "watched" | "watching" | "watchlist" | "pop" | "rate" | "new" | "mine";
export type NewListAxis = "type" | "g" | "era" | "my" | "rate" | "lang" | "co" | "wst" | "hide" | "sort";
export type NewListOpt = { value: string; label: string };

/** محاورُ كلِّ وضع — الترتيبُ ترتيبُ الرقائق على الشاشة. الكتالوجُ بالتقييم العامّ (أغلبُه لم تقيّمه)، ومكتبتُك بتقييمك */
export const PICK_AXES: NewListAxis[] = ["type", "g", "era", "my"];
export const PICK_AXES_CATALOG: NewListAxis[] = ["type", "g", "era", "rate"];

/** هل المصدرُ من الكتالوج (نداءُ الخادم) لا من مكتبتك (تصفيةٌ في الجهاز)؟ */
export function isCatalogSource(s: NewListSource): boolean {
  return s === "pop" || s === "rate" || s === "new";
}
export const SMART_AXES_CATALOG: NewListAxis[] = ["g", "era", "rate", "lang", "co", "hide", "sort"];
/** ذكيّةُ المكتبة: الحالةُ «شاهدتُ/أشاهد» وحدَهما — «للمشاهدة» ليست ممّا شاهدتَه (أحمد: «واتش ليست لا لانه ما شافها») */
export const SMART_AXES_LIBRARY: NewListAxis[] = ["wst", "my", "g", "era", "sort"];

/** 🆕 T454 — «اكتشف» يعرض الكتالوجَ كلَّه أوّلاً ومكتبتُك رقاقةٌ بينها (أحمد «١ أ»)، والمكتبةُ أعمالُك وحدَها */
export function newListSources(library: boolean): NewListSource[] {
  return library ? ["recent", "watched", "watching"] : ["pop", "rate", "new", "mine"];
}

export function sourceLabel(t: Dict, s: NewListSource): string {
  switch (s) {
    case "recent":
      return t.nlSrcRecent;
    case "watched":
      return t.nlSrcWatched;
    case "watching":
      return t.nlSrcWatching;
    case "watchlist":
      return t.nlSrcWatchlist;
    case "pop":
      return t.nlSortPop;
    case "rate":
      return t.nlSortRate;
    case "new":
      return t.nlSortNew;
    case "mine":
      return t.nlSrcMine;
  }
}

/** نصُّ رقاقة «إخفاء» بقيمتها: «إخفاء: ما شاهدته» — القيمةُ وحدَها كانت تُقرأ «ما شاهدته فقط» وهي عكسُها */
export function hideChipText(t: Dict, value: string | undefined): string {
  return value === "watched" ? t.nlHideChip(t.nlHideWatched) : value === "library" ? t.nlHideChip(t.nlHideLibrary) : t.nlHide;
}

export function axisLabels(t: Dict): Record<NewListAxis, string> {
  return {
    type: t.nlType,
    g: t.nlGenre,
    era: t.nlEra,
    my: t.nlMyRating,
    rate: t.nlRating,
    lang: t.nlLanguage,
    co: t.nlCountry,
    wst: t.nlStatus,
    hide: t.nlHide,
    sort: t.nlSort,
  };
}

/**
 * خياراتُ كلِّ محور. `curType` النوعُ المختار (يحصر الأنواعَ الفنّيّة — `genreFitsType`، صفُّ «اكتشف» حرفاً).
 * ⚠️ **الأنمي `all` في الشرط** (خريطةُ `/news` — `ruleMedia` و`librarySmart`) **و`anime` في فلتر الاختيار المحلّيّ**.
 */
export function axisOptions(
  t: Dict,
  ar: boolean,
  { tab, library, curType }: { tab: NewListTab; library: boolean; curType?: string },
): Record<NewListAxis, NewListOpt[]> {
  const any = { value: "", label: t.nlAny };
  const fitsAny = (g: (typeof BROWSE_GENRES)[number]) => genreFitsTypes(g, curType);
  return {
    /* الشرطُ يحمل نوعاً دائماً (القائمتان الذكيّتان كلتاهما — محرّراهما القائمان يجمّدان النوعَ ويشترطانه)؛ «أيّ» للاختيار وحدَه */
    type: [
      ...(tab === "smart" ? [] : [any]),
      { value: "movie", label: t.shortMovies },
      { value: "tv", label: t.shortShows },
      { value: tab === "smart" ? "all" : "anime", label: t.discoverTabAnime },
    ],
    g: [any, ...BROWSE_GENRES.filter(fitsAny).map((g) => ({ value: g.slug, label: ar ? g.ar : g.en }))],
    era: [any, ...BROWSE_ERAS.filter((e) => !e.upcoming || (tab === "smart" && !library)).map((e) => ({ value: e.slug, label: ar ? e.ar : e.en }))],
    my: [any, ...MY_RATING_MIN.map((n) => ({ value: n, label: `${n}+` }))],
    rate: [any, ...BROWSE_RATES.map((n) => ({ value: String(n), label: `${n}+` }))],
    lang: [any, ...BROWSE_LANGS.map((l) => ({ value: l.code, label: ar ? l.ar : l.en }))],
    co: [
      any,
      ...BROWSE_COUNTRY_TOP.flatMap((code) => {
        const c = BROWSE_COUNTRIES.find((x) => x.code === code);
        return c ? [{ value: c.code, label: ar ? c.ar : c.en }] : [];
      }),
    ],
    wst: [any, { value: "completed", label: t.nlSrcWatched }, { value: "watching", label: t.nlSrcWatching }],
    hide: [
      { value: "", label: t.nlHideNone },
      { value: "watched", label: t.nlHideWatched },
      { value: "library", label: t.nlHideLibrary },
    ],
    sort: library
      ? [
          { value: "", label: t.nlSortAdded },
          { value: "my", label: t.nlSortMy },
          { value: "title", label: t.nlSortTitle },
        ]
      : [
          { value: "", label: t.nlSortPop },
          { value: "rate", label: t.nlSortRate },
          { value: "new", label: t.nlSortNew },
        ],
  };
}

/** نصُّ الرقاقة: اسمُ المحور فارغاً، وقيمتُه حين تُختار */
export function chipText(opts: NewListOpt[], label: string, value: string | undefined): string {
  return value ? (opts.find((o) => o.value === value)?.label ?? label) : label;
}

/** قيمةُ محورٍ في شرطٍ أو فلتر — الفارغُ يُحذف لا يُخزَّن (`""` = «أيّ») */
export function withAxis<T extends Partial<Record<string, string>>>(cur: T, axis: string, value: string): T {
  const next = { ...cur } as Record<string, string | undefined>;
  if (value) next[axis] = value;
  else delete next[axis];
  return next as T;
}

/**
 * هل في الشرط ما يحدّه؟ **النوعُ والترتيبُ والإخفاءُ وحدَها ليست شرطاً** (D-636: «كلُّ أفلامي» ليست ذكيّةً، هي تبويبُ
 * الأفلام) — وكان محرّرا الشرط القديمان يشترطان نوعاً ومفتاحاً بعده؛ والتعديلُ اليومَ في الصفحة نفسِها (T454)
 * فالشرطُ واحدٌ للإنشاء والتحديث.
 */
export function ruleHasLimit(rule: Record<string, string>): boolean {
  return !!rule.type && Object.keys(rule).some((k) => k !== "type" && k !== "sort" && k !== "hide");
}

/**
 * يناسب النوعُ الفنّيُّ نوعاً واحداً على الأقلّ من المختار (`movie` · `tv` · `anime`/`all`، أو قائمةٌ مجموعة `movie,tv`)
 * — `genreFitsType` لكلٍّ منها. والغائبُ = كلُّ الأنواع.
 */
export function genreFitsTypes(g: (typeof BROWSE_GENRES)[number], type: string | undefined): boolean {
  const parts = (type ?? "").split(",").filter(Boolean);
  if (!parts.length) return genreFitsType(g, "all");
  return parts.some((p) => genreFitsType(g, p === "movie" ? "movie" : p === "tv" ? "tv" : "all"));
}

/** تبديلُ النوع يُسقط النوعَ الفنّيَّ الذي لا يناسبه — لا رقاقةَ مضاءةً باسمٍ عامّ لشرطٍ لا يُرى */
export function withType<T extends Partial<Record<string, string>>>(cur: T, value: string): T {
  const next = withAxis(cur, "type", value) as Record<string, string | undefined>;
  const g = next.g ? BROWSE_GENRES.find((x) => x.slug === next.g) : null;
  if (g && !genreFitsTypes(g, value)) delete next.g;
  return next as T;
}

/**
 * تصفيةُ الاختيار في الجهاز — مكتبتُك كلُّها وصلت في نداءٍ واحد (`/api/v1/lists/picker`)، فالرقائقُ بلا رحلة.
 * البحثُ يتجاوز رقاقةَ المصدر (من يكتب اسماً يريده أينما كان) ويُبقي الفلاتر.
 */
export function filterPicker(
  items: PickerItem[],
  { source, filters, term }: { source: NewListSource; filters: Partial<Record<NewListAxis, string>>; term: string },
): PickerItem[] {
  const g = filters.g ? BROWSE_GENRES.find((x) => x.slug === filters.g) : null;
  const era = filters.era ? BROWSE_ERAS.find((x) => x.slug === filters.era) : null;
  const yFrom = era?.from ? Number(era.from.slice(0, 4)) : null;
  const yTo = era?.to ? Number(era.to.slice(0, 4)) : null;
  const minMy = filters.my ? Number(filters.my) : null;
  const needle = term.trim().toLocaleLowerCase();
  return items.filter((x) => {
    if (needle) {
      if (!x.title.toLocaleLowerCase().includes(needle)) return false;
    } else if (source === "watched" && x.status !== "completed") return false;
    else if (source === "watching" && x.status !== "watching") return false;
    else if (source === "watchlist" && x.status !== "unstarted") return false;
    if (filters.type === "movie" && x.kind !== "movie") return false;
    if (filters.type === "tv" && (x.kind !== "tv" || x.anime)) return false;
    if (filters.type === "anime" && !x.anime) return false;
    if (g && !(x.kind === "tv" ? g.tv : g.movie).some((id) => x.genres.includes(id))) return false;
    if (era && (x.year === null || (yFrom !== null && x.year < yFrom) || (yTo !== null && x.year > yTo))) return false;
    if (minMy !== null && (x.my ?? 0) < minMy) return false;
    return true;
  });
}
