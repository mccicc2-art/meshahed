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

import { useEffect, useState, type ComponentType } from "react";

const FLAG = "lz_perf";

export interface ProbeBaseline {
  hydratedAt: number;
  /** عناوينُ الحزم التي جلبها استيرادُ اللوحة **وحدَه** — انظر أدناه */
  probeChunks: string[];
  /** هل نجح التحديدُ القاطع؟ إن لا، لا يُطرح شيءٌ ويُقال ذلك */
  exact: boolean;
}

const jsUrls = () =>
  performance
    .getEntriesByType("resource")
    .filter((r) => r.name.endsWith(".js"))
    .map((r) => r.name);

export function PerfProbe() {
  const [Panel, setPanel] = useState<ComponentType<{ base: ProbeBaseline }> | null>(null);
  const [base, setBase] = useState<ProbeBaseline | null>(null);

  useEffect(() => {
    /* ⏱️ لحظةُ الترطيب تُلتقط هنا في الحزمة الرئيسيّة — **لا في اللوحة
       الكسولة**: تلك تصل بعد جلبِ حزمتها فتقيس زمنَ نفسِها لا زمنَ
       التطبيق. رقمٌ واحدٌ من `performance.now()`، بلا مستمعٍ ولا مراقب. */
    const hydratedAt = performance.now();
    let alive = true;

    /* لا setState في جسم التأثير (قاعدةُ React): مؤقّتٌ صفريٌّ يؤجّلها.
       ⚠️ **مؤقّتٌ لا `requestAnimationFrame` عمداً**: الإطاراتُ لا تُرسم
       في تبويبٍ خلفيّ، فبها كانت البوّابةُ لا تفتح إن أُقلع التطبيقُ في
       الخلفيّة — والمؤقّتُ يجري في الحالين. */
    const id = window.setTimeout(async () => {
      let on = false;
      try {
        const v = new URLSearchParams(window.location.search).get("perf");
        if (v === "on") localStorage.setItem(FLAG, "1");
        else if (v === "off") localStorage.removeItem(FLAG);
        on = localStorage.getItem(FLAG) === "1";
      } catch {
        on = false; // تصفّحٌ خاصٌّ يمنع التخزين — المسبارُ ببساطةٍ لا يعمل
      }
      if (!on || !alive) return;

      /* 🔑 **تحديدُ حِمل المسبار بقوسٍ محكم، لا بنافذةٍ ولا باسمٍ مخمَّن.**
         نستوردُ اللوحةَ بأنفسنا بدل `next/dynamic` لنملك اللحظتين:
         قائمةُ الحزم قبل الاستيراد مباشرةً، ثم بعد أن يَعِدَ بالحلّ —
         **والفرقُ بينهما هو ما جلبه هذا الاستيرادُ وحدَه.**
         (المحاولةُ الأولى كانت «كلُّ ما ظهر بعد لحظةٍ ما» فالتقطت حزمةَ
         تطبيقٍ ٢٤٧ك.ب وسكربتَ Speed Insights، ثم `import.meta.url`
         فأسقطه المُجمِّع — وهذا القوسُ يعمل في كلِّ الأحوال.) */
      const before = new Set(jsUrls());
      let mod: { default: ComponentType<{ base: ProbeBaseline }> } | null = null;
      try {
        mod = await import("./PerfProbePanel");
      } catch {
        return; // تعذّر جلبُ اللوحة — لا مسبارَ ولا أثر
      }
      const probeChunks = jsUrls().filter((u) => !before.has(u));
      if (!alive) return;

      setBase({ hydratedAt, probeChunks, exact: probeChunks.length > 0 });
      setPanel(() => mod!.default);
    }, 0);

    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, []);

  if (!Panel || !base) return null;
  return <Panel base={base} />;
}
