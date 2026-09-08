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
  /** مسارٌ نسبيٌّ على نطاق Loopz (`/show/123`) — ما سواه يُهمل */
  open(path: string): boolean {
    if (!inject || !path.startsWith("/")) return false;
    inject(`location.href=${JSON.stringify(CONFIG.apiBase + path)};true;`);
    return true;
  },
};
