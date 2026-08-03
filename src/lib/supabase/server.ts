import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * عميل Supabase للخادم.
 *
 * ملفوف بـ `cache()` من React: كل استدعاء داخل نفس الطلب يرجع نفس العميل
 * بدل إنشاء واحد جديد في كل دالة. شرط أساسي لكي ينفع تخزين `getUser`.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
