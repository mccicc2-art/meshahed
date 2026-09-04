/**
 * ====== قوالبُ التخصيص المحفوظة — منطقٌ خالصٌ بلا قراءة (D-822) ======
 *
 * **حكمُ أحمد**: «نفّذ الـ٢٤» — **البندُ السادس: حفظُ عدّة قوالبِ تخصيص.**
 * **اليومَ يكتب `HomeCustomize` و`ProfileCustomize` قالباً واحداً** يُدهَس
 * عند كلِّ حفظ — **ومن جرّب شكلاً ثانياً فقد الأوّلَ ولا طريقَ للعودة.**
 *
 * ⚖️ **وبيتُها `profiles.ui_state`** (هجرة ١٢١) — **عمودٌ بلا قيدِ شكلٍ
 * عمداً** (D-475) — **فلا هجرةَ لهذا البند**، ولا ينتظر أحدٌ تشغيلَ شيء.
 * **وهي حالةُ صاحبِها وحدَه** فلا يضرّها أنّ الزائرَ لا يقرأ `ui_state`
 * — **بخلاف لونِ القائمة الذي يراه كلُّ فاتح** (ولذلك يسكن صفَّها).
 *
 * 🔑 **وقالبٌ لسطحه لا لكليهما**: **شاشتان منفصلتان في التطبيق**
 * (الرئيسيةُ والملفّ)، **وقالبٌ يحمل السطحين معاً يغيّر للمستخدم شاشةً
 * لم يفتحها** — **وهو بعينه ما تمنعه D-644** (طلبُ بابٍ ليس إذناً
 * بإعادة ترتيب الغرفة).
 *
 * 🔑 **واللقطةُ تُطهَّر عند التطبيق لا عند القراءة**: **`sanitizeHomePrefs`
 * و`sanitizeProfilePrefs` هما المرجعُ الوحيدُ لشكل كلِّ سطح** (D-145)،
 * **واستيرادُهما هنا يجعل ملفَّ التخزين يعرف كلَّ سطحٍ يُخزَّن فيه.**
 * ⚠️ **وفائدةٌ ثانيةٌ تُقال**: **قالبٌ حُفظ قبل حقلٍ أُضيف اليوم يُشفى
 * عند تطبيقه** بمطهِّر اليوم — **ولا يبقى ناقصاً إلى الأبد.**
 */

/** سقفُ القوالب **لكلِّ سطح** — **صمّامٌ لا تصميم** */
export const TEMPLATES_CAP = 5;
/** سقفُ الاسم — **اسمٌ لا يُقرأ في رقاقةٍ ليس اسماً** (نظيرُ D-816) */
export const TEMPLATE_NAME_MAX = 24;
/**
 * سقفُ حجم اللقطة بالحروف. **`ui_state` عمودٌ بلا قيدٍ، وصفٌّ ينتفخ
 * يُقرأ في كلِّ صفحة** — **والقالبُ اليومَ دون الأربعمئة حرف.**
 */
const SNAPSHOT_MAX = 2000;

export const TEMPLATE_SURFACES = ["home", "profile"] as const;
export type TemplateSurface = (typeof TEMPLATE_SURFACES)[number];

export interface PrefTemplate {
  /** معرّفٌ نولّده — لا يُقرأ ولا يُعرض */
  id: string;
  name: string;
  /** السطحُ الذي حُفظ منه */
  s: TemplateSurface;
  /** **لقطةُ التفضيلات كما كانت** — تُطهَّر بمطهِّر سطحها عند التطبيق */
  p: Record<string, unknown>;
}

const ID_RE = /^[a-z0-9]{6,24}$/;

/** معرّفٌ عشوائيٌّ قصير — **يُنادى في العميل، فلا `crypto` من العقدة** */
export function newTemplateId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

/** **اسمٌ يُقرأ** — فراغاتٌ مطويّةٌ وسقفٌ، والفارغُ يسقط */
export function sanitizeTemplateName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, TEMPLATE_NAME_MAX);
}

/** قيمةُ العمود (أو أيُّ مجهول) إلى شكلٍ مضمون — **والفاسدُ يسقط صامتاً** */
export function sanitizePrefTemplates(value: unknown): PrefTemplate[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  /* **والسقفُ لكلِّ سطحٍ على حدة** — **وسقفٌ مشتركٌ يجعل خمسةَ قوالبِ
     رئيسيّةٍ تمنع قالبَ ملفٍّ واحداً**، وهو حدٌّ لم يُعلَن للمستخدم. */
  const perSurface = new Map<TemplateSurface, number>();
  const out: PrefTemplate[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as Record<string, unknown>;
    const id = typeof v.id === "string" ? v.id : "";
    const name = typeof v.name === "string" ? sanitizeTemplateName(v.name) : "";
    const s = v.s as TemplateSurface;
    if (!ID_RE.test(id) || !name || !TEMPLATE_SURFACES.includes(s)) continue;
    if (seen.has(id)) continue;
    /* **ولقطةٌ ليست كائناً ليست لقطة** — ومصفوفةٌ كائنٌ في JS فتُستثنى */
    if (!v.p || typeof v.p !== "object" || Array.isArray(v.p)) continue;
    const p = v.p as Record<string, unknown>;
    if (JSON.stringify(p).length > SNAPSHOT_MAX) continue;
    const n = perSurface.get(s) ?? 0;
    if (n >= TEMPLATES_CAP) continue;
    perSurface.set(s, n + 1);
    seen.add(id);
    out.push({ id, name, s, p });
  }
  return out;
}

/**
 * **إضافةٌ أو إعادةُ تسمية** — **والتكرارُ يُقاس بالاسم داخل السطح**،
 * 🔑 **بخلاف الفلاتر التي تُقاس بمحتواها** (D-816): **فلتران متطابقان
 * شيءٌ واحدٌ بلا شكّ**، **أمّا قالبان بترتيبٍ متطابقٍ فقد يكونان
 * محطّتين مقصودتين** («قبل السفر» و«بعده») — **ودمجُهما يمحو نيّة.**
 */
export function upsertTemplate(list: PrefTemplate[], next: PrefTemplate): PrefTemplate[] {
  const same = list.find((x) => x.s === next.s && x.name === next.name);
  const id = same ? same.id : next.id;
  const kept = list.filter((x) => x.id !== id);
  if (kept.filter((x) => x.s === next.s).length >= TEMPLATES_CAP) return list;
  return [...kept, { ...next, id }];
}

export function removeTemplate(list: PrefTemplate[], id: string): PrefTemplate[] {
  return list.filter((x) => x.id !== id);
}

export function templatesOf(list: PrefTemplate[], s: TemplateSurface): PrefTemplate[] {
  return list.filter((x) => x.s === s);
}

/** **هل بلغ السطحُ سقفَه؟** — **يُقال قبل الحفظ لا بعد ضياعه** */
export function templatesFull(list: PrefTemplate[], s: TemplateSurface): boolean {
  return templatesOf(list, s).length >= TEMPLATES_CAP;
}
