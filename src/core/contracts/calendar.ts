/**
 * 🆕 **عقدُ التقويم الأصليّ** (D-1317، طلبُ أحمد: «حول التقويم لاصلية») — `GET /api/v1/me/calendar?m=YYYY-MM`.
 *
 * 🔑 **الخادمُ يحسب ويسمّي، والتطبيقُ يرسم**: الشهرُ وأيّامُه ومداخلُه من `core/calendar.ts` نفسِها التي
 * تبني صفحةَ الويب — وأسماءُ الشهر والأيّام تُصاغ هنا بـ`Intl` الخادم، فلا يفترق السطحان عند محرّكِ
 * جافاسكربت هاتفٍ لا يحمل بياناتِ اللغة كاملة.
 */
export interface CalendarCell {
  /** `YYYY-MM-DD` */
  date: string;
  day: number;
  in_month: boolean;
  is_today: boolean;
  /** كم مدخلاً في هذا اليوم — صفرٌ خانةٌ هادئة */
  count: number;
}

export interface CalendarItem {
  key: string;
  tmdb_id: number;
  media: "tv" | "movie";
  title: string;
  poster_path: string | null;
}

export interface CalendarGroup {
  date: string;
  /** «الخميس ٨ أكتوبر» بلغة القارئ */
  label: string;
  is_today: boolean;
  items: CalendarItem[];
}

export interface CalendarPayload {
  /** `YYYY-MM` — الشهرُ المعروض بعد التحقّق (مجهولٌ أو خارجَ المدى يسقط إلى الحاليّ) */
  month: string;
  /** «أكتوبر ٢٠٢٦» */
  label: string;
  /** الشهرُ السابق والتالي — `null` عند حدِّ المدى (لا ماضٍ، ولا أبعدَ من `MONTHS_AHEAD`) */
  prev: string | null;
  next: string | null;
  plus: boolean;
  /** شهرٌ غيرُ الحاليّ لغير المشترك — يُرسم باهتاً تحت بوّابة البلس كما في الويب */
  locked: boolean;
  /** سبعةُ أسماءٍ قصيرة، الأحدُ أوّلاً */
  weekdays: string[];
  cells: CalendarCell[];
  groups: CalendarGroup[];
  /** تلميحُ المرّة الواحدة `calendar-intro` لم يُرَ بعد */
  intro_hint: boolean;
}
