// الجولة التعريفية — الإعداد المركزي (١٩ أغسطس)

import { updateUiState } from "./actions";
import { liveTour, sanitizeTourState, type TourState } from "@/core/tour";

/**
 * 🆕 D-1318 — **السجلُّ والحالةُ في `core/tour.ts`** (جولةٌ واحدةٌ يقرؤها الويبُ والتطبيق)، **وهذا
 * الملفُّ بقي لما لا يصلح إلا في المتصفّح**: `localStorage` وفعلُ الخادم وحدثُ النافذة.
 * وما كان يُستورد منه يُعاد تصديراً، فلا يتغيّر مستدعٍ.
 *
 * والجولةُ غير التلميحات (`OneTimeHint`) عمداً: التلميحُ سطرٌ في صفحته يشرح ميزتَها هي، والجولةُ
 * رحلةٌ عبر الصفحات تقدّم Loopz كلَّه — سطحان لسؤالين مختلفين لا تكرار.
 */

export const TOUR_KEY = "loopz-tour";

export { TOUR_IDS, TOUR_META, TOUR_STEPS, TOUR_VERSION, stepsOf } from "@/core/tour";
export type { TourId, TourState, TourStep } from "@/core/tour";

/**
 * حالةُ هذا الجهاز — **وحالةُ إصدارٍ أقدمَ تُقرأ «لا شيء»** (`liveTour`): من أنهى الجولةَ القديمة
 * يُعرَض عليه الجديدُ مرّةً (حكمُ أحمد). ⚠️ والمزامنةُ (`UiStateSync`) تقرأ من هنا أيضاً، فلا
 * ترفع حالةً عتيقةً إلى الحساب.
 */
export function readTourState(): TourState | null {
  try {
    return liveTour(sanitizeTourState(JSON.parse(localStorage.getItem(TOUR_KEY) ?? "null")));
  } catch {
    return null;
  }
}

export function writeTourState(state: TourState) {
  try {
    localStorage.setItem(TOUR_KEY, JSON.stringify(state));
  } catch {
    /* تخزين معطّل — الجولة تعمل لهذه الجلسة ولا تُحفظ */
  }
}

/**
 * حفظٌ في الجهاز والحساب معاً — الطريق الوحيد الذي تكتب به الجولة
 * حالتَها (فلا ينسى أحدُ المسارين الآخر). الحسابُ لا يُنتظر ولا يُعلن
 * فشلُه: التقدّم شأنُ الجهاز فوراً، والحسابُ ذاكرةُ الأجهزة الأخرى.
 */
export function persistTourState(state: TourState) {
  writeTourState(state);
  void updateUiState({ tour: state }).catch(() => {});
}

/** حدَثُ بدء الجولة — تبثّه صفحةُ المساعدة ويسمعه `TourMount` في التخطيط */
export const TOUR_START_EVENT = "loopz:tour-start";
