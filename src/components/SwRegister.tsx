"use client";

import { useEffect } from "react";

/**
 * تسجيل الـService Worker — لا يرسم شيئاً.
 *
 * في الإنتاج فقط: أثناء التطوير يخلط الكاش بين نسخ البناء ويصنع أشباحاً.
 * التسجيل بعد load حتى لا يزاحم تنزيلَ ما تحتاجه الصفحة الأولى.
 *
 * **يُحدِّث التطبيق المثبّت من تلقائه.** كان النشرُ الجديد لا يصل إلى
 * تطبيق PWA المُستأنَف من الذاكرة على iOS إلا بإعادة تثبيت: الـHTML
 * «الشبكة أولاً» يعطي بناءً طازجاً عند البدء البارد، لكن التطبيق المُستأنَف
 * يبقى على جافاسكربت قديمٍ في الذاكرة. فأضفنا أمرين: فحصُ التحديث كلّما
 * عاد التطبيق إلى الواجهة، وإعادةُ تحميلٍ **مرّة واحدة** حين يتولّى عاملٌ
 * جديد التحكّم — فينزل البناء الطازج بلا إعادة تثبيت.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // أوّل تثبيتٍ (لا مُتحكّم سابق) لا يُعيد التحميل؛ تبديلُ عاملٍ قائمٍ
    // بآخر جديد هو ما يستحقّ إعادةَ تحميلٍ واحدة
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;

    function onControllerChange() {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let reg: ServiceWorkerRegistration | undefined;
    const register = async () => {
      try {
        reg = await navigator.serviceWorker.register("/sw.js");
      } catch {
        /* الكاش تحسين لا التزام */
      }
    };

    // عند عودة التطبيق إلى الواجهة نسأل المتصفّح: هل من نسخةٍ أحدث؟
    // هذا يمسك حالة الاستئناف من الذاكرة التي لا يمرّ فيها تنقّلٌ يفحص sw.js
    const onVisible = () => {
      if (document.visibilityState === "visible") reg?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
