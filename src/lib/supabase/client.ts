import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * عميل المتصفّح — يُحمَّل عند أول حاجةٍ لا مع الصفحة.
 *
 * كان الاستيراد الساكن هنا يسحب supabase-js كاملةً (~٢٤٥ ك.ب، أكبر كتلة
 * جافاسكربت في التطبيق) إلى التحميل الأول لكل صفحة، بينما لا يحتاجها
 * المتصفّح إلا في ثلاث لحظاتٍ كلها بعد الرسم: ضغطة «دخول بجوجل»، ورفع
 * صورة في الملف، وربط طابور الأوفلاين بعد الإقلاع. الاستيراد الديناميكي
 * يخرجها من المسار الحرج ويبقيها كتلةً تصل عند طلبها — والوعد يُذكَّر
 * (memoized) فالنداء الثاني لا يدفع شيئاً.
 *
 * الدالة صارت لا-متزامنة، وهذا مقصود لا عرَض: كل مستدعيها كان أصلاً في
 * سياقٍ لا-متزامن (معالجُ ضغطةٍ أو مؤثّر)، فلم يتغيّر سلوكٌ ولا ترتيب.
 */
let clientPromise: Promise<SupabaseClient> | null = null;

export function createClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import("@supabase/ssr").then(({ createBrowserClient }) =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          // نفس خيارات الخادم — الكوكي واحد فلا يجوز أن تختلف صفاته بحسب
          // من كتبه (انظر supabase/server.ts)
          cookieOptions: { sameSite: "lax", secure: true, path: "/" },
        },
      ),
    );
  }
  return clientPromise;
}
