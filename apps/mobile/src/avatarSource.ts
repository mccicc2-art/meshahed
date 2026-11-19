import type { ImageSource } from "expo-image";

/**
 * مصدرُ صورةِ صاحبٍ (أفاتار) للشاشات الأصليّة — **وختمُ لوبز من أصول التطبيق لا من الشبكة.**
 *
 * لماذا: حسابُ لوبز يحمل `avatar_url = "/loopz-mark.png"` (`src/core/loopz.ts`) — مسارٌ نسبيٌّ لا
 * يُفتح خارج المتصفّح، وبعضُ الأبواب تُكمله إلى `https://loopztv.com/loopz-mark.png`، **وطلبُ
 * الصورة من التطبيق يخرج عميلاً غيرَ متصفّح فيقف عند تحدّي الحماية** (القاعدةُ ٢ تستثني
 * `/api/v1/` وحدَه — D-945). فظهر اسمُ «Loopz» على بطاقات القوائم بخانةٍ فارغة (أحمد، ١٩ نوفمبر
 * ٢٠٢٦: «حساب لوبز هنا جاي بدون شعار»). والرمزُ نفسُه في الأصول أصلاً (`assets/loopz-mark.png`،
 * يقرؤه المجتمعُ والنقاشُ بـ`require`) — **فيُعاد إليه بالاسم، نسبيّاً كان المسارُ أو كاملاً.**
 */
const LOOPZ_MARK = require("../assets/loopz-mark.png");

export function avatarSource(uri: string | null | undefined): ImageSource | number | null {
  if (!uri) return null;
  if (/(^|\/)loopz-mark\.png(\?|#|$)/.test(uri)) return LOOPZ_MARK;
  return { uri };
}
