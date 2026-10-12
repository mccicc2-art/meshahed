/**
 * وجهةُ العودة بعد الدخول — **داخليّةٌ فقط** (🆕 D-1373: نُقلت من `auth/callback` كي تقرأها صفحةُ الدخول بالقاعدة نفسِها).
 * ترفض أيَّ قيمةٍ تبدأ بـ `//` أو تحمل بروتوكولاً أو شرطةً معكوسة، حتى لا يتحوّل الرابطُ إلى تحويلٍ لموقعٍ خارجيٍّ يبدو
 * صادراً من Loopz. وصفحتا الدخول والخروج ليستا وجهة: العودةُ إليهما حلقة.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.includes("\\")) return "/";
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return "/";
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/auth/")) return "/";
  return value;
}
