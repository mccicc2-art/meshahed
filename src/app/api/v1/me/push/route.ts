import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handle, limited, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { PUSH_CAPS, PUSH_TOKEN_RE, type PushRegisterBody } from "@/core/push";

/**
 * `POST /api/v1/me/push` — تسجيلُ جهازي لإشعارات الدفع (D-1305): `{token, platform?, lang?}`.
 *
 * التطبيقُ ينادي بعد أوّل دخولٍ يُسمح فيه بالإشعارات، ثمّ مرّةً في كلِّ إقلاع (اللغةُ قد تبدّلت، والرمزُ قد دُوِّر).
 * الكتابةُ بدالّة `register_push_token` (الهجرة ١٩٥): تُدرج الصفَّ أو تنقله إلى صاحب الجلسة — جهازٌ واحدٌ لحسابٍ واحد.
 * شكلُ الرمز يُحرس هنا وفي قيد الجدول (حارسان طبقتان).
 */
export async function POST(req: NextRequest) {
  return handle<{ registered: boolean }>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:push:${auth.user.id}`, 10, 60_000);
    if (lim) return lim;
    let b: Partial<PushRegisterBody> | null = null;
    try {
      b = (await req.json()) as Partial<PushRegisterBody>;
    } catch {
      return fail("invalid_input");
    }
    const token = typeof b?.token === "string" ? b.token.trim() : "";
    if (!PUSH_TOKEN_RE.test(token)) return fail("invalid_input", { field: "token" });
    const supabase = await createClient();
    const base = { p_token: token, p_platform: b?.platform === "ios" ? "ios" : "android", p_lang: b?.lang === "en" ? "en" : "ar" };
    /* 🆕 D-1408 — ما يقدر عليه الجهاز (`caps`، الهجرة ٢٠٤) يُكتب مع كلِّ تسجيل؛ قيمٌ مجهولةٌ تسقط هنا وفي قيد العمود.
       قبل الهجرة الدالّةُ ذاتُ الأربعة غائبة ⇒ القديمةُ كما كانت */
    const caps = Array.isArray(b?.caps) ? PUSH_CAPS.filter((c) => b.caps?.includes(c)) : [];
    let { error } = await supabase.rpc("register_push_token", { ...base, p_caps: caps });
    if (error) ({ error } = await supabase.rpc("register_push_token", base));
    /* قبل الهجرة ١٩٥ الدالّةُ غائبة: التطبيقُ يعيد المحاولةَ في الإقلاع التالي، ولا خطأَ يُعرض */
    if (error) return ok({ registered: false });
    return ok({ registered: true });
  });
}
