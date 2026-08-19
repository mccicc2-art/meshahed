// الجولة التعريفية — الإعداد المركزي (١٩ أغسطس)

import type { Dict } from "./i18n";
import { updateUiState } from "./actions";
import { sanitizeTourState, type TourState } from "./uiState";

/**
 * خطوات الجولة تُكتب هنا وحدها — لا نصوصٌ موزّعة داخل المكوّنات (شرط
 * أحمد بنصّه). إضافةُ خطوةٍ غداً = صفٌّ هنا + مفتاحان في القاموس، ولا
 * يُمَسّ محرّكُ الجولة.
 *
 * `TOUR_VERSION` يرتفع حين تتغيّر الخطوات جوهرياً، فتُعرض الجولةُ
 * المحدَّثة على من أنهى القديمة دون أن تطارد أحداً في كل نشرة.
 *
 * والجولةُ غير التلميحات (`OneTimeHint`) عمداً: التلميحُ سطرٌ في صفحته
 * يشرح ميزتَها هي، والجولةُ رحلةٌ عبر الصفحات تقدّم Loopz كلَّه —
 * سطحان لسؤالين مختلفين لا تكرار.
 */

export const TOUR_KEY = "loopz-tour";
export const TOUR_VERSION = 1;

/* ⚖️ شكل الحالة انتقل إلى `uiState.ts` (طلب أحمد ١٩ أغسطس: الحفظ في
   الحساب): localStorage والعمود يتشاركان الشكل، والملفُّ النقيُّ يملكه
   لأن الأفعال تستورده ولا تستورد هذا الملف (لا دورة). */
export type { TourState } from "./uiState";

export interface TourStep {
  id: string;
  /** الصفحة التي تُزار في هذه الخطوة — الجولة تتنقّل فعلاً لا تصف من بعيد */
  path: string;
  title: (t: Dict) => string;
  body: (t: Dict) => string;
}

export const TOUR_STEPS: TourStep[] = [
  { id: "home", path: "/", title: (t) => t.tourHomeTitle, body: (t) => t.tourHomeBody },
  { id: "discover", path: "/news", title: (t) => t.tourDiscoverTitle, body: (t) => t.tourDiscoverBody },
  { id: "library", path: "/library", title: (t) => t.tourLibraryTitle, body: (t) => t.tourLibraryBody },
  { id: "lists", path: "/lists", title: (t) => t.tourListsTitle, body: (t) => t.tourListsBody },
  { id: "people", path: "/people", title: (t) => t.tourPeopleTitle, body: (t) => t.tourPeopleBody },
  { id: "messages", path: "/messages", title: (t) => t.tourMessagesTitle, body: (t) => t.tourMessagesBody },
  {
    id: "settings",
    path: "/profile/settings",
    title: (t) => t.tourSettingsTitle,
    body: (t) => t.tourSettingsBody,
  },
];

export function readTourState(): TourState | null {
  try {
    return sanitizeTourState(JSON.parse(localStorage.getItem(TOUR_KEY) ?? "null"));
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
