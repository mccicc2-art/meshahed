import { NextResponse, after, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { keepAppleToken } from "@/lib/apple";
import { safeNext } from "@/lib/safeNext";
import { APPLE_COOKIE, APPLE_HOME_ORIGIN, APPLE_RETURN_PATH, APPLE_WEB_CLIENT_ID, appleNameOf, appleOriginFor, readApplePending } from "@/core/appleRedirect";

/**
 * 🆕 T538 — أبل تعيد هنا نموذجاً (`form_post`) فيه `state` و`id_token` و`code` — و`user` (الاسم) في أوّل دخولٍ وحده.
 *
 * الترتيب: `state` يطابق الكوكي (وإلّا فليس ردّاً على طلبٍ بدأ من هذا المتصفّح) ⇐ الرمزُ إلى Supabase بالـ`nonce` الخام ⇐
 * الاسمُ إن كان الملفُّ ما زال على اسمه الافتراضيّ (كما يفعل التطبيق، D-1350) ⇐ رمزُ التفويض يُبدَّل برمز تجديدٍ يُلغى به الإذنُ
 * عند حذف الحساب (`lib/apple.ts`). فشلُ الاسم أو الرمز لا يُفشل الدخول.
 *
 * 🔑 **ثمّ `303` إلى `/auth/apple/done` لا إلى الوجهة**: النموذجُ القادمُ من موقعٍ آخر لا يحمل كوكيز `Lax` — تفضيلاتُ الزائر
 * وكوكي الدعوة غائبان هنا — والتحويلُ بـ`GET` يعيدها، فيُكمل `done` ما يفعله `auth/callback` بعد الدخول.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const home = appleOriginFor(new URL(req.url).origin) ?? APPLE_HOME_ORIGIN;
  const pending = readApplePending(req.cookies.get(APPLE_COOKIE)?.value);
  const next = safeNext(pending?.next);
  const form = await req.formData().catch(() => null);
  const field = (k: string) => {
    const v = form?.get(k);
    return typeof v === "string" ? v : "";
  };

  const go = (to: string) => {
    const res = NextResponse.redirect(`${home}${to}`, 303);
    res.cookies.set(APPLE_COOKIE, "", { httpOnly: true, secure: true, sameSite: "none", path: APPLE_RETURN_PATH, maxAge: 0 });
    res.headers.set("cache-control", "no-store");
    return res;
  };
  const back = (err: boolean) => go(`/login?${err ? "error=auth&" : ""}next=${encodeURIComponent(next)}`);

  /* ألغى في ورقة أبل ⇐ عودةٌ هادئةٌ إلى شاشة الدخول */
  if (field("error")) return back(field("error") !== "user_cancelled_authorize");
  const idToken = field("id_token");
  if (!pending || !idToken || field("state") !== pending.s) return back(true);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: idToken, nonce: pending.n });
  if (error || !data.user) {
    console.warn("[apple-web] sign-in refused", error?.code ?? "no-user");
    return back(true);
  }
  const user = data.user;

  const name = appleNameOf(field("user"));
  if (name) {
    try {
      const { data: p } = await supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle();
      const fallback = (user.email ?? "").split("@")[0];
      const nick = (p as { nickname?: string | null } | null)?.nickname ?? "";
      if (!nick || nick === fallback) await supabase.from("profiles").update({ nickname: name }).eq("id", user.id);
    } catch {
      /* الاسمُ لا يُفشل الدخول */
    }
  }

  const apple = (user.identities ?? []).find((i) => i.provider === "apple");
  const sub = typeof apple?.identity_data?.sub === "string" ? apple.identity_data.sub : apple?.id;
  const code = field("code");
  if (sub && code && code.length <= 2048) {
    /* بعد الردّ لا قبله (`after`): أبل قد تأخذ ثواني، والعضوُ لا ينتظرها على صفحةٍ بيضاء — والرمزُ صالحٌ خمسَ دقائق */
    after(async () => {
      const kept = await keepAppleToken(user.id, sub, code, APPLE_WEB_CLIENT_ID, `${home}${APPLE_RETURN_PATH}`);
      if (kept !== "stored") console.warn(`[apple-web] token ${kept}`);
    });
  }

  return go(`${APPLE_RETURN_PATH}/done?next=${encodeURIComponent(next)}`);
}
