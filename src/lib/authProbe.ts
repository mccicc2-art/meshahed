/**
 * 🧪 D-1157 — **مِجسُّ كوكي الجلسة حول الدخول والخروج** (قياسٌ مؤقّت، يُزال بعد القراءة).
 *
 * **لماذا**: بعد D-1156 يصل تسليمُ الدخول إلى الخادم وينجح (`setSession` ⇒ `/user` 200)، ثمّ تُرسم `/`
 * التي تليه **زائراً بلا أيّ نداء `/user`** — في المحاولة الأولى بعد خروجٍ كامل فقط؛ والثانيةُ تنجح. الشكُّ:
 * أجزاءُ كوكي قديمة (`auth-token.0/.1`) تبقى بعد الخروج أو تختلط بالجديد، فيُجمَع نصٌّ تالف ولا يُقرأ.
 * المِجسُّ يسجّل **شكلَ** الكوكيات لا محتواها: الاسمُ بلا مرجع المشروع، والطولُ، وهل يُقرأ المجموعُ
 * جلسةً، وعمرُ رمزها بالثواني. ⚖️ **لا قيمةَ ولا رمزَ ولا هويّةَ** — ولا يعمل إلّا داخل الغلاف، وفي الصفحات
 * إلّا لستّين ثانية بعد تسليمٍ أو خروج (كوكي `lz_probe`)، فلا يكتب صفّاً في كلِّ فتحٍ للتطبيق.
 */
import { createServiceClient } from "@/lib/supabase/service";

export const PROBE_COOKIE = "lz_probe";
export const PROBE_SECONDS = 60;

type C = { name: string; value: string };

const REF = /^sb-[a-z0-9]+-/;

/** «auth-token.0(3180),auth-token.1(420)» — الأسماءُ مرتّبةً بلا مرجع المشروع، والأطوالُ فقط */
export function cookieShape(list: C[]): string {
  const sb = list.filter((c) => c.name.startsWith("sb-")).sort((a, b) => a.name.localeCompare(b.name));
  if (sb.length === 0) return "none";
  return sb.map((c) => `${c.name.replace(REF, "")}(${c.value.length})`).join(",");
}

function b64(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(t + "=".repeat((4 - (t.length % 4)) % 4));
}

/** هل تُقرأ أجزاءُ `auth-token` جلسةً إذا جُمعت كما يجمعها الوسيط؟ ومع العمر: `ok age=12s` · `bad` · `none` */
export function sessionRead(list: C[]): string {
  const parts = list
    .filter((c) => c.name.startsWith("sb-") && /auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (parts.length === 0) return "none";
  try {
    let raw = parts.map((c) => c.value).join("");
    if (raw.startsWith("base64-")) raw = b64(raw.slice(7));
    const s = JSON.parse(raw) as { access_token?: string };
    const payload = JSON.parse(b64(String(s.access_token ?? "").split(".")[1] ?? "")) as { iat?: number };
    const age = typeof payload.iat === "number" ? Math.round(Date.now() / 1000 - payload.iat) : -1;
    return `ok age=${age}s`;
  } catch {
    return "bad";
  }
}

/** يكتب صفّاً في `runtime_errors` بنوع `AuthProbe` عبر عميل الخدمة (سياجُ D-898: الملفُّ مُدرَجٌ عمداً) — والفشلُ صامت */
export async function logProbe(step: string, message: string): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase.rpc("log_runtime_error", {
      p_route: `/auth-probe#${step}`,
      p_digest: step,
      p_kind: "AuthProbe",
      p_message: message.slice(0, 900),
    });
  } catch {
    /* لا شيء */
  }
}
