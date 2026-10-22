/**
 * وجهةُ العودة بعد الدخول — **داخليّةٌ فقط** (🆕 D-1373: نُقلت من `auth/callback` كي تقرأها صفحةُ الدخول بالقاعدة نفسِها).
 * ترفض أيَّ قيمةٍ تبدأ بـ `//` أو تحمل بروتوكولاً أو شرطةً معكوسة، حتى لا يتحوّل الرابطُ إلى تحويلٍ لموقعٍ خارجيٍّ يبدو
 * صادراً من Loopz. وصفحتا الدخول والخروج ليستا وجهة: العودةُ إليهما حلقة.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.includes("\\")) return "/";
  /* 🔴 A-06 (المدقّق ٢١ أكتوبر) — **ولا محارفَ تحكّم**: المتصفّحُ يحذف الجدولةَ والسطرَ الجديد من الرابط، فـ`/\t/evil.com`
     يصير `//evil.com` بعد أن عبرت فحصَ الشرطتين أعلاه */
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return "/";
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/auth/")) return "/";
  return value;
}
