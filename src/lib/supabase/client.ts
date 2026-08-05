import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // نفس خيارات الخادم — الكوكي واحد فلا يجوز أن تختلف صفاته بحسب
      // من كتبه (انظر supabase/server.ts)
      cookieOptions: { sameSite: "lax", secure: true, path: "/" },
    },
  );
}
