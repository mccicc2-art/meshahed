import "react-native-url-polyfill/auto";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
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

/**
 * 🆕 D-1350 — ما تعود به أبل مرّةً واحدة ولا يُسأل عنه ثانيةً: رمزُ التفويض (صالحٌ خمسَ دقائق، يبدّله الخادمُ برمز
 * تجديدٍ يُلغى به الإذنُ عند حذف الحساب) والاسمُ (لا تعطيه أبل إلّا في أوّل دخولٍ للتطبيق، وليس في رمز الهويّة).
 */
export type AppleExtra = { code: string | null; name: string | null };
export type SignInOutcome = { ok: true; apple?: AppleExtra } | { ok: false; message: string };
/** `onReturn`: عاد من نافذة المزوّد بما يكفي للدخول (قبل تبادله بجلسة) — الشاشةُ ترفع ستارَها من هذه اللحظة */
type SignInOpts = { onReturn?: () => void };

type AuthState = {
  session: Session | null;
  /** `true` حتى تُقرأ الجلسةُ من المخزن أوّلَ مرّة — لا وميضَ شاشةِ دخولٍ لمن هو داخلٌ أصلاً */
  loading: boolean;
  signInWithGoogle: (opts?: SignInOpts) => Promise<SignInOutcome>;
  /** 🆕 D-1350 — دخولُ أبل الأصليّ: على iOS وحدَه (القرار ٣) */
  signInWithApple: (opts?: SignInOpts) => Promise<SignInOutcome>;
  signOut: () => Promise<void>;
};

/** أبل تعرض زرَّها على iOS ١٣+ — وعلى أندرويد والويب لا شيء (القرار ٣: «تسجيل الدخول عن طريق ابل فقط ف ابل») */
export const APPLE_SIGN_IN = Platform.OS === "ios";

const HEX = "0123456789abcdef";
function randomHex(bytes: number): string {
  let out = "";
  for (const b of Crypto.getRandomBytes(bytes)) out += HEX[b >> 4] + HEX[b & 15];
  return out;
}

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
      async signInWithGoogle(opts) {
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
          opts?.onReturn?.();
          const ex = await supabase.auth.exchangeCodeForSession(code);
          if (ex.error) return { ok: false, message: ex.error.message };
          return { ok: true };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : "unknown" };
        }
      },
      /**
       * 🆕 D-1350 — **أبل بلا متصفّح**: ورقةُ النظام تعيد رمزَ هويّةٍ موقَّعاً، وSupabase يتحقّق منه ويصدر الجلسة
       * (`signInWithIdToken` — مزوّدُ أبل هناك بمعرّف الحزمة عميلاً، بلا سرّ). ما بعد الجلسة طريقُ Google نفسُه.
       *
       * 🔑 **الرقمُ العشوائيّ (nonce)**: أبل تضع في الرمز بصمتَه (SHA-256) وSupabase يطابقها بالأصل الذي نرسله له —
       * فرمزٌ سُرق من دخولٍ آخر لا يُقبل هنا. الأصلُ لا يغادر الجهازَ إلّا إلى Supabase.
       */
      async signInWithApple(opts) {
        try {
          const raw = randomHex(16);
          const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
          const cred = await AppleAuthentication.signInAsync({
            requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
            nonce: hashed,
          });
          if (!cred.identityToken) return { ok: false, message: "no token" };
          opts?.onReturn?.();
          const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken, nonce: raw });
          if (error) return { ok: false, message: error.message };
          const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter((x): x is string => !!x && !!x.trim()).join(" ").trim();
          return { ok: true, apple: { code: cred.authorizationCode ?? null, name: name || null } };
        } catch (e) {
          /* أغلق الورقةَ بنفسه ⇒ «cancel» كما يقولها متصفّحُ Google (فلا رسالةَ خطأ) */
          const code = (e as { code?: unknown } | null)?.code;
          if (code === "ERR_REQUEST_CANCELED") return { ok: false, message: "cancel" };
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
