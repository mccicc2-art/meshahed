"use client";

import { useEffect } from "react";
import { isPlaybackActive, onPlaybackChange } from "@/core/playback";

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
    /**
     * 🆕 **نسخةٌ جاهزةٌ تنتظر لحظةً مناسبة** (D-749، حكمُ أحمد: «أجّله
     * إذا كان مقطعٌ يعمل»).
     * 🔑 **إعادةُ التحميل وسط مقطعٍ يُشاهَد قطعٌ لا تحديث** — **وهذا
     * المكوّنُ بُني يومَ كانت «اكتشف» صفحةَ ملصقاتٍ لا فيديو** (D-726
     * غيّر ما تحته ولم يُراجَع ما فوقه).
     * 🔑 **والقاعدة: ما يُقاطع القارئ يُؤجَّل إلى أن يفرغ، لا يُلغى** —
     * **والتأجيلُ ليس تخلّياً: النيّةُ محفوظةٌ وتُنفَّذ أوّلَ فرصة.**
     * ⚠️ **وثمنُه معلَن**: **نسخةٌ قديمةٌ تعيش أطول عند من يُدمن
     * المشاهدة** — وهو ما اختاره بعد أن عُرض عليه.
     */
    let pending = false;

    function apply() {
      if (!pending || refreshing) return;
      /* **والمقطعُ العاملُ وحدَه يؤجّل** — لا التبويبُ ولا التمرير */
      if (isPlaybackActive()) return;
      refreshing = true;
      window.location.reload();
    }

    function onControllerChange() {
      if (!hadController || refreshing) return;
      pending = true;
      apply();
    }

    /* **وأوّلُ لحظةٍ يسكت فيها المقطعُ هي لحظةُ التنفيذ** — بلا استطلاعٍ
       دوريٍّ ولا مؤقّت: **الإعلانُ يأتينا، ولا نسأل عنه.** */
    const offPlayback = onPlaybackChange(apply);
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
          pending = true;
          apply();
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
        return;
      }
      /* 🆕 **والخلفيّةُ أفضلُ لحظةٍ للتبديل** (D-749): **التطبيقُ لا
         يُشاهَد الآن** — **وتحديثٌ لا يراه أحدٌ هو التحديثُ المثاليّ.**
         **والمشغّلُ يقف عند الخلفيّة أصلاً** (D-729) **فترفع الرايةُ
         نفسَها ويقع التأجيلُ المعلَّق.** */
      apply();
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
      offPlayback();
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [build]);

  return null;
}
