"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * 🆕 **علاماتُ الأداء للغلاف الهجين** (Phase 11 · A0-prep) — **تسجيلٌ لا سلوك**.
 *
 * 🔑 **لماذا علامةٌ من الصفحة؟** `chrome://inspect` ينفصل قبل الإقلاع فلا يرى
 * «قتلُ العمليّة ⇢ أوّلُ محتوى»، و`onLoadEnd` في الغلاف يعني أنّ HTML وصل لا أنّ
 * المستخدمَ يرى شيئاً. فالصفحةُ تقول للغلاف **لحظةَ أوّلِ محتوىً رئيسيٍّ مرئيٍّ
 * وقابلٍ للّمس**، والغلافُ يقيس على **ساعته وحدَها** (monotonic) من `launchT0`.
 *
 * **تعريفُ «المحتوى»** (بوّابة المراجع، PR #19 `5575385379` §٣): ليس skeleton —
 * **≥ ٣ صورٍ مكتملةٍ داخل `<main>`** (`complete && naturalWidth > 0`) **وهذا
 * المكوّنُ نفسُه مرطَّب** (أثرُه يعمل بعد ترطيب جذر التطبيق، والشريطُ السفليُّ
 * جزءٌ من الجذر نفسِه). يُفحص بـ`requestAnimationFrame` حتى يتحقّق، أو تُبعث
 * `timeout` بعد ٨ ثوانٍ كي لا يغيب الرقمُ بصمت (D-063).
 *
 * `first-content` مرّةً لعمر الصفحة، و`route-content` لكلِّ تغييرِ مسارٍ بعدها
 * (Warm navigation في عقد المالك `5575346584`).
 *
 * ⚖️ **ولا شيءَ في المتصفّح**: الجسرُ لا يزرعه إلا الغلاف. ولا رسمَ في الحالين.
 */
const MIN_IMAGES = 3;
const TIMEOUT_MS = 8000;

export function PerfMarks() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.ReactNativeWebView : undefined;
    if (!bridge) return;
    const started = performance.now();
    const mark = first.current ? "first-content" : "route-content";
    first.current = false;
    let raf = 0;
    let done = false;
    const post = (ok: boolean, images: number) => {
      if (done) return;
      done = true;
      try {
        bridge.postMessage(
          JSON.stringify({
            type: "perf",
            mark: ok ? mark : `${mark}-timeout`,
            path: pathname,
            images,
            /* زمنُ الصفحة منذ تغيير المسار — مرجعٌ ثانويّ للمقارنة، لا يُطرح من ساعة الغلاف */
            sincePathChange: Math.round(performance.now() - started),
          }),
        );
      } catch {
        /* الفشلُ صمتٌ — أداةُ قياسٍ لا تُسقط صفحة */
      }
    };
    const tick = () => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("main img"));
      const ready = imgs.filter((i) => i.complete && i.naturalWidth > 0).length;
      if (ready >= MIN_IMAGES) return post(true, ready);
      if (performance.now() - started > TIMEOUT_MS) return post(false, ready);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      done = true;
    };
  }, [pathname]);
  return null;
}
