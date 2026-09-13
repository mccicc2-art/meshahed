import { CONFIG } from "./config";

/**
 * بابُ الشاشات الأصليّة إلى الـWebView (Phase 11 · B1): الشاشةُ الأصليّةُ لا
 * تملك متصفّحاً — حين تريد فتحَ عملٍ تطلب من الغلاف أن يوجّه الـWebView
 * **بحقن `location.href` لا بتبديل المصدر** (حجّةُ `flush` في `web.tsx`:
 * تبديلُ المصدر يُعيد التركيبَ ويفقد تاريخَ الرجوع).
 */
let inject: ((js: string) => void) | null = null;

export const shell = {
  attach(fn: ((js: string) => void) | null) {
    inject = fn;
  },
  /**
   * مسارٌ نسبيٌّ على نطاق Loopz (`/show/123`) — ما سواه يُهمل.
   *
   * 🆕 D-949 — **الرجوعُ يعود إلى المكتبة الأصليّة** (بلاغُ أحمد بتسجيل: «إذا
   * دخلت الإحصائيات وأرجع يودّيني للهوم»): الشاشةُ الأصليّة تُغلق عند فتح صفحةٍ
   * ويبيّة، **فتاريخُ الـWebView لا يعرفها** — والرجوعُ يهبط على ما قبلها
   * (الرئيسيّة). الحلُّ علامةٌ في `sessionStorage` تُقرأ عند وصول الصفحة
   * (`SessionBridge`): أوّلُ رجوعٍ يتجاوز صفحةَ الوصول يبثّ `native:library`
   * فيُعاد فتحُ الشاشة. **`sessionStorage` لا `history.state`** لأنّ
   * `location.href` تحميلُ مستندٍ جديد والحالةُ لا تعبره.
   */
  open(path: string, opts?: { returnTo?: "library" }): boolean {
    if (!inject || !path.startsWith("/")) return false;
    const arm = opts?.returnTo ? `try{sessionStorage.setItem("loopz:return",${JSON.stringify(opts.returnTo)})}catch(e){}` : "";
    inject(`${arm}location.href=${JSON.stringify(CONFIG.apiBase + path)};true;`);
    return true;
  },
};
