// الجولة التعريفية — الإعداد المركزي (١٩ أغسطس)

import type { Dict } from "@/core/i18n";
import { updateUiState } from "./actions";
import { sanitizeTourState, TOUR_IDS, type TourId, type TourState } from "./uiState";

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
/* ⚖️ 🆕 **٢ — والجولةُ صارت جولتين** (D-852): **الرقمُ يرتفع حين تتغيّر
   الخطواتُ جوهريّاً** (نصُّ رأس الملفّ) — **وقد تبدّلت البنيةُ نفسُها
   لا خطوةٌ فيها**، **فمن أنهى القديمةَ يُعرَض عليه الجديد مرّةً واحدة.** */
export const TOUR_VERSION = 2;

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

/**
 * ⚖️ 🆕 **جولتان لا واحدة** (D-852، طلبُ أحمد بنصّه: «يفضّل عمل جولتين،
 * وحدة الأساسيات والثانية التفاصيل والمميّزات الصغيرة»).
 *
 * 🔑 **والقسمةُ بالسؤال لا بالطول**: **الأولى تجيب «كيف أستعمله؟»
 * والثانية «ما الذي لا أعرف أنّه موجود؟»** — **ورحلةٌ واحدةٌ من خمس
 * عشرة خطوةً تُتخطّى عند السابعة**، **فيخسر القادمُ الجديدُ الأساسَ
 * ويخسر القديمُ التفاصيل.**
 *
 * 🔑 **والأولى تعلّم أفعالاً لا تصف أقساماً**: **الجولةُ القديمة كانت
 * سبعَ محطّاتٍ تقول ما في كلِّ صفحة** — **ومن لم يعرف كيف يضيف عملاً
 * ولا كيف يؤشّر حلقةً لم يتعلّم شيئاً** — **فصار فيها «كيف تضيف»
 * و«كيف تؤشّر» خطوتين قائمتين بذاتهما.**
 *
 * ⚠️ **وكلُّ مسارٍ هنا صفحةٌ قائمةٌ فعلاً** — **والجولةُ تُبحر إليها**
 * (`router.push`) — **فمسارٌ ميّتٌ يقذف المستخدمَ في ٤٠٤ وسطَ درسٍ عن
 * التطبيق.**
 */
export const TOURS: Record<TourId, TourStep[]> = {
  basics: [
    { id: "home", path: "/", title: (t) => t.tourHomeTitle, body: (t) => t.tourHomeBody },
    { id: "add", path: "/search", title: (t) => t.tourAddTitle, body: (t) => t.tourAddBody },
    { id: "track", path: "/library", title: (t) => t.tourTrackTitle, body: (t) => t.tourTrackBody },
    { id: "discover", path: "/news", title: (t) => t.tourDiscoverTitle, body: (t) => t.tourDiscoverBody },
    { id: "people", path: "/people", title: (t) => t.tourPeopleTitle, body: (t) => t.tourPeopleBody },
    {
      id: "settings",
      path: "/profile/settings",
      title: (t) => t.tourSettingsTitle,
      body: (t) => t.tourSettingsBody,
    },
  ],
  details: [
    { id: "customize", path: "/", title: (t) => t.tourCustomizeTitle, body: (t) => t.tourCustomizeBody },
    { id: "hold", path: "/library", title: (t) => t.tourHoldTitle, body: (t) => t.tourHoldBody },
    { id: "filters", path: "/news", title: (t) => t.tourFiltersTitle, body: (t) => t.tourFiltersBody },
    { id: "lists", path: "/lists", title: (t) => t.tourListsTitle, body: (t) => t.tourListsBody },
    { id: "calendar", path: "/calendar", title: (t) => t.tourCalendarTitle, body: (t) => t.tourCalendarBody },
    { id: "stats", path: "/statistics", title: (t) => t.tourStatsTitle, body: (t) => t.tourStatsBody },
    { id: "messages", path: "/messages", title: (t) => t.tourMessagesTitle, body: (t) => t.tourMessagesBody },
    {
      id: "plus",
      path: "/profile/settings/billing",
      title: (t) => t.tourPlusTitle,
      body: (t) => t.tourPlusBody,
    },
  ],
};

/** اسمُ كلِّ جولةٍ وسطرُها — **يقرؤهما صفّا الإعدادات ورأسُ البطاقة** */
export const TOUR_META: Record<TourId, { title: (t: Dict) => string; sub: (t: Dict) => string }> = {
  basics: { title: (t) => t.tourBasicsRow, sub: (t) => t.tourBasicsRowSub },
  details: { title: (t) => t.tourDetailsRow, sub: (t) => t.tourDetailsRowSub },
};

export { TOUR_IDS };
export type { TourId };

/** خطواتُ جولةٍ بعينها — **والمجهولُ يسقط إلى `basics`** (عُرفُ `sanitizeTourState`) */
export function stepsOf(id: TourId): TourStep[] {
  return TOURS[id] ?? TOURS.basics;
}

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

/**
 * حدَثُ بدء الجولة — تبثّه صفحةُ المساعدة ويسمعه `TourMount` في التخطيط.
 * 🆕 **ويحمل رمزَ الجولة في `detail`** (D-852) — **وحدثٌ بلا حمولةٍ كان
 * يكفي حين كانت الجولةُ واحدة.**
 */
export const TOUR_START_EVENT = "loopz:tour-start";
