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
      /* 🆕 **تفضيلاتُ الزائر تُدمج هنا لا في أوّل صفحة** (D-545):
         **قبل أن يرى شاشةً واحدة** — فلا يلمح توصياتٍ بلا تفضيلاته ثمّ
         تتبدّل تحت عينه. **وسقوطُها لا يُسقط الدخول**، والكوكي يبقى
         فتُعاد المحاولةُ في الدخول التالي. */
      const { absorbGuestContentPrefs } = await import("@/lib/actions");
      await absorbGuestContentPrefs().catch(() => {});

      /* 🔴 **والعودةُ إلى الأصل الذي جرى عليه التبادل** (D-623): الكوكيز
         كُتبت على هذا الأصل للتوّ، **وتحويلُه قسراً إلى نطاقٍ آخر يترك
         الجلسةَ خلفه** — وهو عينُ ما كان يُخرج تطبيقَ مشعل المثبَّت من
         الأصل القديم في كلِّ فتح. **وحجّةُ الأمن القديمة باقيةٌ بحرفها**
         (لا بناءَ على ترويسات العميل): `origin` هنا أصلُ الخدمة نفسِها،
         ويُقبل **فقط** إن كان في قائمة `TRUSTED_ORIGINS` المغلقة —
         وإلا فالنطاقُ القانونيُّ من متغيّر البيئة كما كان. */
      const { resolveAuthBase } = await import("@/lib/siteOrigin");
      return NextResponse.redirect(`${resolveAuthBase(origin)}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
