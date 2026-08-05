import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed Middleware to Proxy.
// وظيفته الوحيدة هنا: تجديد كوكي جلسة Supabase قبل انتهائها.

/** ثوانٍ قبل انتهاء التوكن نبدأ عندها التجديد */
const REFRESH_WINDOW_SECONDS = 120;

/**
 * هل التوكن الحالي على وشك الانتهاء؟
 *
 * يفكّ حمولة الـJWT محلياً (بلا أي طلب شبكة) ليقرأ `exp` فقط.
 * هذا ليس تحققاً أمنياً — التحقق الحقيقي يبقى في `getUser()` على الخادم
 * وفي سياسات RLS. الغرض فقط: هل نحتاج نداء تجديد أم لا.
 * عند أي شك (تعذّر الفكّ، لا يوجد exp) نرجع true فنجدّد كالسابق.
 */
function needsRefresh(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false; // زائر غير مسجّل — لا شيء نجدّده

  try {
    // Supabase يخزّن الجلسة كـ JSON (أحياناً مسبوقة بـ base64-) داخل الكوكي
    let raw = cookieValue;
    if (raw.startsWith("base64-")) raw = atob(raw.slice(7));
    const session = JSON.parse(raw);

    const token: string | undefined = session?.access_token;
    if (!token) return true;

    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const exp: number | undefined = payload?.exp;
    if (!exp) return true;

    return exp - Math.floor(Date.now() / 1000) < REFRESH_WINDOW_SECONDS;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured yet (e.g. first deploy before env vars are set):
  // skip session refresh instead of throwing a 500 on every route.
  if (!url || !anonKey) return response;

  // كان هذا الوسيط يستدعي getUser() في كل طلب — رحلة شبكة كاملة لخادم
  // Supabase حتى على طلبات الـprefetch. الآن ننادي فقط عند اقتراب الانتهاء.
  // الكوكي قد تكون مقسّمة إلى أجزاء (‎auth-token.0 و .1) فنعيد تجميعها بالترتيب
  const parts = request.cookies
    .getAll()
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (parts.length === 0) return response; // زائر غير مسجّل
  if (!needsRefresh(parts.map((c) => c.value).join(""))) return response;

  const supabase = createServerClient(url, anonKey, {
    // نفس خيارات العميلين الآخرين: هذا هو المكان الذي يعيد كتابة كوكي
    // الجلسة فعلياً عند التجديد، وبدون secure هنا كانت الكوكي المجدَّدة
    // تخرج بلا الحماية التي يفرضها server.ts و client.ts
    cookieOptions: { sameSite: "lax", secure: true, path: "/" },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: refreshes the session cookie.
  try {
    await supabase.auth.getUser();
  } catch {
    // Ignore network/config errors so the app still renders.
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
