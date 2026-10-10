import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handle, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { PUSH_TOKEN_RE, type PushForgetBody } from "@/core/push";

/**
 * `POST /api/v1/app/push/forget` — نسيانُ جهازٍ عند الخروج (D-1305): `{token}`.
 *
 * 🔑 **بلا جلسة عمداً**: التطبيقُ يعرف الخروجَ بعد وقوعه (عنوانُ `/auth/signout` في الـWebView)، فلا رمزَ وصولٍ
 * يُرسَل معه. من يحمل رمزَ الدفع هو الجهازُ نفسُه — وأسوأُ ما يفعله غيرُه أن يوقف إشعاراتٍ تعود عند أوّل فتح.
 * وبدونه تبقى رسائلُ صاحب الحساب ترنّ على شاشةٍ خرج منها.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const lim = limited(`v1:app:push-forget:${ip}`, 10, 60_000);
    if (lim) return lim;
    let b: Partial<PushForgetBody> | null = null;
    try {
      b = (await req.json()) as Partial<PushForgetBody>;
    } catch {
      return fail("invalid_input");
    }
    const token = typeof b?.token === "string" ? b.token.trim() : "";
    if (!PUSH_TOKEN_RE.test(token)) return fail("invalid_input", { field: "token" });
    const supabase = await createClient();
    await supabase.rpc("forget_push_token", { p_token: token });
    return ok({ done: true as const });
    /* D-1341 — يحتاجه من لم يُتمّ الترحيب: لا يُسأل عن الختم */
  }, { open: true });
}
