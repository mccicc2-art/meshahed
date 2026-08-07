"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * الدخول بحساب Google.
 *
 * طريقتان في مكوّنٍ واحد، والاختيار بينهما بوجود مُعرّف العميل:
 *
 *  1. **داخل الموقع** (Google Identity Services) حين يكون
 *     `NEXT_PUBLIC_GOOGLE_CLIENT_ID` مضبوطاً. المستخدم لا يغادر
 *     `loopztv.com` إطلاقاً: تفتح Google نافذتها الخاصة، وتعيد إلينا رمزاً
 *     نُسلّمه لـSupabase مباشرةً. السبب ليس السرعة وحدها: شاشة موافقة
 *     Google تطبع صاحبَ عنوان العودة، وعنوان العودة في الطريقة القديمة
 *     ملكُ Supabase — فكانت تُطبع `<ref>.supabase.co` بدل اسم المنتج مهما
 *     كتبنا في إعدادات Google. هنا لا عنوان عودة أصلاً، فتُنسب الشاشة إلى
 *     نطاق الموقع نفسه.
 *
 *  2. **التحويل القديم** (`signInWithOAuth`) حين لا يكون المعرّف مضبوطاً،
 *     أو حين تفشل مكتبة Google في التحميل (حاجب إعلانات، شبكة تحجب
 *     accounts.google.com). يبقى موجوداً عمداً: باب الدخول لا يجوز أن
 *     يكون له مفتاحٌ واحد.
 *
 * و`nonce` ليس زينة: Google توقّع الرمز على بصمته، وSupabase تتحقّق أن
 * الرمز مطلوبٌ من هذه الجلسة لا مُلتقَطٌ من جلسةٍ أخرى.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GSI_SRC = "https://accounts.google.com/gsi/client";

type CredentialResponse = { credential?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/** بصمتان لرقمٍ عشوائي: المُعمّاة تذهب لـGoogle والخام تبقى معنا */
async function makeNonce(): Promise<[raw: string, hashed: string]> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [raw, hashed];
}

export function GoogleButton({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  /** الطريقة القديمة — تبقى بابَ الاحتياط */
  const redirectSignIn = useCallback(async () => {
    setLoading(true);
    // العميل يُجلب عند الضغطة — انظر لماذا في supabase/client.ts
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) {
      setLoading(false);
      alert(t.loginFailed + error.message);
    }
  }, [t]);

  useEffect(() => {
    if (!CLIENT_ID || done.current) return;
    let cancelled = false;

    async function boot() {
      const [raw, hashed] = await makeNonce();

      await new Promise<void>((resolve, reject) => {
        if (window.google?.accounts?.id) return resolve();
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("gsi")));
          return;
        }
        const s = document.createElement("script");
        s.src = GSI_SRC;
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("gsi"));
        document.head.appendChild(s);
      });

      if (cancelled || !window.google?.accounts?.id || !holder.current) return;

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        nonce: hashed,
        // بلا FedCM: تجربتها تختلف بين المتصفّحات ولا نحتاجها لزرٍّ واحد
        use_fedcm_for_prompt: false,
        callback: async (res: CredentialResponse) => {
          if (!res.credential) return;
          setLoading(true);
          try {
            const supabase = await createClient();
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: res.credential,
              nonce: raw,
            });
            if (error) throw error;
            done.current = true;
            // `refresh` قبل `replace`: الخادم يقرأ كوكي الجلسة الجديدة
            router.refresh();
            router.replace("/");
          } catch (e) {
            setLoading(false);
            alert(t.loginFailed + (e as Error).message);
          }
        },
      });

      window.google.accounts.id.renderButton(holder.current, {
        type: "standard",
        theme: "filled_blue",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "center",
        locale,
        width: 320,
      });

      if (!cancelled) setGsiReady(true);
    }

    boot().catch(() => {
      // المكتبة لم تصل — يبقى الزرّ القديم ظاهراً وحده
      if (!cancelled) setGsiReady(false);
    });

    return () => {
      cancelled = true;
    };
  }, [locale, router, t]);

  return (
    <div className="w-full">
      {/* زرّ Google نفسه — يرسمه محرّكها داخل هذا الصندوق */}
      <div
        ref={holder}
        className={`flex justify-center ${gsiReady ? "" : "hidden"}`}
        aria-busy={loading}
      />

      {/* الزرّ القديم: وحده حين لا تعمل الطريقة الأولى، وسطرٌ صغير تحتها
          حين تعمل — فمن حجب حاجبُه نافذة Google يجد باباً ثانياً */}
      {!gsiReady ? (
        <button
          onClick={redirectSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-[color:var(--surface-inverse)] text-[color:var(--on-surface-inverse)] font-bold text-[16px] py-4 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.25)] hover:brightness-95 active:scale-[0.98] transition disabled:opacity-60"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? t.loginRedirecting : t.loginContinueGoogle}
        </button>
      ) : (
        <button
          onClick={redirectSignIn}
          disabled={loading}
          className="mt-3 w-full text-[12px] text-muted/70 hover:text-muted transition disabled:opacity-50"
        >
          {t.loginOtherWay}
        </button>
      )}
    </div>
  );
}
