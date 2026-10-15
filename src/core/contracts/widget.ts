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

import type { WidgetLayoutConfig } from "../widgetLayout.ts";
import type { WidgetLook } from "../widgetLook.ts";

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
  /** 🆕 v2 (W34 · W42) — بطاقةُ فيلم الليلة العريضة ١٦:٩ ترسم الهيدر لا بوستراً مقصوصاً (W38). ودجتُ 1.12.x لا يقرؤه */
  backdrop_path?: string | null;
  /** 🆕 W46 — شكلُ «القائمة» الصغير لفيلم الليلة يكتب التصنيفَ والسنة (أحمد «اعتمد»، ١٤ أكتوبر). بلغة القارئ؛ ودجتُ 1.12.x لا يقرؤهما */
  year?: number | null;
  genre?: string | null;
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

/* ───────────── 🆕 الودجت الواحد (v2، W28–W43) ─────────────
 * 🔑 **حقلٌ إضافيٌّ لا نسخةٌ جديدة**: `v` يبقى ١ لأنّ ودجتات 1.12.x على الشاشات تقرأ هذا الردَّ نفسَه،
 * وودجتٌ قديمٌ يتجاهل `v2` ولا يسقط. والودجتُ الجديد يقرأ `v2` وحده. */

/** فيلمٌ أو مسلسلٌ في «القادم» — W32: الأفلامُ داخلةٌ أيضاً */
export interface WidgetUpcomingAny extends WidgetTitle {
  date: string | null;
  /** «م٤ · ح١» للمسلسل، و«عرضٌ أوّل» للفيلم */
  label: string | null;
}

/** سطرُ «أصدقاؤك» — من تتابعهم أو من تختارهم (W32) */
export interface WidgetFriendItem {
  name: string;
  avatar_url: string | null;
  /** «أنهى» · «قيّم ★ 9» · «بدأ» بلغة القارئ — الفعلُ يُبنى في الخادم */
  action: string;
  title: WidgetTitle;
  /** ISO — الرسّامُ يكتب «قبل ساعة» بساعة الجهاز وقتَ الرسم */
  at: string;
  /**
   * 🆕 W51 — السطرُ الثاني جاهزاً بلغة القارئ: «٣ حلقة · م٢» أو «★ ٨» (أو «شاهد Dune» للفيلم بلا تقييم). الرسّامُ الأقدمُ
   * يتجاهله ويكتب `action` والعنوانَ كما كان. والأرقامُ نفسُها معه لرسمٍ قادم — **لا رقمَ حلقةٍ بعينها** (لا يوجد في الخطّ).
   */
  line?: string | null;
  kind?: "episodes" | "movie" | "rate" | "add" | null;
  episodes?: number | null;
  season?: number | null;
  rating?: number | null;
}

/** سطرُ «أنشطتك» — نشاطُك أنت (W32) */
export interface WidgetActivityItem {
  /** «✓ Severance» · «قيّمت Dune» · «أضفت Andor» */
  line: string;
  sub: string | null;
  title: WidgetTitle;
  at: string;
}

/** «للمشاهدة» — الأحدثُ إضافةً أوّلاً (W35) */
export interface WidgetToWatchItem extends WidgetTitle {
  /** نوعُه كما يُقرأ: مسلسل · فيلم · أنمي */
  type_label: string;
  rating: number | null;
  /** «ابدأ» للمسلسل والأنمي، «شاهدته» للفيلم */
  action: "start" | "watched";
  added_at: string;
}

/** تخطيطٌ محفوظٌ في التطبيق — ورقةُ «تعديل الأداة» في الآيفون تختار واحداً منها (W40، الخيار ب) */
export interface WidgetLayoutEntry {
  id: string;
  name: string;
  config: WidgetLayoutConfig;
}

export interface WidgetStringsV2 {
  searchPlaceholder: string;
  trendingToday: string;
  friendsTitle: string;
  activityTitle: string;
  watched: string;
  /** سطرُ «القادم» تحت البطاقات (W33): يُلحق به الموعد */
  upLinePrefix: string;
  /** W33 — «لا مواعيد قادمة لأعمالك» (الأفلامُ داخلةٌ الآن، فلا «لمسلسلاتك») */
  noUpcoming: string;
  /** رقاقةُ «فيلم آخر» بلا السهم — الأيقونةُ يرسمها الرسّام (W36) */
  another: string;
  plusLockedTitle: string;
  plusLockedSub: string;
  plusLapsedTitle: string;
  plusLapsedSub: string;
  subscribe: string;
  renew: string;
  /** 🆕 الدفعةُ الثانية (W37): «قيّم %s» لشريط التقييم، و«تخطَّ»، و«بدأته» بعد «ابدأ»، و«تراجع» — اختياريّةٌ للخلاصات الأقدم */
  rate?: string;
  skip?: string;
  started?: string;
  undo?: string;
}

export interface WidgetFeedV2 {
  /**
   * 🆕 **شكلُ الودجت بياناتٍ** (`widgetLook.ts`): أحجامُ الخطوط والصفوف والبوسترات لكلِّ حجمٍ ومنصّة. المحرّكُ في التطبيق يحسم
   * بها والرسّامان يقرآنها — تعديلُها يصل بلا بناء. اختياريٌّ: خلاصةٌ أقدمُ بلاه تُرسم بالأرقام المكتوبة في الرسّامَين.
   */
  look?: WidgetLook;
  /** W41 — المشتركُ يرى إعدادَه كاملاً؛ غيرُه أكملَ المشاهدة في الصغير والمتوسّط */
  plus: boolean;
  /** كان مشتركاً وانتهى — يُقفل عليه ويبقى إعدادُه محفوظاً */
  lapsed: boolean;
  /** إعدادُ الودجت الجديد في أندرويد، والتخطيطُ الأوّلُ في الآيفون */
  config: WidgetLayoutConfig;
  layouts: WidgetLayoutEntry[];
  trending: WidgetTitle[];
  friends: WidgetFriendItem[];
  activity: WidgetActivityItem[];
  towatch: WidgetToWatchItem[];
  upcoming: { items: WidgetUpcomingAny[]; total: number };
  strings: WidgetStringsV2;
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
  /** 🆕 الودجت الواحد — اختياريٌّ حتّى يملأه المسار */
  v2?: WidgetFeedV2;
}

/* ───────── 🆕 شاشةُ «ودجت لوبز» (`/api/v1/me/prefs/widget`) ───────── */
export interface WidgetPrefsPayload {
  config: WidgetLayoutConfig;
  layouts: WidgetLayoutEntry[];
  plus: boolean;
  lapsed: boolean;
}
export interface WidgetPrefsBody {
  widget: { config: WidgetLayoutConfig; layouts: WidgetLayoutEntry[] };
}
export interface WidgetPrefsResult {
  ok: boolean;
  needsPlus?: true;
}
