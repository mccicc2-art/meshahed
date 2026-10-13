/**
 * 🆕 **عقدُ بيانات الودجتات** — `GET /api/v1/me/widget` (خطّةُ الودجتات، ١٣ أكتوبر).
 *
 * 🔑 **الودجتُ لا يملك جلسةً ولا شبكة** (قاعدةُ D-929 باقية): التطبيقُ يجلب هذا الردَّ بجلسته، ويصغّر
 * الملصقات، ويكتب الملفَّ في المجلّد المشترك، والودجتُ يرسم آخرَ ما وصله. فكلُّ ما يحتاجه الرسمُ هنا —
 * حتّى نصوصُه — لأنّ الودجتَ لا يعرف لغةَ التطبيق (D-946) ولا يقرأ قاموسنا.
 *
 * ⚠️ **والتواريخُ نصوصُ أيّامٍ لا تسمياتٌ جاهزة**: الودجتُ يرسم غداً ما كُتب اليوم، فـ«اليوم» تُحسب
 * عنده بتقويم الجهاز وقتَ الرسم — ولو كُتبت هنا لبقيت «اليوم» إلى أن يُفتح التطبيق.
 */

/** نسخةُ العقد — ودجتٌ أقدمُ من الحقل لا يقرأ ما لا يعرفه */
export const WIDGET_FEED_VERSION = 1;

export interface WidgetTitle {
  kind: "tv" | "movie";
  id: number;
  title: string;
  /** مسارُ TMDB — التطبيقُ يجلبه مصغّراً ويكتب مكانه اسمَ الملفّ المحلّيّ */
  poster_path: string | null;
}

/** «أكمل المشاهدة» — مسلسلٌ وحلقتُه التالية */
export interface WidgetContinueItem extends WidgetTitle {
  kind: "tv";
  season: number | null;
  episode: number | null;
  /** «م٢ · ح٧» بلغة القارئ — فارغٌ إن لم تُعرف الحلقة (لا يُخمَّن رقم، D-432) */
  label: string | null;
  /** 🆕 W17 — الودجتُ يرسم بطاقةَ «أكمل المشاهدة» نفسَها: صورتُها العريضة (`w780`)، وسطرُها الثاني كما هو في التطبيق
   *  («S23 E1175 · 6 left»)، ونسبتُها وشريطُها. تُبنى هنا لا في الودجت — الودجتُ لا يعرف القاموس ولا يحسب */
  backdrop_path: string | null;
  /** سطرُ البطاقة الثاني بلغة القارئ — `episodeLabel` الرئيسيّة + «باقي N» */
  sub: string | null;
  /** ٠–١٠٠، كالتطبيق: المشاهَدُ من المعروض */
  pct: number;
}

/** خانةٌ باهتةٌ من «للمشاهدة» — لمستُها تفتح التطبيقَ وتبدأ المسلسل (W5) */
export interface WidgetToWatchSeries extends WidgetTitle {
  kind: "tv";
  /** `unpause` لمسلسلٍ موقوفٍ مؤقّتاً (D-1281) — «ابدأ» عليه لا معنى لها */
  action: "start" | "unpause";
}

/** «القادم» — موعدٌ لمسلسلٍ يتابعه (W6 · W7 · W9) */
export interface WidgetUpcomingItem extends WidgetTitle {
  kind: "tv";
  /** `YYYY-MM-DD` بتاريخ TMDB كما يقرؤه التقويم — `null` = موسمٌ مؤكّدٌ بلا موعد (W7) */
  date: string | null;
  season: number | null;
  episode: number | null;
  /** «م٢ · ح٤» أو «الموسم ٣ · الحلقة الأولى» أو «الموسم ٣ · لم يُحدَّد موعد» */
  label: string | null;
  /** صاحبُه متأخّرٌ عنها: حلقتُه التالية غيرُ هذه — فلا ✓ ويُكتب «أنت عند …» (W9) */
  behind_label: string | null;
}

/** «فيلم الليلة» (W12) */
export interface WidgetMovie extends WidgetTitle {
  kind: "movie";
  runtime: number | null;
  /** تقييمُ TMDB للمقترَح وحدَه — فيلمُك في «للمشاهدة» لا يحتاج حجّة */
  rating: number | null;
  source: "towatch" | "suggested";
}

/** قائمةٌ محفوظةٌ يختارها الشخصُ مصدراً لـ«أكمل المشاهدة» (W10) */
export interface WidgetListSource {
  id: string;
  name: string;
  count: number;
  /** أوّلُ ثلاثة — لا تُملأ إلّا للقوائم المطلوبة في `?lists=` */
  items: WidgetTitle[];
}

/** نصوصُ الرسم بلغة القارئ — الودجتُ لا يحمل قاموساً (D-946) */
export interface WidgetStrings {
  continueTitle: string;
  comingUpTitle: string;
  tonightTitle: string;
  towatchTitle: string;
  all: string;
  /** يُلحق به العدد: «الكل ٥» */
  allCount: string;
  next: string;
  start: string;
  towatchStart: string;
  startSomething: string;
  noUpcoming: string;
  noTowatchMovies: string;
  today: string;
  tomorrow: string;
  anotherMovie: string;
  suggested: string;
  fromTowatch: string;
  /** `%s` = «م٢ · ح٢» */
  youAreAt: string;
  movieType: string;
  seriesType: string;
  emptySignedOut: string;
  /** «تراجع» بعد ✓ (الدفعة الثانية) — كلمةُ التوست في التطبيق نفسُها */
  undo: string;
}

export interface WidgetFeed {
  v: typeof WIDGET_FEED_VERSION;
  lang: "ar" | "en";
  dir: "rtl" | "ltr";
  /** يومُ القارئ بمنطقته وقتَ الكتابة — الودجتُ يقارن بيومه هو وقتَ الرسم */
  today: string;
  continue: { items: WidgetContinueItem[]; total: number };
  towatch_series: WidgetToWatchSeries[];
  /** «للمشاهدة» بنوعيه — مصدرٌ لـ«أكمل المشاهدة» حين يختاره الشخص (W10) */
  towatch_all: WidgetTitle[];
  upcoming: { items: WidgetUpcomingItem[]; total: number };
  tonight: WidgetMovie[];
  lists: WidgetListSource[];
  /** ✓ مخفيٌّ حتّى الدفعة الثانية (W14 · W15) — الخادمُ يكتبه `false` دائماً الآن */
  check: boolean;
  strings: WidgetStrings;
}
