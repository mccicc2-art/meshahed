import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  decodeSessionCookie,
  ownerHash,
  sessionCookieParts,
} from "@/lib/sessionCookie";

/**
 * ترويسةُ «مالك الردّ» — تسميةُ تقسيمٍ لكاش الصفحات في الـsw (D-514).
 *
 * الـService Worker يخزّن HTML شخصيّاً لاحتياط الانقطاع والشبكة
 * الزاحفة، ولا يستطيع قراءة الكوكي ليعرف صاحبَه. فالخادم يسمّي كلَّ
 * ردٍّ ببصمة SHA-256 كاملةٍ من `sub` (أو `anon` للزائر، و`opaque`
 * لكوكي موجودٍ لا يُفكّ) — والـsw يمسح كاشَ الصفحات كلَّه أوّلَ ما
 * يرى التسميةَ تتغيّر. ⚖️ **كانت بادئةَ ثمانية أحرف وصارت بصمةً
 * كاملة** (تشديدُ أحمد): لا احتمالَ تصادمٍ ولو نظريّاً، ولا معرّفَ
 * خامًا في الترويسة. **تسميةٌ لا سرٌّ ولا صلاحية**: تُرى فقط في
 * متصفّح صاحبها، وقيمةٌ مزوَّرة أسوأُ ما تفعله مسحُ كاشِ جهازها
 * نفسِه. والحسابُ محليٌّ خالص — لا `getUser()` ولا رحلةَ شبكةٍ هنا.
 */
const OWNER_HEADER = "x-lz-owner";

/**
 * 🆕 **وبصمةُ البناء على كلِّ ردٍّ كذلك** (D-652).
 *
 * 🔴 **والعلّةُ التي فتحتها**: كاشُ صفحات الـsw اسمُه ثابتٌ بيدٍ
 * (`loopz-v8-pages`) **فيعيش عبر النشرات كلِّها** — **وصفحةُ HTML من
 * نشرةِ أمس تُقلع راوترَ Next ببصمةِ أمس**، فأوّلُ تنقّلٍ يطلب حمولةَ
 * RSC ببناءٍ لم يعد موجوداً **فتسقط الشاشةُ إلى حدِّ الخطأ** — وهو
 * بعينه ما وُصف في D-626 وعاد اليوم بعد ثماني نشرات.
 *
 * 🔑 **والحزامُ حزامُ المالك نفسُه بقارئٍ ثانٍ** (D-514/D-145): تسميةٌ
 * على الردّ، وأوّلُ ردٍّ يخالف المحفوظَ يمسح كاشَ الصفحات قبل أن
 * يُكتب فيه سطر — **ولا آليّةَ ثانيةٌ تُخترع لفكرةٍ قائمة.**
 *
 * ⚠️ **وليست سرّاً**: بصمةُ التزام مستودعٍ عامّ، **وأسوأُ ما تفعله
 * قيمةٌ مزوَّرةٌ مسحُ كاشِ جهازِ صاحبها.**
 */
const BUILD_HEADER = "x-lz-build";
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

async function ownerLabel(request: NextRequest): Promise<string> {
  try {
    const parts = sessionCookieParts(request.cookies.getAll());
    if (parts.length === 0) return "anon";
    const claims = decodeSessionCookie(parts);
    // كوكي موجودٌ لا يُفكّ: تسميةٌ خاصةٌ به — تخالف أيَّ sub سابقٍ
    // فتمسح، وهي الجهة الآمنة من الخطأ
    return claims ? await ownerHash(claims.sub) : "opaque";
  } catch {
    return "opaque";
  }
}

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
  /* تسميةُ المالك على كلِّ ردٍّ يمرّ بالوسيط — انظر D-514 أعلاه.
     تُكتب هنا وعلى نسخة الردّ التي قد يعيد التجديدُ إنشاءها أدناه. */
  const owner = await ownerLabel(request);
  response.headers.set(OWNER_HEADER, owner);
  response.headers.set(BUILD_HEADER, BUILD_ID);

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
        // الردُّ أُعيد إنشاؤه — التسميتان تُعادان معه وإلا سقطتا عن ردود التجديد
        response.headers.set(OWNER_HEADER, owner);
        response.headers.set(BUILD_HEADER, BUILD_ID);
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
    /* `api/v1` مستثنًى: طلباتُ التطبيق تحمل `Bearer` لا كوكي، فلا جلسةَ
       هنا تُجدَّد — ورحلةُ `getUser` عليها هدرٌ محض (Phase 9 §4.3) */
    "/((?!_next/static|_next/image|favicon.ico|api/v1|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
