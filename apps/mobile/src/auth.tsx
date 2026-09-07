import "react-native-url-polyfill/auto";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { CONFIG } from "./config";
import { secureStorage } from "./secureStorage";

/**
 * ====== الدخولُ والجلسة — Google عبر المتصفّح، PKCE، تجديدٌ على الجهاز ======
 *
 * 🔑 **لماذا المتصفّحُ لا الدخولُ الأصليّ في النسخة الأولى؟** لأنّ الأصليَّ
 * يحتاج مُعرِّفَ عميلٍ لأندرويد وبصمةَ SHA-1 لكلِّ توقيع — **أربعُ خطواتٍ
 * خارجَ المستودع قبل أوّلِ شاشة**. أمّا هذا فيستعمل **عميلَ Google القائمَ
 * للويب نفسَه** (وموافقةَ D-870 نفسَها بعلامة Loopz) ويحتاج سطراً واحداً في
 * Supabase: عنوانَ الرجوع `com.loopztv.app://auth/callback`. **الأصليُّ
 * يأتي حين يصير الفرقُ محسوساً، لا قبل.**
 *
 * 🔑 **PKCE لا implicit**: الرمزُ لا يمرّ في عنوان URL أبداً — يعود `code`
 * ويُبدَّل من الجهاز بجلسة. **وعنوانُ الرجوع مسجَّلٌ في Supabase** فلا يستطيع
 * تطبيقٌ آخر يدّعي المخطّطَ نفسَه أن يتلقّى شيئاً ذا قيمة.
 *
 * 🔴 **الجلسةُ الأصليّةُ لا تُحفظ ولا تُجدَّد (٧ سبتمبر — إصلاحُ D-922)**:
 * بعد التسليم صاحبُ الجلسة **كوكي الـWebView**، والرمزان اللذان يعودان من
 * `exchangeCodeForSession` يعيشان ثوانيَ في الذاكرة حتّى يُحقَنا في نموذج
 * التسليم. **كان الغلافُ يحفظهما في SecureStore ثمّ يمسحهما بـ
 * `signOut({ scope: "local" })`** — و`local` في supabase-js **لا يعني
 * «محلّيّاً»**: النداءُ يذهب إلى `/logout?scope=local` **فيُلغي عند الخادم
 * الجلسةَ نفسَها التي سُلِّمت للتوّ**، فتعود الصفحةُ التاليةُ `session_not_found`
 * ويُطرد المستخدمُ بعد ثانيتين من دخوله (سجلّاتُ Supabase ٧ سبتمبر: login ⇢
 * logout ⇢ 403 كلَّ محاولة). **والتجديدُ التلقائيُّ معطَّل** للسبب نفسِه:
 * عميلان يدوّران رمزَ تجديدٍ واحداً يُسقط أحدُهما الآخر
 * (`refresh_token_already_used`). فلا مخزنَ ولا مؤقّت — **ولا خروجَ عبر
 * الخادم من هنا أبداً.**
 */

WebBrowser.maybeCompleteAuthSession();

export const supabase: SupabaseClient = createClient(
  CONFIG.supabaseUrl,
  CONFIG.supabasePublishableKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);

/** مفتاحُ supabase-js الافتراضيّ للجلسة في المخزن — لِمسح ما حفظته 1.1/1.2 مرّةً واحدة */
const LEGACY_SESSION_KEY = (() => {
  try {
    return `sb-${new URL(CONFIG.supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return "";
  }
})();

/**
 * جلسةٌ حفظتها نسخةٌ سابقةٌ في SecureStore تُمسح بلا نداءٍ للخادم: رمزُها
 * ميّتٌ غالباً (أُلغي بالخروج القديم أو دُوِّر من الـWebView)، وتسليمُ رمزٍ
 * ميّتٍ يعيد `/login?handoff=failed`. **لا `signOut` هنا** — انظر أعلى.
 */
export async function forgetLegacySession(): Promise<void> {
  if (!LEGACY_SESSION_KEY) return;
  await Promise.all([
    secureStorage.removeItem(LEGACY_SESSION_KEY),
    secureStorage.removeItem(`${LEGACY_SESSION_KEY}-code-verifier`),
  ]).catch(() => {});
}

type AuthState = {
  session: Session | null;
  /** `true` حتى تُقرأ الجلسةُ من المخزن أوّلَ مرّة — لا وميضَ شاشةِ دخولٍ لمن هو داخلٌ أصلاً */
  loading: boolean;
  signInWithGoogle: () => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /* لا جلسةَ تُقرأ من مخزن: الكوكي في الـWebView هو الجلسة. يُمسح إرثُ
       النسخ السابقة ثمّ يُرفع الستار. */
    forgetLegacySession().finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      async signInWithGoogle() {
        try {
          const redirectTo = Linking.createURL("auth/callback");
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo, skipBrowserRedirect: true },
          });
          if (error || !data.url) return { ok: false, message: error?.message ?? "no url" };

          const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (res.type !== "success") return { ok: false, message: res.type };

          const code = new URL(res.url).searchParams.get("code");
          if (!code) return { ok: false, message: "no code" };
          const ex = await supabase.auth.exchangeCodeForSession(code);
          if (ex.error) return { ok: false, message: ex.error.message };
          return { ok: true };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : "unknown" };
        }
      },
      async signOut() {
        /* الخروجُ خروجُ الويب (`/auth/signout`) — الغلافُ لا يملك جلسةً يُنهيها */
        await forgetLegacySession();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

/** رمزُ الوصول الحاليّ — يُجدَّد إن كان على وشك الانتهاء. */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
