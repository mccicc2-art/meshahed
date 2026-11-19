/**
 * ====== مفاتيحُ القائمة الذكيّة — الطرفُ الذي يقرؤه العميل (D-823) ======
 *
 * 🔑 **و`smartLists.ts` مُعلَّمٌ `server-only`** — **لأنّه ينادي TMDB** —
 * **ومكوّنُ العميل يحتاج سطراً واحداً منه: خريطةَ التبويب إلى الجهة.**
 * **فالسطرُ يسكن هنا وحدَه، وذاك يستورده** — **ولا نسختان تفترقان**
 * (D-145/D-376).
 */

/**
 * **تبويبُ «اكتشف» إلى قيمة `type` في الشرط** — **نفسُ سطر `‎/news`
 * بحرفه**: `movies → movie` · `shows → tv` · **`anime → all`**
 * (تبويبُ الأنمي يحمل صفَّي أفلامٍ وصفَّي مسلسلاتٍ معاً).
 * **و`null` لِما لا جهةَ له** — تبويبُ «القوائم» — **فلا يُصنع منه
 * شرطٌ أصلاً** (D-217: لا بابَ لِما لا يُفتح).
 */
export function sectionToRuleType(section: string): "movie" | "tv" | "all" | null {
  return section === "movies"
    ? "movie"
    : section === "shows"
      ? "tv"
      : section === "anime"
        ? "all"
        : null;
}

/**
 * ====== مفرداتُ شرط المكتبة (D-876) — **عميلٌ وخادمٌ يقرآن الملفَّ نفسَه** ======
 *
 * **حكمُ أحمد**: «مفردات المكتبة وحدها» — **ما تجيب عنه جداولُها بلا
 * نداء TMDB ولا تقييمٍ خارجيّ.** **والمفاتيحُ المشتركةُ مع الكتالوج تحمل
 * أسماءَها هناك بحروفها** (`type` · `g` · `era` · `lang` · `co`) —
 * **واسمان لمحورٍ واحدٍ يفترقان** (D-816/D-818).
 *
 * 🆕 **ومفتاحان للمكتبة وحدَها**: `wst` حالةُ المشاهدة · `my` تقييمي.
 */
export const LIBRARY_RULE_KEYS = ["type", "g", "era", "lang", "co", "wst", "my", "sort"] as const;
export type LibraryRuleKey = (typeof LIBRARY_RULE_KEYS)[number];

/** عتباتُ «تقييمي» — **ثلاثٌ كعتبات اكتشف** (`BROWSE_RATES`)، ولا عشرُ خانات */
export const MY_RATING_MIN = ["7", "8", "9"] as const;

/** تبويبُ المكتبة إلى نوعِ الشرط — **نظيرُ `sectionToRuleType` لأقسام اكتشف** */
export function libraryTabToRuleType(tab: string): "movie" | "tv" | "all" | null {
  return tab === "movies" ? "movie" : tab === "shows" ? "tv" : tab === "anime" ? "all" : null;
}

/**
 * ====== 🆕 T450 — مفتاحا صفحة «قائمة جديدة» (أحمد ١٩ نوفمبر: «موجوده ف تراكت») ======
 *
 * **قيمٌ مغلقةٌ لا نصٌّ حرّ** — المطهِّرُ يرفض ما سواها كما يرفض `wst`/`my` (D-475):
 *  · `hide` (الكتالوج وحدَه): `watched` يُسقط ما شاهدتَه (فيلمٌ مشاهَد · مسلسلٌ بدأتَه)، و`library` يُسقط كلَّ ما في مكتبتك.
 *  · `sort` (الكتالوج): `pop` الأشهر (الافتراضيّ — ترتيبُ «اكتشف» نفسُه) · `rate` الأعلى تقييماً · `new` الأحدث.
 *  · `sort` (المكتبة): `added` الأحدث إضافةً (الافتراضيّ — ترتيبُها قبل اليوم) · `my` تقييمي · `title` الاسم.
 * **والغائبُ هو الافتراضيُّ بحرفه** — فكلُّ شرطٍ حُفظ قبل اليوم يُقرأ كما كان (D-028).
 */
export const SMART_HIDE = ["watched", "library"] as const;
export type SmartHide = (typeof SMART_HIDE)[number];
export const SMART_SORT = ["pop", "rate", "new"] as const;
export type SmartSort = (typeof SMART_SORT)[number];
export const LIBRARY_SORT = ["added", "my", "title"] as const;
export type LibrarySort = (typeof LIBRARY_SORT)[number];
/** مفتاحا الكتالوج الزائدان على مفاتيح الفلاتر (`FILTER_KEYS`) */
export const SMART_CATALOG_EXTRA = ["hide", "sort"] as const;

/**
 * 🆕 T454 — **أنواعُ القائمة الذكيّة تُجمع** (أحمد ١٩ نوفمبر: «تحدد فقط افلام او انمي او مسلسلات ما تقدر تخلط»):
 * `type` يحمل نوعاً أو أكثر مفصولةً بفاصلة (`movie,tv`) — **والقيمةُ المفردةُ القديمة تُقرأ كما هي** فلا يتغيّر شرطٌ مخزَّن.
 * `all` = الأنمي (خريطةُ `/news` — `ruleMedia`). الترتيبُ ثابتٌ (أفلام ← مسلسلات ← أنمي) فالشرطُ نفسُه نصٌّ واحد.
 */
export const SMART_TYPES = ["movie", "tv", "all"] as const;
export type SmartType = (typeof SMART_TYPES)[number];

export function ruleTypes(value: string | null | undefined): SmartType[] {
  const parts = new Set(String(value ?? "").split(","));
  return SMART_TYPES.filter((t) => parts.has(t));
}

/** تبديلُ نوعٍ في القائمة — **ولا يُفرَّغ**: آخرُ نوعٍ مختارٍ لا يُطفأ (الشرطُ يحمل نوعاً دائماً) */
export function toggleRuleType(value: string | null | undefined, t: SmartType): string {
  const cur = ruleTypes(value);
  const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
  return (next.length ? SMART_TYPES.filter((x) => next.includes(x)) : cur).join(",");
}
