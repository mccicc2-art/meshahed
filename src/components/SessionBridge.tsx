"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 🆕 **جسرُ الجلسة إلى الشاشة الأصليّة** (Phase 11 · B1، D-936) — عقدُ
 * الأمان §٢.٢-ب في `PHASE_11_APP_PERFORMANCE_AND_NATIVE_LIBRARY.md`.
 *
 * 🔑 **الجلسةُ تبقى للـWebView** (D-922): هذا المكوّنُ **لا يعطي الغلافَ
 * رمزَ تجديدٍ أبداً** — يعطيه **رمزَ الوصول وحدَه** (ساعةٌ) حين يطلبه،
 * والغلافُ يستعمله `Bearer` ولا يجدّده؛ فإذا انتهى طلب رمزاً جديداً
 * من هنا، **والتجديدُ — إن لزم — تفعله الصفحةُ عبر الكوكي** كما تفعله
 * لكلِّ صفحة. عميلان يدوّران رمزَ تجديدٍ واحداً هو عطلُ D-932 نفسُه.
 *
 * 🔑 **الطلبُ قبل العطاء، وبـ`nonce`** (المراجع ٩): الجسرُ على أندرويد يُحقن
 * في كلِّ الإطارات، **فالـURL وحدَه لا يثبت أنّ المجيبَ صفحتُنا**. الغلافُ
 * يولّد `nonce` لكلِّ طلبٍ ويحقنه في الحدث `loopz:session-request {nonce}`،
 * **ونحن نعيده كما هو** — والغلافُ يُهمل كلَّ ردٍّ بلا `nonce` مطابق. فلا
 * بثَّ تلقائيٌّ عند التحميل: ردٌّ بلا طلبٍ ردٌّ بلا `nonce`، ويُهمل.
 *
 * 🔑 **والمسحُ فوريّ** (§٣): عند نموذج `/auth/signout` (قبل أن يغادر
 * المستندُ) وعند تبدّل `user.id` يُبثّ `session:clear` فيمسح الغلافُ الرمزَ
 * ويُغلق الشاشةَ الأصليّة. **والحزامُ الثاني في الغلاف نفسِه**: عنوانُ
 * `/auth/signout` في تاريخ التصفّح يمسح أيضاً — فلا يعتمد الأمانُ على
 * حدثٍ واحد.
 *
 * ⚖️ **ولا يُركَّب إلا داخل الغلاف ولمسجَّل** (شرطٌ خادميٌّ في التخطيط على
 * وسم `LoopzApp/`): في المتصفّح لا جسرَ فلا شيء، ولا يُحمَّل supabase-js
 * قبل أوّل طلب (`createClient` كسولة — D-…).
 */
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (data: string) => void };
  }
}

const REQUEST_EVENT = "loopz:session-request";

function post(data: Record<string, unknown>) {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(data));
  } catch {
    /* لا جسرَ — لا شيء */
  }
}

export function SessionBridge() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.ReactNativeWebView) return;

    let lastUserId: string | null = null;
    let disposed = false;

    const onRequest = async (e: Event) => {
      const nonce = (e as CustomEvent<{ nonce?: unknown }>).detail?.nonce;
      if (typeof nonce !== "string" || !nonce) return;
      try {
        const supabase = await createClient();
        const { data } = await supabase.auth.getSession();
        const s = data.session;
        if (disposed) return;
        if (!s?.access_token || !s.expires_at) {
          post({ type: "session:clear", nonce });
          return;
        }
        lastUserId = s.user.id;
        post({ type: "session", access: s.access_token, exp: s.expires_at, nonce });
      } catch {
        post({ type: "session:clear", nonce });
      }
    };

    /* نموذجُ الخروج يُرسَل بلا JS (`SignOutRow`) — نلتقطه في طور الالتقاط
       قبل أن يغادر المستند، فيصل المسحُ قبل صفحة `/login`. */
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || typeof form.action !== "string") return;
      if (form.action.includes("/auth/signout")) post({ type: "session:clear" });
    };

    window.addEventListener(REQUEST_EVENT, onRequest);
    document.addEventListener("submit", onSubmit, true);

    let unsub: (() => void) | null = null;
    createClient()
      .then((supabase) => {
        if (disposed) return;
        const { data } = supabase.auth.onAuthStateChange((event, s) => {
          const id = s?.user.id ?? null;
          if (event === "SIGNED_OUT" || (lastUserId && id !== lastUserId)) {
            lastUserId = id;
            post({ type: "session:clear" });
          }
        });
        unsub = () => data.subscription.unsubscribe();
      })
      .catch(() => {});

    return () => {
      disposed = true;
      window.removeEventListener(REQUEST_EVENT, onRequest);
      document.removeEventListener("submit", onSubmit, true);
      unsub?.();
    };
  }, []);
  return null;
}
