/**
 * عنوان الموقع الرسمي — ثابتٌ واحد لكل رابطٍ يخرج من التطبيق.
 *
 * الشكوى: من ثبّت التطبيق أيام meshahed.vercel.app بقيت روابط مشاركته
 * تحمل ذلك النطاق، لأنها كانت تُبنى من `window.location.origin`. الرابط
 * الذي يغادر التطبيق هوية علامة (D-039) لا انعكاس نافذة: يُبنى من هذا
 * الثابت دائماً، فيقرأ المستلم loopztv.com أياً كان نطاق المرسل.
 */
export const SITE_URL = "https://loopztv.com";

/** رابطٌ مطلق على النطاق الرسمي من مسارٍ داخلي */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
