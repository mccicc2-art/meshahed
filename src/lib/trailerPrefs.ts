/**
 * 🆕 **آخرُ اختيارٍ للصوت** (D-726، شرطُ أحمد: «صامتٌ افتراضيّاً أوّل
 * مرّة، ثمّ يُحفظ آخر اختيار للمستخدم»).
 *
 * 🔑 **وكوكيزٌ لا `localStorage`** — **وصفةُ `tabPrefs` و`myRows` حرفاً**
 * (القاعدة ٦): **الصفحةُ خادميّةٌ فتقرأ التفضيلَ قبل الرسم** — **ولو
 * سكن المتصفّحَ وحدَه لبدأ كلُّ مشغّلٍ صامتاً ثمّ قفز إلى الصوت بعد
 * الترطيب**، **وقفزةُ صوتٍ أسوأُ من صمتٍ ثابت.** **وتعمل للزائر بلا
 * حساب.**
 */
export const TRAILER_SOUND_COOKIE = "loopz_trailer_sound";

/** **والافتراضُ صامت** — لا لأن المتصفّح يفرضه فحسب، بل لأن صوتاً
    يُطلق نفسَه في يد قارئٍ لم يطلبه هو العطلُ الذي يُغلق التطبيق. */
export function parseTrailerSound(raw: string | undefined | null): boolean {
  return raw === "on";
}

export function serializeTrailerSound(on: boolean): string {
  return on ? "on" : "off";
}
