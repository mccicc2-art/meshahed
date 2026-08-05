"use client";

/**
 * ناقل رسائل الخطأ العابرة.
 *
 * أحد عشر مكوّناً كانت تلتقط فشل الفعل وترتدّ بصمت: الزر يرجع لحاله بلا
 * تفسير، والمستخدم يعيد النقر فيصطدم بنفس الحدّ. الرسائل صارت مفيدة
 * («تمهّل لحظات» مثلاً) فتستحق الظهور — حدثُ نافذةٍ واحد يلتقطه
 * <ErrorFlash/> المركّب في الـlayout، بلا مكتبة ولا سياق React مشترك.
 */
export function flashError(message: string) {
  try {
    window.dispatchEvent(new CustomEvent<string>("loopz:flash", { detail: message }));
  } catch {
    /* لا شيء */
  }
}
