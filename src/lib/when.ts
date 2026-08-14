import type { Dict } from "@/lib/i18n";

const DAY = 86400000;

function parseISO(date: string): Date | null {
  if (!date) return null;
  const d = new Date(date.length === 10 ? `${date}T00:00:00Z` : date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** تاريخ مقروء حسب اللغة: «20 أغسطس 2026» / «20 August 2026» بدل 2026-08-20 */
export function formatDate(date: string, t: Dict): string {
  const d = parseISO(date);
  if (!d) return date ?? "";
  return new Intl.DateTimeFormat(t.code === "en" ? "en-GB" : "ar", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    calendar: "gregory",
    numberingSystem: "latn",
  }).format(d);
}

/** صيغة قصيرة — للصفوف الضيقة مثل قائمة الحلقات. السنة تظهر فقط لو مختلفة */
export function formatDateShort(date: string, t: Dict): string {
  const d = parseISO(date);
  if (!d) return date ?? "";
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return new Intl.DateTimeFormat(t.code === "en" ? "en-GB" : "ar", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
    calendar: "gregory",
    numberingSystem: "latn",
  }).format(d);
}

/**
 * «قبل دقيقة · قبل ٣ ساعات · أمس · قبل ٥ أيام» — للأحداث الاجتماعية.
 *
 * التاريخ المطلق («٧ أغسطس») يجيب سؤالاً لا يسأله أحد في خطّ نشاط: من
 * يقرأ ما فعله أصدقاؤه يريد أن يعرف **كم مضى** لا **متى وقع** (طلب أحمد
 * 9 Aug: «في الأكتيفيتي لا يكتب التاريخ… يكتب قبل دقيقة أو ساعة أو يوم»).
 * والفرق أن الأول يُقاس بلمحة والثاني يحتاج حساباً ذهنياً.
 *
 * وبعد أسبوع يعود التاريخ المطلق: «قبل ٢٣ يوماً» تحتاج حساباً أيضاً،
 * والطزاجة لم تعد هي الخبر في ذلك العمر.
 */
export function timeAgo(iso: string, t: Dict): string {
  const d = parseISO(iso);
  if (!d) return "";
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return t.agoNow;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t.agoMinutes(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t.agoHours(hours);
  const days = Math.floor(hours / 24);
  if (days === 1) return t.agoYesterday;
  if (days <= 7) return t.agoDays(days);
  return formatDateShort(iso, t);
}

/**
 * **عمرٌ مختصر: `16m` · `4h` · `6d` · `3w`** (D-228، طلبُ أحمد: «استخدم
 * الاختصار… مثل تويتر»).
 *
 * **ولماذا صيغةٌ ثانيةٌ للزمن ولم تكفِ `timeAgo`:** الأولى جملةٌ تُقرأ
 * («قبل ست ساعات») ومكانُها حيث للزمن سطرٌ خاصّ. **وهذه وسمٌ يُلمح**،
 * مكانُه ترويسةٌ يتزاحم فيها اسمٌ وعنوانٌ وتقييمٌ ومقبضُ خيارات —
 * **وجملةٌ في موضعِ وسمٍ تسرق العرضَ من الاسم فيُقصّ.**
 * صيغتان لأن الموضعين يطلبان شيئين، لا لأن الشكلين اثنان.
 *
 * **والأرقام لاتينية في اللغتين** (D-015)، **والحرفُ بلغة القارئ**:
 * «س» عُرفُ تويتر العربيّ الراسخ، **واتّباعُ عُرفٍ راسخ ميزةٌ لا كسل**
 * (D-150). **ولا يعود إلى تاريخٍ مطلق بعد أسبوع** كما تفعل `timeAgo`:
 * وسمٌ من حرفين لا يتّسع لـ«7 Aug»، **والأسابيع تكفي في ترويسةٍ ضيّقة**.
 */
export function timeAgoShort(iso: string, t: Dict): string {
  const d = parseISO(iso);
  if (!d) return "";
  const ar = t.code !== "en";
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  if (mins < 1) return ar ? "الآن" : "now";
  if (mins < 60) return `${mins}${ar ? "د" : "m"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${ar ? "س" : "h"}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${ar ? "ي" : "d"}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}${ar ? "أ" : "w"}`;
  return `${Math.floor(weeks / 52)}${ar ? "ع" : "y"}`;
}

/** عدد الأيام المتبقية حتى تاريخ ما (سالب لو مضى) */
export function daysUntil(date: string): number | null {
  const d = parseISO(date);
  if (!d) return null;
  const today = parseISO(new Date().toISOString().slice(0, 10));
  if (!today) return null;
  return Math.ceil((d.getTime() - today.getTime()) / DAY);
}

/** يحوّل تاريخاً إلى «غداً / بعد 5 أيام / بعد 3 أسابيع» بدل التاريخ الخام */
export function whenLabel(date: string, t: Dict): string {
  const days = daysUntil(date);
  if (days === null) return "";
  if (days === 0) return t.whenToday;
  if (days < 0) return t.whenAiring;
  if (days === 1) return t.whenTomorrow;
  if (days <= 7) return t.whenInDays(days);
  if (days <= 60) return t.whenInWeeks(Math.round(days / 7));
  return t.whenOn(formatDate(date, t));
}
