"use client";

/**
 * 🔴🔴 **لوحةُ القياس المؤقّتة — تُحذف بانتهاء جولة الأيفون.**
 *
 * لا تُجلب حزمتُها ولا يُرسم منها شيءٌ إلا بعد راية `?perf=on`
 * (البوّابةُ في `PerfProbe.tsx`). وحين تعمل:
 * • **لا يغادر الرقمُ الجهاز**: لا `fetch` ولا `sendBeacon` ولا تخزينَ
 *   نتائج. كلُّه في الذاكرة، والنقلُ بزرِّ نسخٍ بيدِ صاحب الجهاز.
 * • **لا هويّةَ ولا سرّ**: لا `user_id` ولا كوكي ولا توكن ولا نصَّ
 *   محتوى. المسارُ `pathname` وحدَه — **و`search`/`hash` تُقصّان دائماً**
 *   لأنهما قد يحملان معرّفات.
 * • **ولا رقمَ مخترع**: كلُّ نوعٍ يُفحص بـ`supportedEntryTypes`، وغيرُ
 *   المدعوم يُكتب **«غير مدعوم»** نصّاً — لا صفراً، لأن صفراً يُقرأ
 *   «قِيس فكان ممتازاً» وهو كذب.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const FLAG = "lz_perf";

/** ما يدعمه هذا المتصفّح فعلاً — لا افتراضَ مسبقاً عن Safari */
function supported(type: string): boolean {
  try {
    const l = (PerformanceObserver as unknown as { supportedEntryTypes?: string[] })
      .supportedEntryTypes;
    return Array.isArray(l) && l.includes(type);
  } catch {
    return false;
  }
}

const ms = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;

/** آخرُ مقطعٍ من المسار بلا `?` و`#` — لا عنوانَ كاملاً في المخرجات */
function leaf(url: string): string {
  try {
    return new URL(url).pathname.split("/").pop() || "?";
  } catch {
    return url.split("?")[0].split("#")[0].split("/").pop() || "?";
  }
}

const NA = "غير مدعوم في هذا المتصفّح";

export default function PerfProbePanel({ hydratedAt }: { hydratedAt: number }) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<Record<string, unknown> | null>(null);
  const [gone, setGone] = useState(false);
  const acc = useRef<Record<string, unknown>>({});

  const build = useCallback((): Record<string, unknown> => {
    const d = acc.current;
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const paint = performance
      .getEntriesByType("paint")
      .find((p) => p.name === "first-contentful-paint");
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const js = res.filter((r) => leaf(r.name).endsWith(".js"));

    /* RSC: تنقّلُ App Router يجلب الحمولةَ من المسار نفسِه لا من ملفّ —
       فتُعدّ الطلباتُ التي ليست أصولاً ساكنةً ولا صوراً. تقديرٌ يُسمّى
       تقديراً: `_rsc` في الاستعلام لا يظهر في `name` دائماً. */
    const rsc = res.filter(
      (r) =>
        r.initiatorType === "fetch" &&
        !r.name.includes("/_next/static/") &&
        !r.name.includes("/_next/image"),
    ).length;

    /* شبكةٌ أم كاش؟ `deliveryType` صريحٌ حيث يوجد — وحيث لا يوجد نقول
       **إنه استدلال** ولا ندّعي يقيناً: نقلٌ صفريٌّ وجسمٌ غيرُ صفريّ. */
    const explicit = res.some(
      (r) => typeof (r as unknown as { deliveryType?: string }).deliveryType === "string",
    );
    const cached = res.filter((r) => {
      const dt = (r as unknown as { deliveryType?: string }).deliveryType;
      if (typeof dt === "string") return dt === "cache";
      return r.transferSize === 0 && r.decodedBodySize > 0;
    }).length;

    return {
      رحلة: (d.label as string) || "(بلا اسم — اضغط «تسمية»)",
      جهاز: {
        ua: navigator.userAgent.slice(0, 80),
        PWA:
          (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
          window.matchMedia("(display-mode: standalone)").matches,
        شاشة: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
        ذاكرة: NA,
      },
      مسار: window.location.pathname,
      تنقّل: nav
        ? {
            نوع: nav.type,
            TTFB: ms(nav.responseStart),
            FCP: paint ? ms(paint.startTime) : "لم يُسجَّل",
            DOMContentLoaded: ms(nav.domContentLoadedEventEnd),
            load: ms(nav.loadEventEnd),
          }
        : "لا navigation entry (تنقّلٌ داخليّ — أرقامُ التنقّل تخصّ أوّلَ تحميل)",
      LCP: d.LCP ?? d["largest-contentful-paint"] ?? "لم يُسجَّل بعد",
      CLS: d.CLS ?? d["layout-shift"] ?? NA,
      longTasks: d.longTasks ?? d["longtask"] ?? NA,
      أبطأ_حدث:
        typeof d["event"] === "string"
          ? d["event"]
          : { ms: d.slowestEventMs ?? null, نوع: d.slowestEventName ?? null, ملحوظة: "أقصى ما رُصد — ليس INP الرسميّ" },
      اكتمال_الترطيب_ms: ms(hydratedAt),
      أول_لمسة: d.firstTap ?? "لم تقع بعد",
      أول_تمرير: d.firstScroll ?? "لم يقع بعد",
      عودات_من_الخلفية: d.resumes ?? "لم تقع بعد",
      طلبات: {
        الكل: res.length,
        js: js.length,
        js_decoded_KB: +(js.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024).toFixed(0),
        RSC_تقديراً: rsc,
        من_الكاش: cached,
        مصدر_الحكم: explicit ? "deliveryType (صريح)" : "استدلالٌ من transferSize=0",
      },
    };
  }, [hydratedAt]);

  const refresh = useCallback(() => setView(build()), [build]);

  useEffect(() => {
    const obs: PerformanceObserver[] = [];
    const watch = (type: string, cb: (e: PerformanceEntry[]) => void) => {
      if (!supported(type)) {
        acc.current[type] = NA;
        return;
      }
      try {
        const o = new PerformanceObserver((l) => {
          cb(l.getEntries());
          refresh();
        });
        o.observe({ type, buffered: true } as PerformanceObserverInit);
        obs.push(o);
      } catch {
        acc.current[type] = NA;
      }
    };

    watch("largest-contentful-paint", (es) => {
      const last = es[es.length - 1];
      if (last) acc.current.LCP = ms(last.startTime);
    });

    watch("layout-shift", (es) => {
      let cls = (acc.current.CLS as number) || 0;
      for (const e of es) {
        const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!s.hadRecentInput) cls += s.value;
      }
      acc.current.CLS = +cls.toFixed(4);
    });

    watch("longtask", (es) => {
      const cur = (acc.current.longTasks as { count: number; totalMs: number }) ?? {
        count: 0,
        totalMs: 0,
      };
      for (const e of es) {
        cur.count += 1;
        cur.totalMs += Math.round(e.duration);
      }
      acc.current.longTasks = cur;
    });

    watch("event", (es) => {
      let worst = (acc.current.slowestEventMs as number) || 0;
      let name = (acc.current.slowestEventName as string) || "";
      for (const e of es) {
        if (e.duration > worst) {
          worst = Math.round(e.duration);
          name = e.name;
        }
      }
      acc.current.slowestEventMs = worst;
      acc.current.slowestEventName = name;
    });

    /* أوّلُ لمسة: تأخّرُ المعالج · الزمنُ حتى الرسم · **وهل سبقت الترطيب**
       (أي: ضغطتَ فلم يستجب شيء) — وهذا أدقُّ جوابٍ متاحٍ على سؤال
       «هل تنفيذُ الـJS يؤلم؟» ما دام `longtask` غائباً عن iOS. */
    const onTap = (ev: Event) => {
      if (acc.current.firstTap) return;
      const t = performance.now();
      const started = ev.timeStamp;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          acc.current.firstTap = {
            عند_ms: ms(t),
            تأخر_المعالج_ms: ms(t - started),
            حتى_الرسم_ms: ms(performance.now() - t),
            قبل_الترطيب: t < hydratedAt,
            ثوان_بعد_الترطيب: +((t - hydratedAt) / 1000).toFixed(2),
          };
          refresh();
        }),
      );
      window.removeEventListener("pointerdown", onTap, true);
    };
    window.addEventListener("pointerdown", onTap, true);

    const onScroll = () => {
      if (acc.current.firstScroll) return;
      const t = performance.now();
      requestAnimationFrame(() => {
        acc.current.firstScroll = {
          عند_ms: ms(t),
          حتى_الرسم_ms: ms(performance.now() - t),
          ثوان_بعد_الترطيب: +((t - hydratedAt) / 1000).toFixed(2),
        };
        refresh();
      });
      window.removeEventListener("scroll", onScroll, true);
    };
    window.addEventListener("scroll", onScroll, true);

    /* الرحلةُ ٢: العودةُ من الخلفيّة — لا تنقّلَ جديداً، فالمقياسُ
       الصادقُ متى صارت الشاشةُ مرئيّةً ومتى رُسم أوّلُ إطارٍ بعدها */
    const onVis = () => {
      if (document.visibilityState !== "visible") {
        acc.current.hiddenAt = performance.now();
        return;
      }
      const t = performance.now();
      requestAnimationFrame(() => {
        const hidden = acc.current.hiddenAt as number | undefined;
        const list = (acc.current.resumes as unknown[]) ?? [];
        list.push({
          أول_رسم_بعد_العودة_ms: ms(performance.now() - t),
          مكثت_في_الخلفية_ث: hidden ? +((t - hidden) / 1000).toFixed(1) : null,
        });
        acc.current.resumes = list.slice(-6);
        refresh();
      });
    };
    document.addEventListener("visibilitychange", onVis);

    const first = requestAnimationFrame(refresh);

    return () => {
      cancelAnimationFrame(first);
      obs.forEach((o) => o.disconnect());
      window.removeEventListener("pointerdown", onTap, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, hydratedAt]);

  if (gone || !view) return null;

  return (
    <div dir="rtl" style={box}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <strong style={{ color: "#7dd3fc" }}>مسبار مؤقّت</strong>
        <button onClick={() => setOpen((v) => !v)} style={btn}>
          {open ? "طيّ" : "فتح"}
        </button>
        <button
          onClick={() => {
            const txt = JSON.stringify(build(), null, 1);
            navigator.clipboard?.writeText(txt).catch(() => {
              const ta = document.createElement("textarea");
              ta.value = txt;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              ta.remove();
            });
          }}
          style={{ ...btn, background: "#0e7490" }}
        >
          نسخ
        </button>
        <button
          onClick={() => {
            const n = window.prompt("اسم الرحلة (١..٧):", "");
            if (n !== null) {
              acc.current.label = n;
              refresh();
            }
          }}
          style={btn}
        >
          تسمية
        </button>
        <button
          onClick={() => {
            try {
              localStorage.removeItem(FLAG);
            } catch {
              /* لا شيء */
            }
            setGone(true);
          }}
          style={{ ...btn, background: "#7f1d1d" }}
        >
          إيقاف
        </button>
      </div>
      {open && <pre style={pre}>{JSON.stringify(view, null, 1)}</pre>}
    </div>
  );
}

const box: React.CSSProperties = {
  position: "fixed",
  insetInlineStart: 8,
  bottom: 8,
  zIndex: 2147483647,
  maxWidth: "min(94vw, 420px)",
  maxHeight: "62vh",
  overflow: "auto",
  background: "rgba(10,12,16,.95)",
  color: "#e8eef7",
  font: "12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
  border: "1px solid #2b3442",
  borderRadius: 12,
  padding: 10,
  boxShadow: "0 8px 28px rgba(0,0,0,.5)",
};
const pre: React.CSSProperties = { margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" };
const btn: React.CSSProperties = {
  background: "#1f2937",
  color: "#e8eef7",
  border: "1px solid #374151",
  borderRadius: 8,
  padding: "4px 8px",
  font: "inherit",
};
