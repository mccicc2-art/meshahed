import { type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { handle, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * ====== `POST /api/v1/session/mint` — جلسةٌ مستقلّةٌ للتطبيق (Phase 11-K · K4b) ======
 *
 * **لماذا**: الجلسةُ اليومَ ملكُ الـWebView (D-922) والتطبيقُ يستعير رمزَ وصولها عبر جسر — والجسرُ
 * لا يُجاب والشاشاتُ الأصليّةُ فوقه (`react-native-screens` ينزع الويب، D-1144/D-1146). هنا يأخذ
 * التطبيقُ **جلسةً ثانيةً للمستخدم نفسِه برمزِ تجديدٍ من عائلةٍ منفصلة**، فيجدّدها بنفسه ولا يلمس
 * رمزَ الويب أبداً — عطلُ ٧ سبتمبر (عميلان يدوّران رمزاً واحداً، D-932) لا يعود بالتصميم.
 *
 * 🔑 **الطريقةُ** (قُرئت في مصدر Supabase Auth، ٢٧ سبتمبر): رابطُ دخولٍ يُولَّد بمفتاح الخدمة
 * (`admin/generate_link` — **لا بريدَ يُرسل**) ثمّ يُتحقَّق منه فوراً (`/verify`) في عميلٍ جديد ⇒
 * `issueRefreshToken` ⇒ صفٌّ جديدٌ في `auth.sessions`. **ولا يتوقّف على تفعيل الدخول بالبريد**:
 * ذلك الحارسُ في مسارات المستخدم (`/magiclink` · `/otp` · `/token`) وحدَها.
 *
 * 🔒 **الحرّاس**:
 * - الهويّةُ من `Authorization: Bearer` وحدَه، **يُتحقَّق منه عند Supabase** (`getUser`) — لا كوكي:
 *   كاشُ OkHttp يشارك كوكيَ الـWebView، ونريد ما سلّمه التطبيقُ صراحةً لا ما التصق بالطلب.
 * - **المستخدمُ المسكوكُ هو صاحبُ الرمز نفسُه**: المعرّفُ يُطابَق مرّتين (الرابط ثمّ الجلسة) — وإلّا
 *   لا شيء يعود. فرمزٌ صالحٌ لا يفتح إلّا حسابَ صاحبه.
 * - لا يُنشئ حساباً أبداً: بلا بريدٍ ⇒ `forbidden` (رابطُ الدخول لبريدٍ غيرِ موجودٍ يصير تسجيلاً).
 * - حدٌّ: ٦ في الساعة لكلِّ مستخدم — التطبيقُ يسكّ مرّةً لكلِّ تثبيتٍ أو بعد خروج.
 * - الردُّ `no-store` ولا يُسجَّل؛ والأخطاءُ بلا نصِّ Supabase.
 *
 * ⚖️ **أثرٌ جانبيٌّ واحدٌ مقصود**: سطرُ «دخول» في سجلّ تدقيق Supabase. ويُمسح رمزُ الاستعادة المؤقّت
 * في اللحظة نفسها (`user.Recover`). لا هويّةَ بريدٍ تُضاف للحساب.
 */
export const dynamic = "force-dynamic";

type Minted = { access_token: string; refresh_token: string; expires_at: number; user_id: string };

export async function POST(req: NextRequest) {
  return handle<Minted>(async () => {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (token.split(".").length !== 3) return fail("unauthenticated");

    const admin = await createServiceClient();
    const who = await admin.auth.getUser(token);
    const user = who.data.user;
    if (who.error || !user) return fail("unauthenticated");
    const rl = limited(`mint:${user.id}`, 6, 60 * 60_000);
    if (rl) return rl;
    if (!user.email) return fail("forbidden");

    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    const hash = link.data?.properties?.hashed_token;
    if (link.error || !hash || link.data.user?.id !== user.id) return fail("internal");

    const fresh = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const v = await fresh.auth.verifyOtp({ type: "magiclink", token_hash: hash });
    const s = v.data.session;
    if (v.error || !s || s.user.id !== user.id || !s.refresh_token || !s.expires_at) return fail("internal");

    return ok({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user_id: user.id }, []);
  });
}
