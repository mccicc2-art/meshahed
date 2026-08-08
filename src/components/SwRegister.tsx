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
 *
 * **وفحص بصمةٍ مباشر فوق ذلك.** دورة الـsw لا تكفي وحدها: إن لم تتغيّر
 * قشرة `sw.js` بين نشرَين فلا «عامل جديد» أصلاً ولا إعادة تحميل — فيبقى
 * التبويب المُستأنَف على صفحته القديمة (شكوى المالك: «تسجيل الدخول القديم
 * يظهر أولاً»). الصفحة تحمل بصمة بنائها كخاصية، وعند كل عودةٍ للواجهة
 * نقارنها بـ`/api/build`: اختلفتا → إعادة تحميلٍ واحدة فورية. طلبٌ بحجم
 * سطرٍ لا يتكرّر أكثر من مرّة بالدقيقة.
 */
export function SwRegister({ build }: { build?: string }) {
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

    // فحص البصمة: صفحةٌ قديمة في الذاكرة تكتشف نفسها وتُبدَّل فوراً.
    // مكبوحٌ بدقيقة حتى لا يتحوّل تقليبُ التبويبات إلى مطرٍ من الطلبات.
    let lastCheck = 0;
    const checkBuild = async () => {
      if (!build || build === "dev" || refreshing) return;
      const now = Date.now();
      if (now - lastCheck < 60_000) return;
      lastCheck = now;
      try {
        const res = await fetch("/api/build", { cache: "no-store" });
        const live = (await res.text()).trim();
        if (res.ok && live && live !== "dev" && live !== build && !refreshing) {
          refreshing = true;
          window.location.reload();
        }
      } catch {
        /* انقطاع؟ الصفحة القائمة أفضل من لا شيء */
      }
    };

    // عند عودة التطبيق إلى الواجهة نسأل المتصفّح: هل من نسخةٍ أحدث؟
    // هذا يمسك حالة الاستئناف من الذاكرة التي لا يمرّ فيها تنقّلٌ يفحص sw.js
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        reg?.update().catch(() => {});
        checkBuild();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // استئنافٌ من bfcache لا يطلق visibilitychange دائماً — pageshow يمسكه
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) checkBuild();
    };
    window.addEventListener("pageshow", onPageShow);

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [build]);

  return null;
}
