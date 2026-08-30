// حالة الواجهة التعليمية — التلميحات المقروءة وتقدّم الجولة (١٩ أغسطس)

/**
 * لماذا ملفٌّ نقيّ: يقرؤه الخادم (`actions.ts` عند الدمج قبل الكتابة)
 * والعميل (`UiStateSync` عند مزامنة الدخول) — ولا يستورد شيئاً منهما
 * فلا دورة استيراد (`tour.ts` يستورد الأفعال، والأفعال تستورد هذا).
 *
 * الشكل المخزَّن في `profiles.ui_state` (هجرة 121):
 *   { "hints": ["home-customize", …], "tour": { "v": 1, "i": 3, "s": "done" } }
 *
 * ⚖️ نقضٌ مسجَّل بطلب أحمد (١٩ أغسطس، نصّه: «اعتمد حفظ التلميحات
 * والجولة في حساب المستخدم، مع localStorage للزائر والمزامنة عند تسجيل
 * الدخول») — ينقض به قرارَ رأس `OneTimeHint` القديم («التلميح شأنُ
 * جهازٍ لا حساب») : localStorage يبقى ذاكرةَ الجهاز وأولَ ما يُقرأ،
 * والحسابُ مصدرَ الحقيقة الذي يتبع صاحبَه بين أجهزته.
 */

import { sanitizeSavedFilters, type SavedFilter } from "@/lib/savedFilters";
import { sanitizePrefTemplates, type PrefTemplate } from "@/lib/prefTemplates";

export const TOUR_STATE_VALUES = ["suggested", "active", "done"] as const;
export type TourStateS = (typeof TOUR_STATE_VALUES)[number];

/** حالة الجولة — تُخزَّن في localStorage وفي `ui_state.tour` بالشكل نفسه */
export interface TourState {
  v: number;
  /** رقم الخطوة الحالية — يُحفظ فيُستأنف من حيث توقّف */
  i: number;
  /** suggested: عُرض الاقتراح · active: تجري · done: أُنهيت أو تُخطّيت */
  s: TourStateS;
}

export interface UiState {
  hints: string[];
  tour: TourState | null;
  /**
   * 🆕 **الفلاترُ المحفوظة** (D-816) — **بيتُها هذا العمودُ لأنّه بلا
   * قيدِ شكلٍ عمداً** (D-475)، **فلا هجرةَ لبندٍ كاملٍ من خطّة الـ٢٤.**
   * ⚠️ **والمنطقُ في `savedFilters.ts` لا هنا**: **هذا الملفُّ يعرف
   * شكلَ العمود، وذاك يعرف معنى الفلتر** — **ودمجُهما يجعل كلَّ تعديلٍ
   * على الفلاتر يمسّ الجولةَ والتلميحات.**
   */
  filters: SavedFilter[];
  /**
   * 🆕 **قوالبُ التخصيص** (D-822) — **نفسُ حجّة الفلاتر أعلاه**:
   * **حالةُ صاحبِها وحدَه، وعمودٌ بلا قيدِ شكلٍ عمداً** (D-475).
   * ⚠️ **والمنطقُ في `prefTemplates.ts` لا هنا** — **وهذا الملفُّ
   * يعرف شكلَ العمود، وذاك يعرف معنى القالب.**
   */
  tpl: PrefTemplate[];
}

/** معرّف تلميح صالح — يدخل مفاتيح localStorage وعمودَ jsonb فيُقيَّد شكله */
const HINT_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** سقف عدد التلميحات المخزنة — التطبيق كله دون العشرين، والسقف صمّام */
const HINTS_CAP = 100;

export function sanitizeTourState(value: unknown): TourState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.v !== "number" ||
    typeof v.i !== "number" ||
    !TOUR_STATE_VALUES.includes(v.s as TourStateS)
  )
    return null;
  return { v: Math.trunc(v.v), i: Math.max(0, Math.trunc(v.i)), s: v.s as TourStateS };
}

/** قيمة العمود (أو أي مجهول) إلى شكلٍ مضمون — الفاسد يسقط صامتاً */
export function sanitizeUiState(value: unknown): UiState {
  const out: UiState = { hints: [], tour: null, filters: [], tpl: [] };
  if (!value || typeof value !== "object") return out;
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.hints)) {
    out.hints = [...new Set(v.hints.filter((h): h is string => typeof h === "string" && HINT_ID.test(h)))].slice(
      0,
      HINTS_CAP,
    );
  }
  out.tour = sanitizeTourState(v.tour);
  out.filters = sanitizeSavedFilters(v.filters);
  out.tpl = sanitizePrefTemplates(v.tpl);
  return out;
}

/** اتحاد قائمتَي تلميحات — «مقروءٌ في أي مكان مقروءٌ في كل مكان» */
export function mergeHints(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].slice(0, HINTS_CAP);
}

/**
 * أيّ حالتَي جولةٍ أبعد؟ عند مزامنة الدخول تُؤخذ الأبعد لا الأحدث
 * كتابةً: `done` يغلب (لا تُعاد جولةٌ أُنهيت على جهازٍ آخر)، ثم
 * `active` الأعلى خطوةً (يُستأنف من الأبعد)، ثم `suggested`.
 */
export function furtherTour(a: TourState | null, b: TourState | null): TourState | null {
  if (!a) return b;
  if (!b) return a;
  const rank = (s: TourStateS) => (s === "done" ? 2 : s === "active" ? 1 : 0);
  if (rank(a.s) !== rank(b.s)) return rank(a.s) > rank(b.s) ? a : b;
  return a.i >= b.i ? a : b;
}

/** هل حالتا جولةٍ متطابقتان؟ — لعدم كتابة ما لم يتغيّر */
export function sameTour(a: TourState | null, b: TourState | null): boolean {
  if (!a || !b) return a === b;
  return a.v === b.v && a.i === b.i && a.s === b.s;
}
