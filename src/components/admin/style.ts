/**
 * 🆕 **شارةُ الحالة الواحدة في الإدارة** (المهمّة ٦٠١ · مراجعةُ ٢٧ نوفمبر).
 *
 * 🔴 **ما كان**: شاراتٌ مرسومةٌ باليد في ستِّ صفحاتٍ قديمة بزاويةٍ دائريّةٍ كاملة (`rounded-full`)، والصفحاتُ
 * الجديدةُ (القيادة والمؤشّرات) بزاويةٍ صغيرة (`rounded-md`) — **لهجتان لعنصرٍ واحد، وهذا خطأٌ لا ذوق**
 * (القاعدة ٣: نسخةٌ ثانيةٌ من أيِّ شيءٍ خطأ). فصارت دالّةً واحدةً بشكل الصفحات الجديدة، وألوانُها رموزُ الثيم
 * فتبقى مقروءةً في `daylight`.
 */
export type PillTone = "bad" | "warn" | "ok" | "mute";

const TONE: Record<PillTone, string> = {
  bad: "bg-error/15 text-error",
  warn: "bg-accent/15 text-accent",
  ok: "bg-success/15 text-success",
  mute: "bg-surface-2 text-muted",
};

export function pillClass(tone: PillTone, className = "") {
  return `inline-block shrink-0 rounded-md px-2 py-0.5 text-12 font-bold ${TONE[tone]} ${className}`.trim();
}

/**
 * 🆕 **حقلُ الإدخال الواحد في الإدارة** — بشكل حقل «السبب» في غرفة القيادة. كانت الصفحاتُ القديمةُ تكتب
 * `rounded-xl` على سطحين مختلفين، و`rounded-input` الذي لا رمزَ له في السلّم فيُرسم الحقلُ بلا زاوية. الزاويةُ `rounded-control`. `min-w-0` جزءٌ منه لا إضافة:
 * حقلٌ مرنٌ بلا حدٍّ أدنى يدفع صفَّه خارج شاشة ٣٩٠ (صفحةُ الروابط كانت ٤٧٠ نقطة).
 */
export const fieldBase = "min-w-0 rounded-control border border-border bg-surface-2 text-14";
/** الحشوُ المعتاد — ومن يحتاج حشواً أضيق يبني على `fieldBase` لا يضيف حشواً ثانياً فوق هذا (الأسبقيّةُ لترتيب CSS لا الأصناف) */
export const fieldClass = `${fieldBase} px-3 py-2`;
