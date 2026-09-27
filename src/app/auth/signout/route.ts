import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLoopzApp } from "@/core/platform";

export async function POST(request: Request) {
  // حماية CSRF: هذا مسارٌ عادي لا Server Action، فلا يأخذ فحص الأصل
  // التلقائي — نموذجٌ خارجي يُرسَل تلقائياً كان يقدر يسجّل خروجك.
  // نقبل الطلب فقط إذا جاء من نطاقنا نفسه.
  const origin = request.headers.get("origin");
  const self = new URL(request.url).origin;
  /* 🆕 D-1156 — غلافُ التطبيق يرسل الخروجَ تنقّلاً أصليّاً (`WebView.postUrl`) لا نموذجاً من الصفحة، وتنقّلٌ
     بلا صفحةٍ بادئة يحمل `Origin: null` في Chromium. يُقبل `null` من الغلاف وحدَه (وسمُ `LoopzApp/`): متصفّحُ
     الضحيّة لا يحمل الوسم، والغلافُ لا يفتح في داخله موقعاً غيرَ نطاقنا (`onShouldStartLoadWithRequest`). */
  const appNull = origin === "null" && isLoopzApp(request.headers.get("user-agent"));
  if (origin && origin !== self && !appNull) {
    return NextResponse.redirect(new URL("/", request.url), { status: 302 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
}
