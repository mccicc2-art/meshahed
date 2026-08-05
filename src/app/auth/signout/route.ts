import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // حماية CSRF: هذا مسارٌ عادي لا Server Action، فلا يأخذ فحص الأصل
  // التلقائي — نموذجٌ خارجي يُرسَل تلقائياً كان يقدر يسجّل خروجك.
  // نقبل الطلب فقط إذا جاء من نطاقنا نفسه.
  const origin = request.headers.get("origin");
  const self = new URL(request.url).origin;
  if (origin && origin !== self) {
    return NextResponse.redirect(new URL("/", request.url), { status: 302 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
}
