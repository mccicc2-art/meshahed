// الجولة التعريفية — سجلُّها الواحد وحالتُها (Phase 11-T · T0)

import type { Dict } from "./i18n.ts";

/**
 * 🆕 D-1318 — **جولةٌ واحدةٌ من سبع خطوات، وسجلٌّ واحدٌ يقرؤه الويبُ والتطبيق.**
 *
 * 🔑 **لماذا واحدةٌ بعد أن كانتا اثنتين** (D-852 منقوضٌ بمراجعة أحمد ٨ أكتوبر): الثانيةُ لم تكن تظهر
 * لأحدٍ من تلقاء نفسها، ولا موعدَ صادقاً لها — كلُّ عتبةٍ («بعد خمسة أعمال») تخمين. والجولتان
 * تكرّران الفلترَ والملفَّ والمكتبة. **فما يُشرح بالمرور بقي هنا، وما يُشرح في مكانه صار تلميحةً
 * في مكانه** (القوائم · الضغط المطوّل · السحب · «صفوفك» — شريحةُ T2).
 *
 * 🔑 **والبيتُ `core` لا `lib`**: التطبيقُ يرسم الجولةَ على شاشاته الأصليّة (T1)، وهو لا يستورد
 * من `lib` (أفعالُ خادمٍ و`localStorage`). ملفٌّ نقيٌّ يُقرأ من الطرفين، وخطوةٌ تُضاف مرّةً تظهر
 * فيهما — وسجلّان يفترقان عند أوّل تعديل (D-145).
 *
 * ⚠️ **والترتيبُ حكمُ أحمد لا اجتهاد**: تبدأ بـ«اكتشف» («الجولة واحد خله يبدا باكتشف»)، و«الرئيسية
 * والملف» السادسةُ والمجتمعُ السابعة («خل الإعدادات … رقم 6 و المجتمع رقم 7») — فالتخصيصُ يلي
 * ما يخصّصه مباشرةً، والجولةُ تنتهي على تبويبٍ من الشريط لا داخل الإعدادات.
 *
 * ⚠️ **ولا خطوةَ تفترض مكتبةً فارغة**: الترحيبُ (`/welcome`) لا يُتجاوز قبل اختيار عملٍ واحد —
 * فنصُّ المكتبة يقول «أعمالك التي اخترتها هنا» بصيغة الحاضر (تصحيحُ أحمد).
 */

/**
 * ٣ — **الجولةُ تبدّلت كلُّها** (جولتان → واحدة، ترتيبٌ ونصوصٌ جديدة). وحكمُ أحمد: تُعرض مرّةً على
 * الجميع، ومنهم من أنهى القديمة («اقتراحك»).
 *
 * 🔴 **والرقمُ كان يُكتب ولا يُقرأ**: `TourMount` يقترح حين لا حالةَ فقط، فمن أنهى الإصدارَ ٢ لم
 * يكن ليُعرَض عليه شيءٌ مهما ارتفع الرقم. **`liveTour` أدناه هو القارئ.**
 */
export const TOUR_VERSION = 3;

export const TOUR_STATE_VALUES = ["suggested", "active", "done"] as const;
export type TourStateS = (typeof TOUR_STATE_VALUES)[number];

/** **جولةٌ واحدة** — والقائمةُ تبقى قائمةً: صفُّ المساعدة وعقدُ الإعدادات يُشتقّان منها */
export const TOUR_IDS = ["basics"] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** حالة الجولة — تُخزَّن في localStorage وفي `ui_state.tour` بالشكل نفسه */
export interface TourState {
  v: number;
  /**
   * أيُّ جولة. **والحالةُ واحدةٌ بقصد**: `null` يعني «لم تُعرَض عليه قطّ».
   * ⚠️ **اختياريّةٌ في النوع لا في القراءة**: `sanitizeTourState` تُرجعها دائماً — والاختياريّةُ
   * لأنّ صفوفَ الإصدار الأوّل بلا هذا الحقل.
   */
  id?: TourId;
  /** رقم الخطوة الحالية — يُحفظ فيُستأنف من حيث توقّف */
  i: number;
  /** suggested: عُرض الاقتراح · active: تجري · done: أُنهيت أو تُخطّيت */
  s: TourStateS;
}

export function sanitizeTourState(value: unknown): TourState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.v !== "number" ||
    typeof v.i !== "number" ||
    !TOUR_STATE_VALUES.includes(v.s as TourStateS)
  )
    return null;
  /* **والمجهولُ يسقط إلى `basics` لا إلى `null`** (D-475): حالةٌ كاملةٌ برمزٍ لا نعرفه أهونُ من
     إسقاطها كلِّها. ومنه `details` القديمة — وإصدارُها (٢) يُسقطها `liveTour` على أيِّ حال. */
  const id = TOUR_IDS.includes(v.id as TourId) ? (v.id as TourId) : "basics";
  return {
    v: Math.trunc(v.v),
    id,
    i: Math.max(0, Math.trunc(v.i)),
    s: v.s as TourStateS,
  };
}

/**
 * **الحالةُ التي تُقرأ**: حالةُ إصدارٍ أقدمَ تُعدّ «لم تُعرَض قطّ».
 *
 * 🔑 **ولا تُمحى من الحساب**: القراءةُ تتجاهلها والكتابةُ التالية تستبدلها — فلا هجرةَ ولا
 * فعلَ تنظيف. ومن أنهى القديمةَ يُعرَض عليه الجديدُ **مرّةً**: لحظةَ يُعرَض تُكتب حالةُ الإصدار
 * الجديد، فلا يعود.
 */
export function liveTour(state: TourState | null): TourState | null {
  return state && state.v >= TOUR_VERSION ? state : null;
}

/**
 * أيّ حالتَي جولةٍ أبعد؟ عند مزامنة الدخول تُؤخذ الأبعد لا الأحدث كتابةً: `done` يغلب (لا تُعاد
 * جولةٌ أُنهيت على جهازٍ آخر)، ثم `active` الأعلى خطوةً (يُستأنف من الأبعد)، ثم `suggested`.
 *
 * ⚠️ **والإصدارُ قبل الترتيب**: `done` الإصدار ٢ كانت تغلب `suggested` الإصدار ٣ — فيُمحى عرضُ
 * الجولة الجديدة بإنهاء القديمة، وهو عكسُ ما رُفع الإصدارُ لأجله.
 */
export function furtherTour(a: TourState | null, b: TourState | null): TourState | null {
  if (!a) return b;
  if (!b) return a;
  if (a.v !== b.v) return a.v > b.v ? a : b;
  const rank = (s: TourStateS) => (s === "done" ? 2 : s === "active" ? 1 : 0);
  if (rank(a.s) !== rank(b.s)) return rank(a.s) > rank(b.s) ? a : b;
  return a.i >= b.i ? a : b;
}

/** هل حالتا جولةٍ متطابقتان؟ — لعدم كتابة ما لم يتغيّر */
export function sameTour(a: TourState | null, b: TourState | null): boolean {
  if (!a || !b) return a === b;
  return a.v === b.v && a.i === b.i && a.s === b.s;
}

/**
 * **ما يُكتب في الحساب حين يصل طلبُ كتابة.**
 *
 * 🔑 **الإصدارُ الأقدمُ لا يكتب فوق الأحدث** — جهازٌ بحزمةٍ عتيقة (تبويبٌ مفتوحٌ منذ أمس، أو
 * تطبيقٌ لم يأخذ تحديثَه) يكتب حالةَ الإصدار ٢، فيمحو عرضَ الجديدة أو تقدّمَها.
 *
 * ⚠️ **وليست `furtherTour`** (كما كتبت الخطّة): تلك تمنع الرجوعَ خطوةً وتمنع إعادةَ الجولة من
 * «المساعدة» بعد إنهائها — و«السابق» و«أعد الجولة» فعلان مقصودان يكتبان حالةً «أدنى».
 */
export function tourWrite(current: TourState | null, patch: TourState | null): TourState | null {
  if (!patch) return current;
  return current && patch.v < current.v ? current : patch;
}

/** الزرُّ الذي تحيطه الحلقةُ في التطبيق — معرّفٌ تسجّله الشاشةُ نفسُها (T1) */
export type TourAnchor = "discover-filter" | "search-describe" | "home-avatar";

/** شاشةُ الخطوة في التطبيق — **اسمٌ لا مسار**: مساراتُ expo-router شأنُ التطبيق وحدَه */
export type TourScreen = "discover" | "search" | "library" | "home" | "profile" | "customize" | "community";

export interface TourStep {
  id: string;
  /** صفحةُ الويب التي تُزار في هذه الخطوة — الجولةُ تتنقّل فعلاً لا تصف من بعيد */
  path: string;
  screen: TourScreen;
  anchor?: TourAnchor;
  title: (t: Dict) => string;
  body: (t: Dict) => string;
  /**
   * **نصُّ ما قبل الفعل** — للتطبيق وحدَه: خطوةُ الملفّ تقف على الرئيسية والحلقةُ على صورته
   * ويضغطها بنفسه (حكمُ أحمد: «يضغطها بنفسه مع علامة اضغط هنا»)، فالبطاقةُ تدعوه أوّلاً ثمّ
   * تصف ما فتحه. والويبُ يُبحر إلى الملفّ مباشرةً ويعرض `body`.
   */
  lead?: (t: Dict) => string;
}

/**
 * ⚠️ **وكلُّ مسارٍ هنا صفحةٌ قائمةٌ فعلاً** — الجولةُ تُبحر إليها (`router.push`)، ومسارٌ ميّتٌ
 * يقذف القارئَ في ٤٠٤ وسطَ درسٍ عن التطبيق. `/profile` يحوّل إلى ملفّه العامّ (D-434).
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "discover",
    path: "/news",
    screen: "discover",
    anchor: "discover-filter",
    title: (t) => t.tourDiscoverTitle,
    body: (t) => t.tourDiscoverBody,
  },
  {
    id: "search",
    path: "/search",
    screen: "search",
    anchor: "search-describe",
    title: (t) => t.tourSearchTitle,
    body: (t) => t.tourSearchBody,
  },
  { id: "track", path: "/library", screen: "library", title: (t) => t.tourTrackTitle, body: (t) => t.tourTrackBody },
  { id: "home", path: "/", screen: "home", title: (t) => t.tourHomeTitle, body: (t) => t.tourHomeBody },
  {
    id: "profile",
    path: "/profile",
    screen: "profile",
    anchor: "home-avatar",
    title: (t) => t.tourProfileTitle,
    body: (t) => t.tourProfileBody,
    lead: (t) => t.tourProfileLead,
  },
  {
    id: "shape",
    path: "/profile/settings/home",
    screen: "customize",
    title: (t) => t.tourShapeTitle,
    body: (t) => t.tourShapeBody,
  },
  {
    id: "community",
    path: "/people",
    screen: "community",
    title: (t) => t.tourCommunityTitle,
    body: (t) => t.tourCommunityBody,
  },
];

/** اسمُ الجولة وسطرُها — يقرؤهما صفُّ «المساعدة» في الويب والتطبيق */
export const TOUR_META: Record<TourId, { title: (t: Dict) => string; sub: (t: Dict) => string }> = {
  basics: { title: (t) => t.tourRow, sub: (t) => t.tourRowSub },
};

/** خطواتُ الجولة — **والمعرّفُ يبقى في التوقيع**: المستدعون يمرّرونه، وجولةٌ ثانيةٌ غداً صفٌّ لا إعادةُ كتابة */
export function stepsOf(id?: TourId): TourStep[] {
  void id;
  return TOUR_STEPS;
}
