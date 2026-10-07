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

import { sanitizeSavedFilters, type SavedFilter } from "@/core/savedFilters";
import { sanitizePrefTemplates, type PrefTemplate } from "@/core/prefTemplates";
import { sanitizeTourState, type TourState } from "@/core/tour";

/* 🆕 D-1318 — **شكلُ حالة الجولة وقواعدُها انتقلت إلى `core/tour.ts`**: التطبيقُ يقرؤها ويكتبها
   (T1) ولا يستورد من `lib`. وتُعاد تصديراً هنا فلا يتغيّر مستدعٍ واحد. */
export {
  TOUR_IDS,
  TOUR_STATE_VALUES,
  furtherTour,
  sameTour,
  sanitizeTourState,
  type TourId,
  type TourState,
  type TourStateS,
} from "@/core/tour";

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
