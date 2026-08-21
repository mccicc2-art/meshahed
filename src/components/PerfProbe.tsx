"use client";

/**
 * 🔴🔴 **بوّابةُ مسبارٍ مؤقّتة — تُحذف بانتهاء جولة قياس الأيفون.**
 *
 * هذا الملفُّ كلُّه **بوّابةٌ لا مقياس**، وحجمُه هو المقصود: ما يدخل
 * الحزمةَ الرئيسيّةَ لا يتجاوز هذه الأسطر. **والمقياسُ نفسُه في
 * `PerfProbePanel` ولا تُجلب حزمتُه إلا بعد الراية** — لأن المسبارَ
 * الذي يُوزَن معه ما يقيسه يفسد قياسَه (نقيس حجمَ الحزمة وزمنَ ترطيبها).
 *
 * وبلا الراية — **حرفيّاً**: لا `PerformanceObserver` ولا مستمعَ حدثٍ
 * واحدٍ ولا عقدةَ DOM ولا طلبَ شبكة. `useEffect` واحدٌ يقرأ
 * `localStorage` مرّةً ثم ينتهي، والمكوّنُ يعود `null`.
 *
 * ⚖️ **والحالةُ هنا بياناتٌ فقط — لا هويّةُ مكوّن.** كان المكوّنُ نفسُه
 * يُخزَّن في `useState` بعد `await import` (بقيّةُ محاولةٍ ملغاةٍ لتحديد
 * حزمة المسبار آليّاً)، **فكانت اللوحةُ تُعاد تركيبها فتُصفَّر حالتُها
 * وتُهمَل `setShown` فلا يُفتح التقرير.** الآن `dynamic` ثابتٌ على مستوى
 * الوحدة: هويّةٌ واحدةٌ لا تتغيّر، وحالةُ البوّابة رقمٌ واحدٌ لا أكثر.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

/* ثابتٌ على مستوى الوحدة — هويّةُ المكوّن لا تتبدّل بين الرسمات أبداً.
   و`ssr:false` يعني: لا يُرسم على الخادم فلا يتغيّر HTML لأحد، ولا
   تُجلب حزمتُه إلا حين يُرسم فعلاً — أي بعد الراية وحدَها. */
const PerfProbePanel = dynamic(() => import("./PerfProbePanel"), { ssr: false });

const FLAG = "lz_perf";

export function PerfProbe() {
  /** بياناتٌ فقط: لحظةُ الترطيب — و`null` تعني «لا راية، لا مسبار» */
  const [gate, setGate] = useState<{ hydratedAt: number } | null>(null);

  useEffect(() => {
    /* ⏱️ لحظةُ الترطيب تُلتقط هنا في الحزمة الرئيسيّة — **لا في اللوحة
       الكسولة**: تلك تصل بعد جلبِ حزمتها فتقيس زمنَ نفسِها لا زمنَ
       التطبيق. رقمٌ واحدٌ من `performance.now()`، بلا مستمعٍ ولا مراقب. */
    const hydratedAt = performance.now();

    /* لا setState في جسم التأثير (قاعدةُ React): مؤقّتٌ صفريٌّ يؤجّلها.
       ⚠️ **مؤقّتٌ لا `requestAnimationFrame` عمداً**: الإطاراتُ لا تُرسم
       في تبويبٍ خلفيّ، فبها كانت البوّابةُ لا تفتح إن أُقلع التطبيقُ في
       الخلفيّة — والمؤقّتُ يجري في الحالين. */
    const id = window.setTimeout(() => {
      let on = false;
      try {
        const v = new URLSearchParams(window.location.search).get("perf");
        if (v === "on") localStorage.setItem(FLAG, "1");
        else if (v === "off") localStorage.removeItem(FLAG);

        /*
         * iOS Home Screen Web Apps لا تشارك localStorage مع Safari،
         * والـmanifest يفتح التطبيق على `/` بلا query. لذلك تفعيل
         * `?perf=on` في Safari لا يصل إلى الـPWA المثبّت أصلًا.
         * خلال جولة القياس المؤقّتة فقط: الـstandalone نفسه يفتح البوابة
         * تلقائيًا. Safari/التصفح العادي يبقى خلف الراية كما كان.
         */
        const standalone =
          (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
          window.matchMedia("(display-mode: standalone)").matches;

        on = standalone || localStorage.getItem(FLAG) === "1";
      } catch {
        /* حتى لو منع iOS التخزين، الـstandalone نفسه يكفي لتفعيل المسبار */
        on =
          (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
          window.matchMedia("(display-mode: standalone)").matches;
      }
      if (on) setGate({ hydratedAt });
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  if (!gate) return null;
  return <PerfProbePanel hydratedAt={gate.hydratedAt} />;
}
