// الجولة التعريفية — سجلُّها الواحد وحالتُها (Phase 11-T · T0)

import type { Dict } from "./i18n.ts";
import { AI_STORY_SEARCH_PLUS_ONLY } from "./plan.ts";

/**
 * 🆕 D-1318 — **جولةٌ واحدةٌ، وسجلٌّ واحدٌ يقرؤه الويبُ والتطبيق.** (سبعُ خطواتٍ في الويب وثمانٍ في التطبيق منذ T357 —
 * الثامنةُ «الربط» لا صفحةَ لها في الويب؛ انظر `TOUR_STEPS`.)
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
 * ما يخصّصه مباشرةً. والويبُ ينتهي على تبويبٍ من الشريط؛ والتطبيقُ منذ T357 على صفحة «الربط» (حكمُ أحمد ٩ نوفمبر:
 * «٨ الربط و صفحة الاشتراك»، ثمّ «٦أ») — ينقض «تنتهي على تبويبٍ لا داخل الإعدادات» في التطبيق وحدَه.
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
export type TourAnchor = "discover-filter" | "search-describe" | "home-avatar" | "drawer-customize" | "community-messages";

/** شاشةُ الخطوة في التطبيق — **اسمٌ لا مسار**: مساراتُ expo-router شأنُ التطبيق وحدَه */
export type TourScreen = "discover" | "search" | "library" | "home" | "menu" | "customize" | "community" | "links";

export interface TourStep {
  id: string;
  /** صفحةُ الويب التي تُزار في هذه الخطوة — الجولةُ تتنقّل فعلاً لا تصف من بعيد */
  path: string;
  screen: TourScreen;
  anchor?: TourAnchor;
  title: (t: Dict) => string;
  body: (t: Dict) => string;
  /**
   * **نصُّ ما قبل الفعل** — للتطبيق وحدَه (🆕 T362: والمجتمعُ أيضاً — يضغط زرَّ الرسائل فتُفتح): خطوةُ القائمة تقف على الرئيسية والحلقةُ على صورته
   * ويضغطها بنفسه (حكمُ أحمد: «يضغطها بنفسه مع علامة اضغط هنا»)، فالبطاقةُ تدعوه أوّلاً ثمّ
   * تصف ما فتحه. والويبُ يُبحر إلى الملفّ مباشرةً ويعرض `body`.
   */
  lead?: (t: Dict) => string;
  /**
   * 🆕 T357 — **نصُّ التطبيق حين يختلف عن الويب** (مراجعةُ أحمد ٩ نوفمبر). الشاشتان افترقتا بعد ٨ أكتوبر: في التطبيق
   * قائمةٌ جانبيّةٌ تفتحها الصورةُ وفيها الإعداداتُ واللغة (D-1505)، وفي الويب زرُّ الإعدادات في الرأس والصورةُ تفتح الملفّ.
   * فجملةٌ واحدةٌ للطرفين تكذب في أحدهما. الغائبُ هنا يعني «نصُّ الويب صادقٌ في التطبيق أيضاً».
   */
  appTitle?: (t: Dict) => string;
  /** `plus`: هل العضوُ مشترك — ما يُقفل عليه يُقال لغير المشترك وحدَه (حكمُ أحمد «٥أ») */
  appBody?: (t: Dict, plus: boolean) => string;
  /**
   * **خطوةٌ بمرحلتين في التطبيق** (القائمة الجانبيّة): قبل الفعل `lead` والحلقةُ على `anchor`؛ فإذا فتح القائمةَ بنفسه
   * انتقلت الحلقةُ إلى `openAnchor` ومعها «اضغط هنا»، والبطاقةُ تصف ما فُتح (`appBody`) ثمّ تدعوه إليه (`tap`).
   */
  openAnchor?: TourAnchor;
  tap?: (t: Dict) => string;
  /** وسمُ PLUS بجانب العنوان — حين تشرح البطاقةُ ميزةً مقفلةً على هذا العضو (حكمُ أحمد «٥أ») */
  plusTag?: (plus: boolean) => boolean;
  /**
   * **للتطبيق وحدَه** — صفحةُ «الربط» لا وجودَ لها في الويب. ⚠️ **ولا تكون إلّا آخراً**: الحالةُ رقمُ خطوةٍ واحدٌ يشترك
   * فيه الطرفان (`ui_state.tour.i`)، وخطوةٌ تُحذف من وسط الويب تزيح ما بعدها فيستأنف الويبُ غيرَ ما وقف عليه التطبيق.
   */
  appOnly?: boolean;
  /**
   * 🆕 T362 — **إلى أين يذهب «إنهاء»** في التطبيق (أحمد ١٠ نوفمبر: «لازم يروح لصفحة الاشتراك وتخلص اللفه هناك» ثمّ «٣أ» — للجميع).
   * علامةُ × تخطٍّ لا إنهاء، فلا تذهب إلى شيء.
   */
  endsOn?: "plus";
}

/**
 * ⚠️ **وكلُّ مسارٍ هنا صفحةٌ قائمةٌ فعلاً** — الجولةُ تُبحر إليها (`router.push`)، ومسارٌ ميّتٌ
 * يقذف القارئَ في ٤٠٤ وسطَ درسٍ عن التطبيق. `/profile` يحوّل إلى ملفّه العامّ (D-434).
 *
 * 🆕 T357 — **ثماني خطواتٍ في التطبيق، وسبعٌ في الويب** (مراجعةُ أحمد ٩ نوفمبر: «١أ · ٢أ · ٥أ · ٦أ»، والسابعةُ «المجتمع
 * والرسايل الخاصة» والثامنةُ «الربط وصفحة الاشتراك»). الخامسةُ في التطبيق **القائمةُ الجانبيّة** — الصورةُ تفتحها كما تفتحها
 * بعد الجولة، فلا تُعلّمه الجولةُ ما يكذب بعد دقيقة؛ ومنها يضغط «التخصيص» بنفسه فيدخل السادسةَ بطريقها الحقيقيّ ويرى
 * المعاينةَ الحيّة («حلو انه يشوف المعاينة الحية»). والثامنةُ تقف على «الربط»: ميزةٌ مجّانيّةٌ يجرّبها فوراً.
 * 🆕 T362 — **و«إنهاء» في الثامنة يفتح صفحةَ الاشتراك وتنتهي الجولةُ هناك** (أحمد ١٠ نوفمبر: «لازم يروح لصفحة الاشتراك
 * وتخلص اللفه هناك»، «٣أ» للجميع) — ينقض «٦أ» من الأمس (صفحةُ الاشتراك من «اعرف أكثر» وحدَه). والسابعةُ بمرحلتين: زرُّ
 * الرسائل في رأس المجتمع ثمّ «الرسائل» نفسُها.
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
    /* مفتوحٌ للجميع حتى تُقلب البوّابة (المرحلة ٥) — والوسمُ يتبعها لا يسبقها */
    plusTag: (plus) => AI_STORY_SEARCH_PLUS_ONLY && !plus,
  },
  {
    id: "track",
    path: "/library",
    screen: "library",
    title: (t) => t.tourTrackTitle,
    body: (t) => t.tourTrackBody,
    appBody: (t) => t.tourTrackBodyApp,
  },
  {
    id: "home",
    path: "/",
    screen: "home",
    title: (t) => t.tourHomeTitle,
    body: (t) => t.tourHomeBody,
    /* الرسائلُ انتقلت إلى السابعة، والإعداداتُ إلى القائمة — فلا يبقى في الرأس ما يُذكر إلّا الإشعارات */
    appBody: (t) => t.tourHomeBodyApp,
  },
  {
    /* الويبُ: «ملفك» كما كانت (الصورةُ هناك تفتح الملفّ) · التطبيقُ: القائمةُ الجانبيّة — والرقمُ واحدٌ في الطرفين */
    id: "menu",
    path: "/profile",
    screen: "menu",
    anchor: "home-avatar",
    openAnchor: "drawer-customize",
    title: (t) => t.tourProfileTitle,
    body: (t) => t.tourProfileBody,
    appTitle: (t) => t.tourMenuTitle,
    lead: (t) => t.tourMenuLead,
    appBody: (t) => t.tourMenuBody,
    tap: (t) => t.tourMenuTap,
  },
  {
    id: "shape",
    path: "/profile/settings/home",
    screen: "customize",
    title: (t) => t.tourShapeTitle,
    body: (t) => t.tourShapeBody,
    appBody: (t, plus) => (plus ? t.tourShapeBodyApp : `${t.tourShapeBodyApp} ${t.tourShapeSaveFree}`),
    plusTag: (plus) => !plus,
  },
  {
    /* 🆕 T362 — **مرحلتان كالقائمة** (أحمد ١٠ نوفمبر: «رقم ٧ ما شاف بعدها الرسايل» ثمّ «٢أ»): الحلقةُ على زرّ الرسائل في رأس
       المجتمع (`lead`)، فإذا ضغطه بنفسه فُتحت «الرسائل» ووصفتها البطاقةُ هناك (`appBody`). كانت تقول «من زرّ الرسائل أعلى
       الرئيسية» وهي واقفةٌ على المجتمع — وعدٌ لا يُرى */
    id: "community",
    path: "/people",
    screen: "community",
    anchor: "community-messages",
    title: (t) => t.tourCommunityTitle,
    body: (t) => t.tourCommunityBody,
    appTitle: (t) => t.tourCommunityTitleApp,
    lead: (t) => t.tourCommunityLeadApp,
    appBody: (t) => t.tourCommunityBodyApp,
  },
  {
    id: "links",
    /* لا تُزار في الويب (`appOnly`) — المسارُ للنوع وحدَه */
    path: "",
    screen: "links",
    appOnly: true,
    title: (t) => t.tourLinksTitle,
    body: (t) => t.tourLinksBody,
    /* الربطُ مجّانيٌّ (تطبيقٌ واحد) فلا وسم — والمشتركُ يُقال له ما عنده لا ما يفوته */
    appBody: (t, plus) => (plus ? t.tourLinksBodyPlus : t.tourLinksBody),
    endsOn: "plus",
  },
];

/** خطواتُ الويب — بلا ما لا صفحةَ له هناك. وما يُحذف آخرٌ دائماً، فأرقامُ ما بقي أرقامُ التطبيق نفسُها */
export const WEB_TOUR_STEPS: TourStep[] = TOUR_STEPS.filter((s) => !s.appOnly);

/** ما تعرضه بطاقةُ التطبيق: نصُّه إن كان له نصٌّ، وإلّا نصُّ الويب */
export function appTitleOf(step: TourStep, t: Dict): string {
  return (step.appTitle ?? step.title)(t);
}
export function appBodyOf(step: TourStep, t: Dict, plus: boolean): string {
  return step.appBody ? step.appBody(t, plus) : step.body(t);
}

/** اسمُ الجولة وسطرُها — يقرؤهما صفُّ «المساعدة» في الويب والتطبيق */
export const TOUR_META: Record<TourId, { title: (t: Dict) => string; sub: (t: Dict) => string }> = {
  basics: { title: (t) => t.tourRow, sub: (t) => t.tourRowSub },
};

/**
 * خطواتُ الجولة — **والمعرّفُ يبقى في التوقيع**: المستدعون يمرّرونه، وجولةٌ ثانيةٌ غداً صفٌّ لا إعادةُ كتابة.
 * والويبُ (الافتراض) يأخذ خطواتِه؛ التطبيقُ يقرأ `TOUR_STEPS` كاملة.
 */
export function stepsOf(id?: TourId, platform: "web" | "app" = "web"): TourStep[] {
  void id;
  return platform === "app" ? TOUR_STEPS : WEB_TOUR_STEPS;
}
