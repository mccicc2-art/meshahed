/**
 * اهتزازة لمسية موحّدة.
 *
 * كانت مبعثرة: نصف الأزرار يهتزّ ونصفها صامت، وكلٌّ بمدّته. دالة واحدة
 * يستدعيها كل فعلٍ تفاؤلي — فالطبقة اللمسية لغة واحدة عبر التطبيق.
 */
export function tap(pattern: number | number[] = 10) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* أجهزة بلا دعم — لا شيء */
  }
}
