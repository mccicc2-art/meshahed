/**
 * ============ الفلاترُ المحفوظة — منطقٌ خالصٌ بلا قراءة (D-816) ============
 *
 * **حكمُ أحمد**: «نفّذ الـ٢٤» — البندان الأوّل والثاني: **حفظُ تركيبةِ
 * فلاترٍ باسم**، **وفلترٌ افتراضيٌّ لكلِّ قسم.**
 *
 * 🔑 **والفلترُ نصُّ استعلامٍ لا حالةُ عميل**: **«اكتشف» تكتب فلاترَها
 * في الرابط وتقرؤها من الخادم** (`router.replace`) — **فالمحفوظُ هو
 * الرابطُ نفسُه**، **ولا شكلَ ثانياً يُخترع لما له شكلٌ قائم** (D-145).
 * **ومن حفظ فلتراً ثمّ فُتح تبويبٌ جديدٌ يعمل الرابطُ كما هو.**
 *
 * 🔴 **والمفاتيحُ بقائمةِ سماحٍ لا بقبولٍ عامّ**: **نصُّ استعلامٍ يُحفظ
 * كما جاء يصير مخزناً لأيِّ شيء** — **ومعاملٌ غريبٌ يعود يوماً في رابطٍ
 * نبنيه نحن.** **فما ليس فلتراً يسقط صامتاً.**
 *
 * ⚖️ **وبيتُها `profiles.ui_state`** (هجرة ١٢١) — **عمودٌ بلا قيدِ شكلٍ
 * عمداً** (D-475) — **فلا هجرةَ لهذا البند، ولا ينتظر أحدٌ أحداً.**
 */

/** سقفُ ما يُحفظ — **صمّامٌ لا تصميم**: من تجاوز عشرين فلتراً لا يجدها */
export const FILTERS_CAP = 20;
/** سقفُ الاسم بالحروف — **اسمٌ لا يُقرأ في رقاقةٍ ليس اسماً** */
export const FILTER_NAME_MAX = 24;

/**
 * **مفاتيحُ الفلاتر المسموحة** — **مأخوذةٌ من `browseHref` بأعيانها**
 * (`lib/browse.ts`) لا من التخمين: **الرابطُ يكتب `g` و`co` و`st` و`se`
 * و`std` مختصرةً**، **وقائمةُ سماحٍ بأسماءٍ طويلةٍ كانت ستُسقط كلَّ
 * فلترٍ يُحفظ وتخرج قائمةً فارغةً بلا رسالة.**
 * 🔑 **والدرسُ**: **قائمةُ سماحٍ تُنسخ من مُولِّد الرابط لا تُكتب من
 * الذاكرة** — **وإلّا حرست باباً لا يمرّ منه أحد.**
 * ⚠️ **ولا `tab` فيها**: **التبويبُ هو القسمُ نفسُه** (`section`)،
 * **وحفظُه داخل الاستعلام يجعل فلترَ الأفلام يفتح المسلسلات.**
 * ⚠️ **ولا `page`**: **الصفحةُ موضعٌ لا اختيار** — **وحفظُها يعيد
 * القارئ إلى الصفحة السابعة من فلترٍ استدعاه للتوّ.**
 */
export const FILTER_KEYS = [
  "type",
  "g",
  "lang",
  "co",
  "p",
  "era",
  "rate",
  "tag",
  "award",
  "st",
  "se",
  "std",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

export interface SavedFilter {
  /** معرّفٌ نولّده — لا يُقرأ ولا يُعرض */
  id: string;
  name: string;
  /** القسمُ الذي حُفظ فيه — `movies` · `tv` · `anime` … */
  section: string;
  /** نصُّ الاستعلام المطهَّر، بلا `?` */
  q: string;
  /** **الافتراضيُّ لقسمه** — واحدٌ لكلِّ قسمٍ لا أكثر */
  def?: true;
}

const ID_RE = /^[a-z0-9]{6,24}$/;
const SECTION_RE = /^[a-z0-9-]{1,32}$/;
/** قيمةُ معاملٍ — حروفٌ وأرقامٌ وفواصلُ ونقاطٌ وشرطات، وسقفٌ يمنع الحشو */
const VALUE_RE = /^[A-Za-z0-9,._-]{1,64}$/;

/** معرّفٌ عشوائيٌّ قصير — **يُنادى في العميل، فلا `crypto` من العقدة** */
export function newFilterId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

/**
 * **نصُّ استعلامٍ إلى نصٍّ مطهَّر** — **بترتيبٍ ثابتٍ لا بترتيب وروده**:
 * 🔑 **فلتران متطابقان بترتيبين مختلفين نصّان مختلفان** — **وبلا ترتيبٍ
 * ثابتٍ يُحفظ الفلترُ نفسُه مرّتين ولا يُكتشف التكرار.**
 */
export function sanitizeQuery(raw: string | URLSearchParams): string {
  const sp = typeof raw === "string" ? new URLSearchParams(raw) : raw;
  const out = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = sp.get(k);
    if (v && VALUE_RE.test(v)) out.set(k, v);
  }
  return out.toString();
}

/** **اسمٌ يُقرأ** — فراغاتٌ مطويّةٌ وسقفٌ، والفارغُ يسقط */
export function sanitizeFilterName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, FILTER_NAME_MAX);
}

/** قيمةُ العمود (أو أيُّ مجهول) إلى شكلٍ مضمون — **والفاسدُ يسقط صامتاً** */
export function sanitizeSavedFilters(value: unknown): SavedFilter[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const defaults = new Set<string>();
  const out: SavedFilter[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as Record<string, unknown>;
    const id = typeof v.id === "string" ? v.id : "";
    const section = typeof v.section === "string" ? v.section : "";
    const name = typeof v.name === "string" ? sanitizeFilterName(v.name) : "";
    const q = typeof v.q === "string" ? sanitizeQuery(v.q) : "";
    if (!ID_RE.test(id) || !SECTION_RE.test(section) || !name || !q) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const row: SavedFilter = { id, name, section, q };
    /* ⚠️ **وافتراضيٌّ واحدٌ لكلِّ قسمٍ ولو جاء العمودُ بغيره**: **عمودٌ
       بلا قيدِ شكلٍ يُصلَح عند القراءة لا يُوثَق به** (D-475). */
    if (v.def === true && !defaults.has(section)) {
      defaults.add(section);
      row.def = true;
    }
    out.push(row);
    if (out.length >= FILTERS_CAP) break;
  }
  return out;
}

/**
 * **إضافةٌ أو استبدال** — **والتكرارُ يُقاس بالقسم والاستعلام لا بالاسم**:
 * **من حفظ الفلترَ نفسَه باسمين ملأ قائمتَه بشيءٍ واحد.**
 */
export function upsertFilter(list: SavedFilter[], next: SavedFilter): SavedFilter[] {
  const same = list.find((f) => f.section === next.section && f.q === next.q);
  const id = same ? same.id : next.id;
  const kept = list.filter((f) => f.id !== id);
  if (kept.length >= FILTERS_CAP) return list;
  /* **الافتراضيّةُ تُورَث عند الاستبدال** — إعادةُ تسميةٍ لا تُسقط حكماً */
  const def = same?.def ?? next.def;
  return [...kept, { ...next, id, ...(def ? { def: true as const } : {}) }];
}

export function removeFilter(list: SavedFilter[], id: string): SavedFilter[] {
  return list.filter((f) => f.id !== id);
}

/** **تعيينُ الافتراضيّ** — **ويسقط عن غيره في قسمه** (واحدٌ لا أكثر) */
export function setDefaultFilter(list: SavedFilter[], id: string, on: boolean): SavedFilter[] {
  const target = list.find((f) => f.id === id);
  if (!target) return list;
  return list.map((f) => {
    if (f.section !== target.section) return f;
    const isIt = f.id === id;
    const { def: _drop, ...rest } = f;
    void _drop;
    return isIt && on ? { ...rest, def: true as const } : rest;
  });
}

export function defaultFor(list: SavedFilter[], section: string): SavedFilter | null {
  return list.find((f) => f.section === section && f.def) ?? null;
}

export function filtersOf(list: SavedFilter[], section: string): SavedFilter[] {
  return list.filter((f) => f.section === section);
}
