"use client";

/**
 * 🔴🔴 **لوحةُ القياس المؤقّتة — تُحذف بانتهاء جولة الأيفون.**
 *
 * لا تُجلب حزمتُها ولا يُرسم منها شيءٌ إلا بعد راية `?perf=on`
 * (البوّابةُ في `PerfProbe.tsx`). وحين تعمل:
 * • **لا يغادر الرقمُ الجهاز**: لا `fetch` ولا `sendBeacon` ولا تخزينَ
 *   نتائج. كلُّه في الذاكرة، والنقلُ بزرِّ نسخٍ بيدِ صاحب الجهاز.
 * • **لا هويّةَ ولا سرّ**: لا `user_id` ولا كوكي ولا توكن ولا نصَّ
 *   محتوى. المسارُ `pathname` وحدَه — **و`search`/`hash` تُقصّان دائماً**.
 * • **ولا رقمَ مخترع**: كلُّ نوعٍ يُفحص بـ`supportedEntryTypes`، وغيرُ
 *   المدعوم يُكتب **«غير مدعوم»** نصّاً — لا صفراً.
 *
 * ⚖️ **وثلاثةُ قيودٍ تمنع المسبارَ من تلويث ما يقيسه:**
 * ١) **لا لوحةَ تُرسم تلقائيّاً** — نقطةٌ `fixed` وحدَها، بلا نصٍّ ولا
 *    صورةٍ ولا خلفيّةٍ مصوَّرة، **فلا تصلح مرشَّحاً لـLCP**، و`fixed` لا
 *    يحجز مساحةً فلا إزاحةَ تخطيط.
 * ٢) **لمسُ المسبار ليس «أوّلَ لمسة»** — كلُّ حدثٍ منشؤه داخل جذر
 *    المسبار يُتجاهل **ولا يُنهي الرصد**، فتبقى أوّلُ لمسةٍ لمسةَ Loopz.
 * ٣) 🔴 **ولا طرحَ آليّاً لحِمل المسبار.** جُرِّبت ثلاثُ طرقٍ للتحديد
 *    (نافذةٌ زمنيّة · `import.meta.url` — يُسقطه المُجمِّع · قوسٌ حول
 *    الاستيراد) **وكلُّها التقطت حزمةَ تطبيقٍ ٢٤٧ك.ب وسكربتَ Speed
 *    Insights معها**: الثلاثةُ تبدأ في ٦ مللي ثانيةٍ متجاورة
 *    و`initiatorType` فيها جميعاً `script` — فلا إشارةَ تفصل. **فيُعرض
 *    الخامُ كما هو، ويُذكر حِملُ اللوحة رقماً معلَناً من مخرجات البناء،
 *    ولا يُعرض «صافٍ» لا يمكن إثباتُه.** رقمٌ خاطئٌ أسوأُ من رقمٍ غائب.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const FLAG = "lz_perf";
const NA = "غير مدعوم في هذا المتصفّح";
/** حجمُ حزمة هذه اللوحة — **من مخرجات `next build`**، لا من تخمينِ اسم */
const PANEL_CHUNK_KB = 8;

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

export default function PerfProbePanel({ hydratedAt }: { hydratedAt: number }) {
  const [shown, setShown] = useState(false); // 🔑 اللوحةُ لا تُعرض إلا بطلبك
  const [view, setView] = useState<Record<string, unknown> | null>(null);
  const [tapped, setTapped] = useState(false);
  const [gone, setGone] = useState(false);
  const acc = useRef<Record<string, unknown>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);

  const build = useCallback((): Record<string, unknown> => {
    const d = acc.current;
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const paint = performance
      .getEntriesByType("paint")
      .find((p) => p.name === "first-contentful-paint");

    /* إزالةُ التكرار بالاسم: المورد نفسُه قد يُسجَّل مرّتين */
    const seen = new Set<string>();
    const res = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(
      (r) => (seen.has(r.name) ? false : (seen.add(r.name), true)),
    );
    const jsAll = res.filter((r) => leaf(r.name).endsWith(".js"));

    /* RSC: تنقّلُ App Router يجلب حمولتَه من المسار نفسِه لا من ملفّ.
       تقديرٌ يُسمّى تقديراً. */
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
          : {
              ms: d.slowestEventMs ?? null,
              نوع: d.slowestEventName ?? null,
              ملحوظة: "أقصى ما رُصد — ليس INP الرسميّ",
            },
      اكتمال_الترطيب_ms: ms(hydratedAt),
      أول_لمسة: d.firstTap ?? "لم تقع بعد",
      أول_تمرير: d.firstScroll ?? "لم يقع بعد",
      عودات_من_الخلفية: d.resumes ?? "لم تقع بعد",
      موارد_خام: {
        js_حزم: jsAll.length,
        js_decoded_KB: +(jsAll.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024).toFixed(1),
        كل_الطلبات: res.length,
        RSC_تقديراً: rsc,
        من_الكاش: cached,
        مصدر_الحكم: explicit ? "deliveryType (صريح)" : "استدلالٌ من transferSize=0",
        ملحوظة: "خامٌ غيرُ منقوص — يشمل حزمةَ المسبار أدناه",
      },
      حِمل_المسبار_معلَن: {
        حزمةُ_اللوحة_KB: PANEL_CHUNK_KB,
        مصدرُ_الرقم: "مخرجاتُ next build — لا تخمينَ اسمِ حزمةٍ مُجزّأة",
        لماذا_لا_يُطرح_آليّاً:
          "لا إشارةَ زمنٍ ولا نوعِ مُنشئٍ تفصل حزمةَ المسبار عن حزم التطبيق المتأخّرة — والطرحُ بالتخمين يفسد الرقم",
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
        const o = new PerformanceObserver((l) => cb(l.getEntries()));
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

    /** حدثٌ منشؤه داخل المسبار؟ إذاً ليس تفاعلاً مع Loopz */
    const mine = (ev: Event) => {
      const t = ev.target;
      return !!rootRef.current && t instanceof Node && rootRef.current.contains(t);
    };

    const onTap = (ev: Event) => {
      if (acc.current.firstTap || mine(ev)) return;
      const t = performance.now();
      const started = ev.timeStamp;
      /* 🔑 يُسجَّل **فوراً** لا داخل إطار: المستمعُ يُرفع في السطر التالي،
         فلو انتظرنا إطاراً لا يأتي ضاع القياسُ بلا رجعة ولا حدثَ ثانٍ
         يعوّضه. زمنُ الرسم وحدَه يُضاف إن جاء الإطار. */
      const rec: Record<string, unknown> = {
        عند_ms: ms(t),
        تأخر_المعالج_ms: ms(t - started),
        حتى_الرسم_ms: "لم يصل إطارٌ بعد",
        قبل_الترطيب: t < hydratedAt,
        ثوان_بعد_الترطيب: +((t - hydratedAt) / 1000).toFixed(2),
      };
      acc.current.firstTap = rec;
      window.removeEventListener("pointerdown", onTap, true);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          rec.حتى_الرسم_ms = ms(performance.now() - t);
          setTapped(true);
        }),
      );
    };
    window.addEventListener("pointerdown", onTap, true);

    const onScroll = (ev: Event) => {
      if (acc.current.firstScroll || mine(ev)) return; // تمريرُ اللوحة ليس تمريرَ الصفحة
      const t = performance.now();
      const rec: Record<string, unknown> = {
        عند_ms: ms(t),
        حتى_الرسم_ms: "لم يصل إطارٌ بعد",
        ثوان_بعد_الترطيب: +((t - hydratedAt) / 1000).toFixed(2),
      };
      acc.current.firstScroll = rec;
      window.removeEventListener("scroll", onScroll, true);
      requestAnimationFrame(() => {
        rec.حتى_الرسم_ms = ms(performance.now() - t);
      });
    };
    window.addEventListener("scroll", onScroll, true);

    const onVis = () => {
      if (document.visibilityState !== "visible") {
        acc.current.hiddenAt = performance.now();
        return;
      }
      const t = performance.now();
      const hidden = acc.current.hiddenAt as number | undefined;
      const rec: Record<string, unknown> = {
        أول_رسم_بعد_العودة_ms: "لم يصل إطارٌ بعد",
        مكثت_في_الخلفية_ث: hidden ? +((t - hidden) / 1000).toFixed(1) : null,
      };
      const list = (acc.current.resumes as unknown[]) ?? [];
      list.push(rec);
      acc.current.resumes = list.slice(-6);
      requestAnimationFrame(() => {
        rec.أول_رسم_بعد_العودة_ms = ms(performance.now() - t);
      });
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      obs.forEach((o) => o.disconnect());
      window.removeEventListener("pointerdown", onTap, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hydratedAt]);

  if (gone) return null;

  return (
    <div ref={rootRef}>
      {/* النقطة: `fixed` فلا تحجز مساحةً ولا تُزيح شيئاً · بلا نصٍّ ولا
          صورةٍ ولا خلفيّةٍ مصوَّرة · ١٤px — **فلا تصلح مرشَّحاً لـLCP**.
          لونُها وحدَه يقول: باهتةٌ حتى تُلتقط أوّلُ لمسة، ثم تُضيء. */}
      {!shown && (
        /* 🔑 **مساحةُ لمسٍ ٤٤px شفّافة، ونقطةٌ مرئيّةٌ ١٤px داخلها.**
           النقطةُ وحدَها كانت أصغرَ من أدنى هدفِ لمسٍ في iOS (٤٤px)
           وفي ركنٍ يزاحمه مؤشّرُ الشاشة الرئيسيّة — **فكانت لا تُلمس
           بإصبع.** الحدُّ الشفّافُ يحلُّ ذلك بلا أن يكبر المرئيّ:
           لا نصَّ ولا صورةَ ولا خلفيّةً مصوَّرة **فلا مرشَّحَ لـLCP**،
           و`fixed` فلا مساحةَ محجوزةٌ ولا إزاحةَ تخطيط. */
        <button
          type="button"
          aria-label="فتح تقرير المسبار"
          onClick={() => {
            setView(build());
            setShown(true);
          }}
          style={{
            position: "fixed",
            insetInlineStart: 0,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
            zIndex: 2147483647,
            width: 44,
            height: 44,
            padding: 0,
            border: 0,
            background: "transparent",
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "block",
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,.35)",
              background: tapped ? "#22d3ee" : "#6b7280",
              opacity: 0.85,
            }}
          />
        </button>
      )}

      {shown && view && (
        <div dir="rtl" style={box}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <strong style={{ color: "#7dd3fc" }}>مسبار</strong>
            <button
              type="button"
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
              type="button"
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
            <button type="button" onClick={() => setShown(false)} style={btn}>
              إغلاق
            </button>
            <button
              type="button"
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
          <pre style={pre}>{JSON.stringify(view, null, 1)}</pre>
        </div>
      )}
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
