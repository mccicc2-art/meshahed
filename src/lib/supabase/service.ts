import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";

/**
 * ====== عميلُ الخدمة (service_role) — للخادم وحده (D-898 · `LOOPZ-AUD-0040`) ======
 *
 * **لماذا**: سبعُ دوالِّ كتابةٍ مجمَّعة في القاعدة (تقييماتُ IMDb، حوضُ
 * الجدول وبناؤه، الأخبارُ واللقطاتُ والنشرات) وأربعُ دوالِّ قياسٍ كانت
 * ممنوحةً لـ`anon`/`authenticated` **لأنّ الخادمَ يناديها بمفتاح الجلسة
 * نفسِه الذي يحمله المتصفّح** — فأيُّ حاملِ مفتاحٍ عامٍّ يستطيع نداءَها
 * مباشرةً من PostgREST متجاوزاً حواجزَ المسارات. **هذا العميلُ ينقل البابَ
 * من «أيّ حامل anon» إلى «الخادم فقط»**، وبعده يُسحب منحُ EXECUTE عن
 * الدورين (المجموعة B في جرد `0040`).
 *
 * **الارتدادُ شرطُ النشر الآمن**: ما دام `SUPABASE_SERVICE_ROLE_KEY` غائباً
 * من البيئة يرجع عميلُ الجلسة الحاليّ — **فالسلوكُ مطابقٌ لليوم حرفيّاً**،
 * ولا تُسحب المنحُ في القاعدة إلا **بعد** أن يضع المالكُ المتغيّرَ ويتحقّق
 * من أثر الكتابة. الترتيبُ ثابت: نشر ⇢ متغيّر ⇢ REVOKE.
 *
 * 🔒 **السياج**: استيرادُ هذا الملفّ مقيَّدٌ بـESLint إلى مواضع الكتابة
 * العشرة (`eslint.config.mjs`) — تسرّبُه إلى مكوّنٍ أو ملفٍّ مشترك خطأٌ
 * يوقف البناء. والمفتاحُ يُقرأ هنا وحدَه (+ `instrumentation.ts` بـfetch
 * خامّ)؛ **لا جلسةَ ولا كوكي**: `persistSession: false` لأنّ العميلَ
 * مفردٌ على مستوى الوحدة يعيش عبر الطلبات، ولا يجوز أن يلتقط جلسةَ أحد.
 */
let service: SupabaseClient | null = null;

export async function createServiceClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return createClient();

  service ??= createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return service;
}
