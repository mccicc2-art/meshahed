import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLoopzApp } from "@/core/platform";
import { BootHop } from "@/components/BootHop";

/**
 * `/app/boot` — **صفحةُ الإقلاع الخفيفة للغلاف** (D-1090).
 *
 * **لماذا**: الإقلاعُ الأصليّ (D-1075) يرفع الرئيسيّةَ الأصليّةَ فوق الـWebView ثمّ ينتظر
 * منها رمزَ الوصول — والـWebView كانت تحمّل `/` كاملةً (رئيسيّةَ الويب بكلِّ بياناتها) قبل
 * أن يُعلَّق `SessionBridge` ويجيب؛ ~٩ ثوانٍ دوّامة (تسجيلُ أحمد على 1.11.9). هذه الصفحةُ لا
 * تجلب شيئاً: التخطيطُ وحدَه (وفيه الجسر) فيصل `bridge:ready` في جزءٍ من ثانية.
 *
 * 🔑 **ملكيّةُ الجلسة لم تتغيّر** (D-922/D-932): الصفحةُ ما زالت مصدرَ الرمز الوحيد؛ ما تغيّر
 * أيُّ صفحةٍ تُسأل أوّلاً. وبعد أوّل ردٍّ (رمزٌ أو `session:clear`) يُبدّل الغلافُ عنوانَها إلى
 * `/` بـ`location.replace` — فيبقى تاريخُ الـWebView وسلوكُ الرجوع كما كانا حرفاً.
 *
 * ⚖️ **بلا كوكي ⇒ `/` فوراً**: الزائرُ يرى الدخولَ كما كان (D-122)؛ والمتصفّحُ العاديّ لا شأنَ
 * له بهذه الصفحة فيُحوَّل هو الآخر. ⚖️ **وحزامٌ ثانٍ داخل الصفحة**: إن لم يبدّلها الغلافُ في
 * ستّ ثوانٍ (رسالةٌ ضاعت) تبدّل نفسَها — فلا تبقى الـWebView على صفحةٍ سوداء أبداً.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function BootPage() {
  const cookieStore = await cookies();
  const signedIn = cookieStore.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!signedIn || !isLoopzApp((await headers()).get("user-agent"))) redirect("/");
  return (
    <main id="main" aria-hidden="true" className="min-h-dvh bg-background">
      <BootHop />
    </main>
  );
}
