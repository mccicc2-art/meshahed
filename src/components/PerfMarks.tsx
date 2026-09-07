"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * 🆕 **علاماتُ الأداء للغلاف الهجين** (Phase 11 · A0-prep) — **تسجيلٌ لا سلوك**.
 *
 * 🔑 **لماذا علامةٌ من الصفحة؟** `chrome://inspect` ينفصل قبل الإقلاع فلا يرى
 * «قتلُ العمليّة ⇢ أوّلُ محتوى»، و`onLoadEnd` في الغلاف يعني أنّ HTML وصل لا أنّ
 * المستخدمَ يرى شيئاً. فالصفحةُ تقول للغلاف **لحظةَ أوّلِ محتوىً رئيسيٍّ مرئيٍّ
 * وقابلٍ للّمس**، والغلافُ يقيس على **ساعته وحدَها** (monotonic).
 *
 * **تعريفُ «المحتوى»** (بوّابةُ المراجع `5575385379` §٣ ثمّ `5576037708` §٢):
 * (أ) **أوّلُ رفٍّ ظاهر** — أوّلُ `<section>` في `<main>` يحمل صوراً؛ (ب) **≥ ٣ من
 * صوره تتقاطع مع viewport** (`getBoundingClientRect`) **ومكتملةٌ ومفكوكةٌ**
 * (`complete && naturalWidth > 0` ثمّ `await img.decode()`); (ج) **الشريطُ
 * السفليُّ مرسومٌ فعلاً** (`nav` بارتفاعٍ > ٠ داخل viewport) — لا الاستدلالُ
 * بأنّه في الجذر نفسِه؛ (د) **لا هيكلَ (`animate-pulse`) داخل ذلك الرفّ**.
 * ليس skeleton ولا `onLoadEnd`.
 *
 * ⚠️ **والمسبارُ لا يشوّه ما يقيسه** (`5576037708` §١): **لا مسحَ في كلِّ إطار.**
 * الفحصُ حدثيّ — `MutationObserver` على `<main>` (childList/subtree) وأحداثُ
 * `load`/`error` على صور الرفّ الأوّل، مع خانقٍ إلى إطارٍ واحدٍ لكلِّ دفعةِ
 * أحداث — **ويتوقّف كلُّه فور العلامة.** `timeout` بعد ٨ ثوانٍ كي لا يغيب
 * الرقمُ بصمت (D-063).
 *
 * `first-content` مرّةً لعمر الصفحة، و`route-content` لكلِّ تغييرِ مسارٍ بعدها.
 * ⚖️ **ولا شيءَ في المتصفّح**: الجسرُ لا يزرعه إلا الغلاف. ولا رسمَ في الحالين.
 */
const MIN_IMAGES = 3;
const TIMEOUT_MS = 8000;

function inViewport(r: DOMRect): boolean {
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
}

/** أوّلُ رفٍّ يحمل صوراً — أو `<main>` نفسُه إن لم تكن الصفحةُ رفوفاً (صفحةُ العمل) */
function firstRail(main: HTMLElement): HTMLElement {
  for (const s of Array.from(main.querySelectorAll<HTMLElement>("section"))) {
    if (s.querySelector("img")) return s;
  }
  return main;
}

export function PerfMarks() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.ReactNativeWebView : undefined;
    if (!bridge) return;
    const started = performance.now();
    const mark = first.current ? "first-content" : "route-content";
    first.current = false;
    let done = false;
    let scheduled = 0;
    let checking = false;
    const listened = new WeakSet<HTMLImageElement>();
    const mo = new MutationObserver(() => schedule());
    const main = document.querySelector("main");

    const post = (ok: boolean, images: number) => {
      if (done) return;
      done = true;
      cleanup();
      try {
        bridge.postMessage(
          JSON.stringify({
            type: "perf",
            mark: ok ? mark : `${mark}-timeout`,
            path: pathname,
            images,
            /* زمنُ الصفحة منذ تغيير المسار — مرجعٌ ثانويّ، لا يُطرح من ساعة الغلاف */
            sincePathChange: Math.round(performance.now() - started),
          }),
        );
      } catch {
        /* الفشلُ صمتٌ — أداةُ قياسٍ لا تُسقط صفحة */
      }
    };

    const check = async () => {
      if (done || checking || !main) return;
      checking = true;
      try {
        const rail = firstRail(main);
        const imgs = Array.from(rail.querySelectorAll<HTMLImageElement>("img"));
        for (const i of imgs) {
          if (!listened.has(i)) {
            listened.add(i);
            i.addEventListener("load", schedule, { once: true });
            i.addEventListener("error", schedule, { once: true });
          }
        }
        const visible = imgs.filter((i) => i.complete && i.naturalWidth > 0 && inViewport(i.getBoundingClientRect()));
        const nav = document.querySelector("nav");
        const navShown = !!nav && nav.getBoundingClientRect().height > 0 && inViewport(nav.getBoundingClientRect());
        const skeleton = !!rail.querySelector(".animate-pulse");
        if (visible.length >= MIN_IMAGES && navShown && !skeleton) {
          /* `decode()` يضمن أنّ البكسلات جاهزةٌ للرسم لا أنّ البايتات وصلت فقط */
          await Promise.all(visible.slice(0, MIN_IMAGES).map((i) => i.decode().catch(() => undefined)));
          if (!done) post(true, visible.length);
        }
      } finally {
        checking = false;
      }
    };
    /* خانقٌ: دفعةُ أحداثٍ = فحصٌ واحدٌ في الإطار التالي */
    const schedule = () => {
      if (done || scheduled) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = 0;
        void check();
      });
    };
    const timer = window.setTimeout(() => {
      if (!done && main) post(false, Array.from(firstRail(main).querySelectorAll("img")).length);
    }, TIMEOUT_MS);
    const cleanup = () => {
      mo.disconnect();
      window.clearTimeout(timer);
      if (scheduled) cancelAnimationFrame(scheduled);
    };

    if (main) mo.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "class"] });
    schedule();
    return () => {
      done = true;
      cleanup();
    };
  }, [pathname]);
  return null;
}
