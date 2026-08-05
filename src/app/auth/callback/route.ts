import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth callback — exchanges the code for a session, then redirects home.
/**
 * وجهة داخلية فقط.
 * ترفض أي قيمة تبدأ بـ // أو تحتوي بروتوكولاً، حتى لا يتحوّل الرابط
 * إلى إعادة توجيه لموقع خارجي يبدو أنه صادر من مشاهد.
 */
function safeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.includes("\\")) return "/";
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return "/";
  return value;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // الوجهة من متغيّر بيئةٍ نتحكّم به لا من ترويسة x-forwarded-host:
      // الترويسات يكتبها العميل، وبناء إعادة التوجيه عليها يفتح باب
      // التوجيه لمضيفٍ يختاره المهاجم بعد نجاح الدخول مباشرةً
      const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? origin;
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
