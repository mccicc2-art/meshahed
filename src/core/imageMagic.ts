/**
 * A-20 (المدقّق ٢٤ أكتوبر) — **نوعُ الصورة من بايتاتها لا من تصريح العميل.**
 *
 * مساراتُ الرفع الثلاثة (صورةُ الملفّ · صورةُ النقاش · صورةُ الرسالة) كانت تصدّق `file.type` الذي يرسله العميل، واثنان منها
 * يكتبان في مخزنٍ عامّ. الآن تُقرأ البداياتُ المعروفة لـJPEG وPNG وWEBP، وما لا يطابق أحدَها يُردّ قبل المخزن،
 * ونوعُ المحتوى المخزَّن هو ما وُجد فعلاً. يكفي أوّلُ ١٢ بايتاً.
 */
export const IMAGE_SNIFF_BYTES = 12;

export type SniffedImage = { type: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

export function sniffImage(b: Uint8Array): SniffedImage | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { type: "image/png", ext: "png" };
  }
  /* RIFF .... WEBP */
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { type: "image/webp", ext: "webp" };
  }
  return null;
}

/** بداياتُ الملفّ المرفوع ثمّ نوعُه الحقيقيّ — `null` إن لم يكن صورةً من الثلاث */
export async function sniffBlob(file: Blob): Promise<SniffedImage | null> {
  try {
    return sniffImage(new Uint8Array(await file.slice(0, IMAGE_SNIFF_BYTES).arrayBuffer()));
  } catch {
    return null;
  }
}
