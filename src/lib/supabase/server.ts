import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/**
 * عميل Supabase للخادم.
 *
 * ملفوف بـ `cache()` من React: كل استدعاء داخل نفس الطلب يرجع نفس العميل
 * بدل إنشاء واحد جديد في كل دالة. شرط أساسي لكي ينفع تخزين `getUser`.
 *
 * 🆕 **بابان للهويّة، عميلٌ واحد** (Phase 9 §4.3 القاعدة ١): الويب يأتي
 * بكوكي، **والتطبيقُ يأتي بـ`Authorization: Bearer <token>`** لأنّ الجوّال
 * لا يحمل كوكيز. حين تحضر الترويسةُ يُبنى العميلُ بالرمز ومزوّدِ كوكيز
 * فارغ — **فتبقى RLS بهويّة المستخدم نفسِه، ولا مفتاحَ `service_role`
 * في التطبيق ولا في الـAPI.** وثمرةُ هذا أنّ **١٢١ قارئاً و١٦٤ كاتباً في
 * `data.ts`/`actions.ts` تعمل للتطبيق بلا تغييرِ سطرٍ واحدٍ فيها** — كلُّها
 * تستدعي `createClient()` هذا ولا تعرف من أين جاءت الهويّة.
 *
 * ⚠️ **والتجديدُ على الجهاز لا هنا**: الخادمُ لا يضع كوكيز للتطبيق أبداً
 * (`setAll` لا يُستدعى لأنّ لا كوكي)، ورمزٌ منتهٍ يُرفض عند RLS كما يُرفض
 * أيُّ رمزٍ منتهٍ — **فلا مسارَ ثانٍ للصلاحيّات يُفتح بهذا الباب.**
 */
export const createClient = cache(async () => {
  const bearer = await bearerToken();
  if (bearer) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            /* لا كوكيز للتطبيق — الجلسةُ تعيش في SecureStore على الجهاز */
          },
        },
      },
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // كوكيز الجلسة بخيارات صريحة لا افتراضات المكتبة:
      // lax يمنع إرسالها مع طلبات مواقع أخرى، وsecure يمنعها عن HTTP
      cookieOptions: { sameSite: "lax", secure: true, path: "/" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when proxy refreshes sessions.
          }
        },
      },
    },
  );
});

/**
 * رمزُ الوصول من ترويسة `Authorization` إن وُجد — وإلا `null`.
 * يُقرأ مرّةً في الطلب (`cache`) لأنّ `headers()` رحلةٌ إلى سياق الطلب
 * لا تُكرَّر في كلِّ قارئ.
 */
export const bearerToken = cache(async (): Promise<string | null> => {
  try {
    const h = await headers();
    const auth = h.get("authorization") ?? h.get("Authorization");
    if (!auth) return null;
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    const token = m?.[1]?.trim();
    // JWT ثلاثةُ مقاطع — ما سواه ليس رمزَ Supabase ويُتجاهل بلا رحلة
    return token && token.split(".").length === 3 ? token : null;
  } catch {
    return null;
  }
});
