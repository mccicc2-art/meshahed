import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isLoopzApp } from "@/core/platform";
import { PROBE_COOKIE, PROBE_SECONDS, cookieShape, logProbe } from "@/lib/authProbe";

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
  /* 🧪 D-1157 — شكلُ الكوكيات قبل الخروج وبعده: هل تُحذف أجزاءُ الجلسة كلُّها؟ (داخل الغلاف وحدَه، مؤقّت) */
  const app = isLoopzApp(request.headers.get("user-agent"));
  const store = await cookies();
  const before = app ? cookieShape(store.getAll()) : "";
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  if (app) {
    await logProbe("signout", `before=${before} after=${cookieShape(store.getAll())} origin=${origin ?? "absent"}`);
    res.cookies.set(PROBE_COOKIE, "1", { maxAge: PROBE_SECONDS, path: "/", sameSite: "lax", secure: true });
  }
  return res;
}
