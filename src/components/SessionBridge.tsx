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
    /* 🆕 D-1083 — **«السامعُ جاهز» يُبلَّغ لحظةَ التعليق لا عند `onLoadEnd`**: الإقلاعُ الأصليّ (D-1075)
       يصفّ طلبَ الرمز حتى تُحمَّل الصفحة، و`onLoadEnd` لا يأتي إلا بعد آخر صورةٍ في رئيسيّة الويب
       المحمَّلة تحته — فانتظرت الرئيسيّةُ الأصليّةُ ~١٠ث بهيكلٍ فارغ (تسجيلُ أحمد على 1.11.8). الطلبُ
       يحتاج هذا السامعَ وحدَه، وهو معلَّقٌ الآن. غلافٌ قديمٌ يهمل النوعَ المجهول فلا يتغيّر شيء. */
    post({ type: "bridge:ready" });

    /* 🆕 D-949 — **الرجوعُ من صفحةٍ فُتحت من المكتبة الأصليّة يعود إليها**
       (بلاغُ أحمد: «إذا دخلت الإحصائيات وأرجع يودّيني للهوم»). الغلافُ يضع
       `loopz:return` في `sessionStorage` قبل `location.href`؛ هنا عند الوصول:
       تُنزع العلامةُ وتُسلَّح (`loopz:armed`)، وتُوسَم حالةُ التاريخ لهذه
       الصفحة وكلِّ ما يُدفع بعدها (`pushState` مُغلَّف) — **فأوّلُ `popstate`
       يهبط على حالةٍ بلا وسمٍ هو رجوعٌ تجاوز صفحةَ الوصول** ⇒ `native:library`.
       والرجوعُ الذي يحمّل مستنداً (المدخلُ السابق مستندٌ لا SPA) يُلتقط عند
       الوصول بـ`navigation.type === "back_forward"` مع التسليح.
       ⚖️ **والذهابُ إلى جذرٍ (الرئيسيّة/التبويبات) ينزع السلاح**: من ضغط
       «الرئيسيّة» بنفسه ثمّ رجع لا يتوقّع المكتبة. */
    const ROOTS = new Set(["/", "/library", "/discover", "/news", "/community", "/search"]);
    /* 🆕 Phase 11-C (D-955) — العلامةُ تحمل اسمَ الشاشة (`library` · `discover`)
       فالرجوعُ يعود إلى الشاشة التي فُتحت منها الصفحة، بالآليّة نفسِها */
    /* Phase 11-G — و`search`: الرجوعُ من صفحةٍ فُتحت من البحث الأصليّ (ملفُّ عضو) يعود إليه */
    const ROOT_NAMES = new Set(["library", "discover", "search", "home"]);
    /* 🆕 D-1101 — و`settings` أو `settings/<قسم>`: صفحةٌ فُتحت من الإعدادات الأصليّة يعود رجوعُها إليها
       (بلاغُ أحمد على 1.11.11: «تعديل الملف» ← رجوع ← الرئيسيّة). ليست جذراً — لا مسارَ لها في `ROOT_OF` */
    const NATIVE = { has: (r: string) => ROOT_NAMES.has(r) || /^settings(\/[a-z-]+)?$/.test(r) };
    /* 🔴 D-973 — **جذرُ الشاشة الأصليّة نفسِها لا ينزع سلاحَها بل يعيدها** (بلاغُ
       أحمد بتسجيل على 1.8.5: «بعد ما أتصفّح دقايق يرجع اكتشف ويب فيو»): زرُّ الرجوع
       في صفحة التريلرات يستبدل العنوانَ بـ`/news`، و`/news` جذرٌ — فكان السلاحُ
       يُنزع وتُرسم «اكتشف» الويبيّةُ تحت إصبعه، ومن ذلك الباب صار كلُّ ما بعدها
       ويبيّاً. **الذهابُ إلى جذر الشاشة المسلَّحة هو عودةٌ إليها**: `/news` وأنت
       مسلَّحٌ بـ`discover`، و`/library` وأنت مسلَّحٌ بـ`library` ⇒ `native`. ما سواه
       من الجذور (الرئيسيّة · المجتمع) ينزع السلاحَ كما كان — والبحثُ صار جذراً أصليّاً هو الآخر (Phase 11-G). */
    /* Phase 11-H — و`home` جذرُه `/` (D-1066): «الرئيسيّة» وأنت مسلَّحٌ بها ⇒ الشاشةُ الأصليّة */
    const ROOT_OF: Record<string, string> = { discover: "/news", library: "/library", search: "/search", home: "/" };
    const toNative = () => {
      let route = "library";
      try {
        route = sessionStorage.getItem("loopz:armed") ?? "library";
        sessionStorage.removeItem("loopz:armed");
      } catch {
        /* لا شيء */
      }
      post({ type: "native", route: NATIVE.has(route) ? route : "library" });
    };
    /** هل هذا المسارُ جذرُ الشاشة المسلَّحة الآن؟ */
    const isArmedRoot = (path: string): boolean => {
      try {
        const armedRoute = sessionStorage.getItem("loopz:armed") ?? "";
        return NATIVE.has(armedRoute) && ROOT_OF[armedRoute] === path;
      } catch {
        return false;
      }
    };
    let armed = false;
    try {
      const ret = sessionStorage.getItem("loopz:return");
      if (ret && NATIVE.has(ret)) {
        sessionStorage.removeItem("loopz:return");
        sessionStorage.setItem("loopz:armed", ret);
      }
      armed = NATIVE.has(sessionStorage.getItem("loopz:armed") ?? "");
      const navType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
      if (armed && navType === "back_forward") {
        toNative();
        armed = false;
      }
    } catch {
      armed = false;
    }
    /* D-973 — صفحةُ الوصول نفسُها قد تكون جذراً (أبوابُ `/news?filters=1` و`/library?smart=new`
       من الشاشة الأصليّة): البقاءُ فيها ليس عودةً ولا نزعَ سلاح — يُستثنى مسارُها */
    const arrivalPath = window.location.pathname;
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    const origBack = window.history.back;
    /* الوسمُ يُحفظ على كلِّ مدخلٍ غيرِ جذرٍ ما دمنا مسلَّحين — و`replaceState`
       أيضاً لأنّ موجِّه Next يستبدل الحالةَ بعد كلِّ انتقالٍ بلا نسخِ ما ليس له. */
    const stamp = (data: unknown, url?: string | URL | null): unknown => {
      try {
        const path = url ? new URL(String(url), window.location.href).pathname : window.location.pathname;
        if (ROOTS.has(path) && path !== arrivalPath) {
          /* D-973 — جذرُ الشاشة المسلَّحة عودةٌ إليها؛ الصفحةُ الويبيّة تُرسم تحتها ولا تُرى */
          if (isArmedRoot(path)) queueMicrotask(toNative);
          else sessionStorage.removeItem("loopz:armed");
          return data;
        }
        if (NATIVE.has(sessionStorage.getItem("loopz:armed") ?? "") && data && typeof data === "object")
          return { ...(data as Record<string, unknown>), loopzReturn: 1 };
      } catch {
        /* لا شيء */
      }
      return data;
    };
    const onPop = () => {
      try {
        if (!NATIVE.has(sessionStorage.getItem("loopz:armed") ?? "")) return;
        const st = window.history.state as { loopzReturn?: number } | null;
        if (!st?.loopzReturn) toNative();
      } catch {
        /* لا شيء */
      }
    };
    if (armed) {
      try {
        window.history.replaceState({ ...(window.history.state ?? {}), loopzReturn: 1 }, "");
      } catch {
        /* لا شيء */
      }
      window.history.pushState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
        return origPush.call(this, stamp(data, url), unused, url);
      };
      window.history.replaceState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
        return origReplace.call(this, stamp(data, url), unused, url);
      };
      window.addEventListener("popstate", onPop);
      /* 🆕 D-1102 — **زرُّ الرجوع في صفحة الوصول يعود مباشرةً** (بلاغُ أحمد بتسجيل على 1.11.11: وميضُ
         هيكلٍ رماديّ عند الرجوع من «تعديل الملف»). من صفحة الوصول كلُّ رجوعٍ يتجاوزها — فهو عودةٌ إلى
         الشاشة الأصليّة مهما كان قبلها؛ لكنّ `history.back()` كان يحمّل ما قبلها (مستنداً من زيارةٍ سابقة)
         فيُرسم هيكلُ تحميله ثمّ يُسلَّم. الآن تُسلَّم العودةُ قبل أن يتحرّك التاريخ. `router.back()` في Next
         هو `history.back()` نفسُه، فـ`BackButton` وكلُّ رجوعٍ مكتوبٍ يمرّ من هنا. ⚖️ المسارُ وحدَه يحكم:
         وصولٌ ← صفحةٌ ← الوصولُ نفسُه بـ`push` نادرٌ في أبواب الإعدادات، وثمنُه عودةٌ مبكّرة لا خروج. */
      window.history.back = function (this: History) {
        try {
          if (window.location.pathname === arrivalPath && NATIVE.has(sessionStorage.getItem("loopz:armed") ?? "")) {
            toNative();
            return;
          }
        } catch {
          /* لا شيء — الرجوعُ المعتاد */
        }
        return origBack.call(this);
      };
    }

    /* 🆕 D-946 — **لغةُ الويب إلى الغلاف**: الشاشةُ الأصليّة كانت تقرأ لغةَ
       الهاتف لا لغةَ الحساب (أحمد: «المكتبةُ بالعربيّة والتطبيقُ بالإنجليزيّة»).
       المصدرُ `<html lang>` — يكتبه التخطيطُ من الكوكي — يُبلَّغ عند التركيب
       وعند كلِّ تبديلٍ (المراقبُ يلتقط إعادةَ رسم التخطيط). لا `nonce`: ليست
       سرّاً، والغلافُ يفحص المضيفَ والقيمةَ. */
    const postLocale = () => post({ type: "locale", lang: document.documentElement.lang });
    postLocale();
    const langWatch = new MutationObserver(postLocale);
    langWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

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
      langWatch.disconnect();
      if (armed) {
        window.history.pushState = origPush;
        window.history.replaceState = origReplace;
        window.history.back = origBack;
        window.removeEventListener("popstate", onPop);
      }
      unsub?.();
    };
  }, []);
  return null;
}
