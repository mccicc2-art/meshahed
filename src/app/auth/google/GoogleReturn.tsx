"use client";

import { useEffect, useRef, useState } from "react";
import { getDict, type Locale } from "@/core/i18n";
import { GOOGLE_STASH_KEY, parseGoogleReturn, takeStash } from "@/core/googleRedirect";
import { safeNext } from "@/lib/safeNext";
import { createClient } from "@/lib/supabase/client";
import { absorbGuestContentPrefs, claimReferralFromCookie } from "@/lib/actions";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/Button";

/**
 * 🆕 T538 — يستلم رمزَ Google من جزء `#`، يتحقّق أنّه ردٌّ على طلبٍ بدأ من هذا التبويب (`state`)، ويسلّمه لـSupabase بالـ`nonce`
 * الخام — الخطوةُ نفسُها التي تفعلها نافذةُ GIS على الحاسوب. ثمّ ما يفعله `auth/callback` بعد الدخول (تفضيلاتُ الزائر ونسبةُ
 * الدعوة — سقوطُهما لا يُسقط الدخول)، ثمّ تحميلٌ كاملٌ للوجهة كي يقرأ الخادمُ الجلسةَ الجديدة في كلِّ شيء.
 *
 * والفشلُ لا يحبس أحداً: سطرُ الخطأ وزرُّ العودة إلى شاشة الدخول، وفيها البابُ القديمُ بعد أوّل فشل كما كان.
 */
export function GoogleReturn({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState("/");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const back = parseGoogleReturn(window.location.hash);
    /* الرمزُ لا يبقى في العنوان: لا في السجلّ ولا في زرّ «رجوع» ولا في لقطة شاشة */
    window.history.replaceState(null, "", window.location.pathname);
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(GOOGLE_STASH_KEY);
      window.sessionStorage.removeItem(GOOGLE_STASH_KEY);
    } catch {
      /* تخزينٌ محجوب — يسقط إلى الخطأ أدناه */
    }
    const stash = takeStash(raw, back.state);
    const to = safeNext(stash?.next);
    setNext(to);

    /* ألغى الاختيارَ في Google: عودةٌ هادئةٌ إلى شاشة الدخول، لا رسالةَ خطأ */
    if (back.error === "access_denied") {
      window.location.replace(`/login${to !== "/" ? `?next=${encodeURIComponent(to)}` : ""}`);
      return;
    }
    if (!back.idToken || !stash) {
      console.warn("[google-return]", back.error ?? "state");
      setError(back.error ?? "state");
      return;
    }

    void (async () => {
      try {
        const supabase = await createClient();
        const { error: e } = await supabase.auth.signInWithIdToken({ provider: "google", token: back.idToken!, nonce: stash.nonce });
        if (e) throw e;
        await absorbGuestContentPrefs().catch(() => {});
        await claimReferralFromCookie().catch(() => {});
        window.location.replace(to);
      } catch (e) {
        console.warn("[google-return]", (e as Error).message);
        setError((e as Error).message || "auth");
      }
    })();
  }, []);

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <>
            {/* رسالةٌ للعضو لا رمزُ خطأٍ داخليّ (مراجعةُ الوكيل، البند ١٠) — والسببُ في وحدة التحكّم لمن يفحص */}
            <Alert tone="error">{t.loginFailed.replace(/[:：]\s*$/, "")}</Alert>
            <a
              href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
              className={buttonClass({ variant: "primary", size: "md", full: true, className: "mt-4 h-11 justify-center" })}
            >
              {t.loginContinueGoogle}
            </a>
            {/* البابُ القديمُ (عودةٌ عبر Supabase) لمن فشل هذا الطريقُ عنده — `door=old` يقرؤه `GoogleButton` */}
            <a
              href={`/login?door=old${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`}
              className="mt-3 block w-full text-12 text-muted/60 hover:text-muted transition"
            >
              {t.loginOtherWay}
            </a>
          </>
        ) : (
          <p className="text-15 text-muted" aria-live="polite">
            {t.loginRedirecting}
          </p>
        )}
      </div>
    </main>
  );
}
