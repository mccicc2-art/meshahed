import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isLoopzApp } from "@/core/platform";

/**
 * `POST /api/v1/session/handoff` — تسليمُ جلسة التطبيق إلى الـWebView (D-922).
 *
 * 🔴 **العلّة**: Google يمنع OAuth داخل WebView (`disallowed_useragent`)،
 * فالدخولُ يبقى أصليّاً (PKCE بمتصفّح النظام) **ثمّ تُسلَّم الجلسةُ**: الغلافُ
 * يرسل الرمزين في جسم POST (لا في عنوان URL — السجلّاتُ تحفظ العناوين)،
 * والخادمُ يبني الكوكيَ نفسَه الذي يبنيه للويب ويعيد توجيهاً إلى الرئيسية.
 *
 * 🔑 **لا مسارَ ثانٍ للصلاحيّات**: `setSession` يتحقّق من الرمز عند Supabase
 * كما تتحقّق أيُّ جلسة — رمزٌ معبوثٌ يعود `/login`. والكوكي بخيارات
 * `server.ts` نفسِها (`lax` · `secure`).
 *
 * ⚠️ **البابُ للغلاف وحدَه** (وسمُ `LoopzApp/`): متصفّحٌ عاديٌّ لا حاجةَ له
 * بهذا الباب، وإغلاقُه عن غيره يقطع صنفاً كاملاً من العبث.
 *
 * ⚠️ **ورمزُ التجديد ملكُ الـWebView بعد التسليم**: Supabase يدوّر رموزَ
 * التجديد، وعميلان يتقاسمان رمزاً واحداً يُسقط أحدُهما الآخر — فالغلافُ
 * يمسح جلستَه محلّيّاً بعد التسليم ولا يجدّد شيئاً (`apps/mobile/app/web.tsx`).
 */
export async function POST(req: NextRequest) {
  const home = new URL("/", req.url);
  const login = new URL("/login?handoff=failed", req.url);
  if (!isLoopzApp(req.headers.get("user-agent"))) {
    return NextResponse.redirect(home, { status: 303 });
  }
  let access = "";
  let refresh = "";
  try {
    const form = await req.formData();
    access = String(form.get("access_token") ?? "");
    refresh = String(form.get("refresh_token") ?? "");
  } catch {
    return NextResponse.redirect(login, { status: 303 });
  }
  if (access.split(".").length !== 3 || !refresh) {
    return NextResponse.redirect(login, { status: 303 });
  }

  const res = NextResponse.redirect(home, { status: 303 });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { sameSite: "lax", secure: true, path: "/" },
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );
  const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
  if (error) return NextResponse.redirect(login, { status: 303 });
  return res;
}
