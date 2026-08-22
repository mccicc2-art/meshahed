"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * 🔬 **مسبارُ تشخيصٍ مؤقّت — يُحذف بعد جولة «Navigation Flicker»**
 * (٢٢ أغسطس ٢٠٢٦، بلاغُ أحمد: «المحتوى يظهر ثم يرمش ثم يظهر مرّةً
 * ثانية» — **والرمشةُ لا تُعاد إنتاجُها على سطح المكتب**: قِيست ثلاثُ
 * وجهاتٍ فكان لكلٍّ منها **التزامٌ واحد**، فالسببُ في الجهاز نفسِه).
 *
 * **لا يرسم شيئاً ولا يقيس شيئاً إلا بطلبٍ صريح**: يُفعَّل بفتح
 * `‎/?diag=nav` ويُطفأ بـ`‎?diag=off`، والرايةُ في `sessionStorage`
 * فتعيش عمرَ التبويب وحدَه — **فمن لم يكتبها لا يُركَّب له شيء**
 * (`return null` قبل أيِّ عمل).
 *
 * **وما يجيب عنه بالضبط** — أيُّ السيناريوهات الخمسة يقع:
 * - `docs` يزيد مع كلِّ نقرة ⇒ **تنقّلٌ كاملُ المستند** لا عميليّ.
 * - `splash` > 0 ⇒ **شاشةُ الإقلاع عادت** فوق التطبيق (وهي الطبقةُ
 *   الوحيدةُ المعتمة في التطبيق كلِّه — `#lz-launch`).
 * - `skel` ⇒ هيكلُ `loading.tsx` استبدل المحتوى، ورقمُه متى ظهر ومتى غاب.
 * - `imgs` يهبط إلى صفرٍ ثم يعود ⇒ **الشجرةُ رُكِّبت من جديد**.
 * - `det` ⇒ عنصرُ `<img>` بعينه خرج من الشجرة (إعادةُ تركيبٍ لا إعادةُ
 *   ترميز)، **و`src≠`** ⇒ المصدرُ نفسُه تبدّل تحت الصورة.
 *
 * **ويُقرأ من الشاشة**: لوحةٌ صغيرةٌ فوق الدوك، `pointer-events:none`
 * فلا تعترض لمسةً — يصوّرها أحمد ويرسلها.
 */

type Frame = {
  path: string;
  docs: number;
  firstFrame: number;
  splash: number;
  skelOn: number;
  skelOff: number;
  imgsFirst: number;
  imgsMax: number;
  imgsZeroAfter: number;
  detached: number;
  srcChanged: number;
};

const KEY = "loopz:diag:nav";
const DOCS = "loopz:diag:docs";

function read(k: string): string | null {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
function write(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* تصفّحٌ خاص — المسبارُ يصمت ولا يكسر شيئاً */
  }
}

/* **التفعيلُ وعدُّ المستندات يجريان مرّةً لكلِّ وثيقة** — على مستوى
   الوحدة عمداً: **العدّادُ نفسُه هو الجواب** عن سؤال «هل النقرةُ تنقّلٌ
   عميليٌّ أم تحميلٌ كامل»، فلا يصحّ أن يُعلَّق بأثرٍ يعيد التشغيل. */
if (typeof window !== "undefined") {
  const q = new URLSearchParams(window.location.search).get("diag");
  if (q === "nav") write(KEY, "1");
  if (q === "off") write(KEY, "0");
  if (read(KEY) === "1") write(DOCS, String(Number(read(DOCS) ?? "0") + 1));
}

const subscribe = () => () => {};
const snapshot = () => read(KEY) === "1";
const serverSnapshot = () => false;

export function NavDiag() {
  const pathname = usePathname();
  /* الخادمُ يرسم `null` دائماً، والعميلُ يقرأ الراية — بلا فرقِ ترطيب */
  const on = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [rows, setRows] = useState<Frame[]>([]);

  useEffect(() => {
    if (!on) return;
    const main = document.getElementById("main");
    if (!main) return;

    const t0 = performance.now();
    const f: Frame = {
      path: pathname,
      docs: Number(read(DOCS) ?? "0"),
      firstFrame: -1,
      splash: 0,
      skelOn: -1,
      skelOff: -1,
      imgsFirst: -1,
      imgsMax: 0,
      imgsZeroAfter: -1,
      detached: -1,
      srcChanged: -1,
    };
    let tracked: HTMLImageElement | null = null;
    let trackedSrc = "";
    let raf = 0;
    let stop = false;

    const sample = () => {
      if (stop) return;
      const n = Math.round(performance.now() - t0);
      if (f.firstFrame < 0) f.firstFrame = n;

      const l = document.getElementById("lz-launch");
      if (l) {
        const o = Number(getComputedStyle(l).opacity) || 0;
        if (o > f.splash) f.splash = Math.round(o * 100) / 100;
      }

      const skel = !!main.querySelector(".skeleton");
      if (skel && f.skelOn < 0) f.skelOn = n;
      if (!skel && f.skelOn >= 0 && f.skelOff < 0) f.skelOff = n;

      const imgs = main.querySelectorAll("img");
      if (imgs.length > f.imgsMax) f.imgsMax = imgs.length;
      if (imgs.length > 0 && f.imgsFirst < 0) f.imgsFirst = n;
      if (imgs.length === 0 && f.imgsFirst >= 0 && f.imgsZeroAfter < 0) f.imgsZeroAfter = n;

      if (!tracked && imgs.length > 0) {
        tracked = imgs[0] as HTMLImageElement;
        trackedSrc = tracked.currentSrc || tracked.src || "";
      } else if (tracked) {
        if (f.detached < 0 && !document.contains(tracked)) f.detached = n;
        const now = tracked.currentSrc || tracked.src || "";
        if (f.srcChanged < 0 && now && trackedSrc && now !== trackedSrc) f.srcChanged = n;
      }

      if (n < 8000) raf = requestAnimationFrame(sample);
      else setRows((r) => [f, ...r].slice(0, 4));
    };
    raf = requestAnimationFrame(sample);
    /* لقطةٌ مبكّرة أيضاً، فلو غادر المستخدمُ قبل الثماني ثوانٍ بقي السطر */
    const early = window.setTimeout(() => setRows((r) => [f, ...r.slice(0, 3)]), 3000);

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(early);
    };
  }, [on, pathname]);

  if (!on) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        insetInlineStart: 6,
        bottom: 88,
        zIndex: 9999,
        pointerEvents: "none",
        maxWidth: "94vw",
        background: "rgba(0,0,0,.82)",
        color: "#7CFF9B",
        font: "10px/1.45 ui-monospace,monospace",
        padding: "6px 8px",
        borderRadius: 8,
        whiteSpace: "pre",
        direction: "ltr",
        textAlign: "left",
      }}
    >
      {rows.length === 0
        ? "diag: navigate to see a row"
        : rows
            .map(
              (r) =>
                `${r.path} docs=${r.docs} splash=${r.splash} skel=${r.skelOn}/${r.skelOff}` +
                ` imgs=${r.imgsFirst}..${r.imgsMax} zero@${r.imgsZeroAfter} det=${r.detached} src≠=${r.srcChanged}`,
            )
            .join("\n")}
    </div>
  );
}
