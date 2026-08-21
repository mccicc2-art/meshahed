"use client";

/**
 * 🔴🔴 **بوّابةُ مسبارٍ مؤقّتة — تُحذف بانتهاء جولة قياس الأيفون.**
 *
 * هذا الملفُّ كلُّه **بوّابةٌ لا مقياس**، وحجمُه هو المقصود: ما يدخل
 * الحزمةَ الرئيسيّةَ لا يتجاوز هذه الأسطر. **والمقياسُ نفسُه في
 * `PerfProbePanel` ولا يُجلب إلا بعد الراية** — لأن المسبارَ الذي
 * يُوزَن معه ما يقيسه يفسد قياسَه (نحن نقيس حجمَ الحزمة وزمنَ ترطيبها).
 *
 * وبلا الراية — **حرفيّاً**: لا `PerformanceObserver` ولا مستمعَ حدثٍ
 * واحدٍ ولا عقدةَ DOM ولا طلبَ شبكة. `useEffect` واحدٌ يقرأ
 * `localStorage` مرّةً ثم ينتهي، والمكوّنُ يعود `null`.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

/* ssr:false — لا يُرسم على الخادم فلا يتغيّر HTML لأحدٍ إطلاقاً.
   والاستيرادُ كسولٌ: حزمتُه لا تُجلب إلا حين يُرسم فعلاً. */
const PerfProbePanel = dynamic(() => import("./PerfProbePanel"), { ssr: false });

const FLAG = "lz_perf";

export interface ProbeBaseline {
  hydratedAt: number;
  /** لحظةُ ما قبل بدء جلبِ حزمة اللوحة — بها يُعزل حِملُ المسبار */
  probeStartMs: number;
  /** أسماءُ حزم JS الموجودة **قبل** أن يتحرّك المسبار — خطُّ الأساس */
  baselineJs: string[];
}

export function PerfProbe() {
  const [base, setBase] = useState<ProbeBaseline | null>(null);

  useEffect(() => {
    /* ⏱️ لحظةُ الترطيب تُلتقط هنا في الحزمة الرئيسيّة — **لا في اللوحة
       الكسولة**: تلك تصل بعد جلبِ حزمتها فتقيس زمنَ نفسِها لا زمنَ
       التطبيق. رقمٌ واحدٌ من `performance.now()`، بلا مستمعٍ ولا مراقب. */
    const hydratedAt = performance.now();

    /* لا setState في جسم التأثير (قاعدةُ React): مؤقّتٌ صفريٌّ يؤجّلها،
       ويُلغى عند التفكيك فلا يبقى أثرٌ إن رُفع المكوّن باكراً.
       ⚠️ **مؤقّتٌ لا `requestAnimationFrame` عمداً**: الإطاراتُ لا تُرسم
       في تبويبٍ خلفيّ، فبها كانت البوّابةُ لا تفتح أصلاً إن أُقلع
       التطبيقُ في الخلفيّة — والمؤقّتُ يجري في الحالين. */
    const id = window.setTimeout(() => {
      let on = false;
      try {
        const v = new URLSearchParams(window.location.search).get("perf");
        if (v === "on") localStorage.setItem(FLAG, "1");
        else if (v === "off") localStorage.removeItem(FLAG);
        on = localStorage.getItem(FLAG) === "1";
      } catch {
        on = false; // تصفّحٌ خاصٌّ يمنع التخزين — المسبارُ ببساطةٍ لا يعمل
      }
      if (!on) return;

      /* 🔑 خطُّ الأساس يُلتقط **قبل** أن يبدأ جلبُ حزمة اللوحة (الجلبُ
         يبدأ بالرسم أدناه). كلُّ حزمةٍ جديدةٍ بعد هذه اللحظة مرشّحةٌ
         لأن تكون حِملَ المسبار — وبها يُطرح من أرقام التطبيق. */
      const baselineJs = performance
        .getEntriesByType("resource")
        .filter((r) => r.name.endsWith(".js"))
        .map((r) => r.name);

      setBase({ hydratedAt, probeStartMs: performance.now(), baselineJs });
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  if (!base) return null;
  return <PerfProbePanel base={base} />;
}
