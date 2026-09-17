"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** اسمُ العلَم على `<html>` — يقرؤه زرُّ «المكتبة» في `BottomNav` لحظةَ الضغط */
export const NATIVE_LIBRARY_ATTR = "data-native-library";

/**
 * 🆕 **علَمُ التجربة على المستند** (Phase 11 · B1): يُركَّب من `NativeLibraryGate`
 * للإدارة داخل الغلاف فقط. **لا يرسم شيئاً ولا يحمل منطقاً** — يضع سمةً
 * على `<html>` **فيبقى `BottomNav` كما هو** (لا خاصيّةَ جديدة تمرّ من التخطيط
 * عبر الشريط لأجل تجربةٍ قد تُحذف في B6-ج).
 *
 * 🔑 **ولماذا سمةٌ لا متغيّرُ نافذة؟** لأنّ السمةَ تُقرأ من أيِّ مكوّنٍ بلا
 * استيرادٍ ولا حالةٍ مشتركة، **وتزول بزوال المكوّن** (التنظيف أدناه) — فإذا
 * سُحبت الإدارةُ زال الزرُّ بلا إعادة تحميل.
 */
export function NativeLibraryFlag() {
  const router = useRouter();
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute(NATIVE_LIBRARY_ATTR, "1");
    /**
     * 🆕 D-1000 — **كلُّ رابطِ عملٍ في الويب يفتح `TitleScreen` الأصليّة** (سؤالُ أحمد: «إذا دخلت
     * على فلم من داخل ليست يفتح ويبيّة، ليش؟»): الصفحاتُ التي لم تُنقل بعد (القوائم · البحث ·
     * الرئيسيّة · المجتمع) تبقى ويبيّة، لكنّ الضغطةَ على `/show/:id` أو `/movie/:id` فيها
     * تُلتقط هنا — مرّةً على المستند، في طور الالتقاط — وتُبثّ للغلاف بدل الملاحة. الشرطُ
     * شرطُ `openNative` نفسُه: الغلافُ يعلن `title` (≥ 1.9.1)؛ غلافٌ أقدم يبقى رابطاً (درسُ ٩
     * سبتمبر). الروابطُ المفتوحةُ في تبويبٍ جديد أو بمُعدِّل (ctrl/⌘) تُترك.
     */
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!nativeLibraryOn() || window.LoopzNative?.title !== true) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const m = /^\/(show|movie)\/(\d+)(?:\/)?$/.exec(url.pathname);
      if (!m || url.search || url.hash) return;
      try {
        window.ReactNativeWebView!.postMessage(JSON.stringify({ type: "native", route: "title", kind: m[1] === "show" ? "tv" : "movie", id: Number(m[2]) }));
        e.preventDefault();
      } catch {
        /* الجسرُ غاب — الرابطُ يمضي */
      }
    };
    document.addEventListener("click", onClick, true);
    /* D-1012 — الغلافُ يرسم الشريطَ: نُخفي شريطَنا (CSS) ونعطيه موجِّهَ الصفحة */
    if (window.LoopzNative?.nav === true) {
      el.setAttribute("data-native-nav", "1");
      /* موجِّهُ الصفحة بيد الغلاف: انتقالٌ داخل التطبيق الويبيّ بلا تحميل مستند */
      window.__loopzGo = (to: string) => router.push(to);
    }
    return () => {
      el.removeAttribute(NATIVE_LIBRARY_ATTR);
      el.removeAttribute("data-native-nav");
      delete window.__loopzGo;
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);
  return null;
}

declare global {
  interface Window {
    /** 🆕 يحقنه الغلافُ (≥ 1.4.1) قبل تحميل المستند: ما يستطيع فتحَه أصليّاً */
    LoopzNative?: { library?: boolean; discover?: boolean; /** D-1000 — يفتح صفحةَ العمل أصليّةً من رابط */ title?: boolean; /** D-1012 — الغلافُ يرسم الشريطَ السفليَّ بنفسه */ nav?: boolean };
    /** D-1012 — الغلافُ ينادي موجِّهَ الصفحة بدل تحميل مستندٍ جديد */
    __loopzGo?: (path: string) => void;
  }
}

/**
 * هل التجربةُ مفعّلةٌ على هذا المستند **وداخل غلافٍ يعرف الشاشة**؟ — سؤالُ لحظة الضغط.
 *
 * 🔴 **الدرسُ (٩ سبتمبر، بلاغُ أحمد: «لا أستطيع الدخول إلى المكتبة من التطبيق»)**:
 * الويبُ كان يبتلع الضغطةَ (`preventDefault`) لكلِّ غلافٍ يحمل وسم `LoopzApp/`،
 * **والغلافُ المثبَّت كان 1.2.3 الذي لا يعرف رسالةَ `native`** — فلا صفحةَ ولا
 * شاشة. **الجسرُ وحدَه لا يثبت القدرة**؛ الغلافُ الذي يعرف الشاشةَ يحقن
 * `window.LoopzNative.library` قبل المستند، **ومن لا يحقنها يبقى الرابطُ رابطاً.**
 */
export function nativeLibraryOn(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute(NATIVE_LIBRARY_ATTR) &&
    !!window.ReactNativeWebView &&
    window.LoopzNative?.library === true
  );
}

/** يطلب من الغلاف فتحَ الشاشة الأصليّة — `true` إن أُرسل الطلب */
export function openNativeLibrary(): boolean {
  return openNative("library");
}

/**
 * 🆕 Phase 11-C (D-955) — **الشاشاتُ الأصليّةُ بالمفتاح نفسِه**: العلَمُ واحد
 * (الإدارةُ داخل الغلاف)، **والقدرةُ لكلِّ شاشةٍ على حدة** في `LoopzNative`
 * (غلافٌ يعرف المكتبةَ ولا يعرف «اكتشف» يبقي «اكتشف» رابطاً — درسُ ٩ سبتمبر).
 */
export function openNative(route: "library" | "discover"): boolean {
  if (!nativeLibraryOn() || window.LoopzNative?.[route] !== true) {
    signalGate(route);
    return false;
  }
  try {
    window.ReactNativeWebView!.postMessage(JSON.stringify({ type: "native", route }));
    return true;
  } catch {
    return false;
  }
}

/**
 * 🩺 **تشخيصٌ مؤقّت (١٤ سبتمبر ٢٠٢٦)** — بلاغُ أحمد على 1.6.0: الشاشتان تفتحان
 * ويبيّاً. **حين تسقط البوّابةُ داخل غلافٍ** (وسمُ `LoopzApp/` في UA) تُرسَل
 * الشروطُ الثلاثةُ منطقيّاتٍ إلى `/api/native-signal` → `runtime_errors` بنوع
 * `NativeGate` — **مرّةً لكلِّ مسارٍ لكلِّ تحميلِ مستند** (لا حلقة)، `sendBeacon`
 * فلا ينتظر أحد. يُزال مع الإصلاح.
 */
const gateSignalled = new Set<string>();
function signalGate(route: "library" | "discover") {
  try {
    if (!navigator.userAgent.includes("LoopzApp/") || gateSignalled.has(route)) return;
    gateSignalled.add(route);
    const body = JSON.stringify({
      route,
      attr: document.documentElement.hasAttribute(NATIVE_LIBRARY_ATTR),
      rnwv: !!window.ReactNativeWebView,
      ln: !!window.LoopzNative,
      lib: window.LoopzNative?.library === true,
      disc: window.LoopzNative?.discover === true,
    });
    if (!navigator.sendBeacon?.("/api/native-signal", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/native-signal", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  } catch {
    /* الإشارةُ احتياطٌ — لا تمسّ الضغطة */
  }
}
