"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/**
 * حاوية تمرير الصفّ + سهما سطح المكتب (طلب أحمد: «أسهم عشان أقدر أشوف
 * القائمة كاملة»).
 *
 * على الجوال السحب باللمس طبيعي والأسهم ضجيج — فتظهر من sm فأعلى فقط،
 * وعند مرور المؤشر على الصفّ (المكان الذي رسمه أحمد بدائرتيه في طرفي
 * الصفّ). زرّا الطرفين فيزيائيان — الأيسر يمرّر يساراً والأيمن يميناً —
 * فيعملان في RTL وLTR بلا فرع: scrollBy بالإشارة نفسها في الاتجاهين.
 * السهمان من chevron-down المُدار (لا رمز جديد في العائلة — D-002).
 */
export function RailScroll({
  children,
  prevLabel,
  nextLabel,
  mouseDrag = false,
}: {
  children: React.ReactNode;
  prevLabel: string;
  nextLabel: string;
  /** 🆕 R256 — **السحبُ بالفأرة** (أحمد ١٨ نوفمبر عن المكتبة: «لازم يقدر يتنقل لبقية القسم سواء بسهم او هولد ويحرك»):
      يمسك الصفَّ ويحرّكه كالإصبع. اختياريٌّ لصفوف المكتبة وحدها اليوم — بقيّةُ الصفوف كما كانت */
  mouseDrag?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /* 🆕 R256 — **السهمُ يغيب عند طرفه**: سهمٌ يُضغط ولا يتحرّك شيءٌ يُقرأ عطلاً. فيزيائيّان كالزرّين: `canL` = في اليسار
     بقيّة. وفي RTL يقيس Chrome `scrollLeft` من صفرٍ نزولاً، فالمسافةُ من البداية `-scrollLeft` */
  const [edge, setEdge] = useState({ canL: true, canR: true });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const rtl = getComputedStyle(el).direction === "rtl";
    const from = rtl ? -el.scrollLeft : el.scrollLeft;
    const canL = rtl ? from < max - 2 : from > 2;
    const canR = rtl ? from > 2 : from < max - 2;
    setEdge((e) => (e.canL === canL && e.canR === canR ? e : { canL, canR }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  /* السحبُ: يبدأ بعد ٥px (ضغطةٌ عاديّةٌ تبقى ضغطةً تفتح الملصق)، والالتقاطُ يُطفأ أثناءه وإلا قاوم اليد، والنقرةُ التي تنهي
     سحباً تُبتلع فلا يُفتح ملصقٌ لم يُقصد. للفأرة وحدها — اللمسُ يسحب بنفسه */
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const swallow = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mouseDrag || e.pointerType !== "mouse" || e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 5) return;
    if (!d.moved) {
      d.moved = true;
      el.style.scrollSnapType = "none";
      el.style.cursor = "grabbing";
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = d.left - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d?.moved || !el) return;
    swallow.current = true;
    el.style.cursor = "";
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    /* الالتقاطُ يعود بعد أن يستقرّ الصفّ — فيقف على حافّة ملصق */
    requestAnimationFrame(() => {
      el.style.scrollSnapType = "";
    });
  };

  function go(sign: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: sign * el.clientWidth * 0.85, behavior: "smooth" });
  }

  /* **ظاهرةٌ في السكون لا عند المرور وحده** (بلاغ أحمد ٩ Aug: «حتى
     السلاسل الطويلة ما فيها سهم عشان تتصفّحها»): كانت `opacity-0` حتى
     يمرّ المؤشر — وأداةٌ لا تُرى لا توجد. الآن ٦٥٪ في السكون وكاملةٌ عند
     المرور، فتُعرف قبل أن تُجرَّب.

     ولا `translate` خارج الحاوية: كانت تُدفع ثُلثاً إلى الخارج فتُقصّ عند
     حافّة الشاشة على المقاسات الضيّقة — تجلس الآن على حافّة الصفّ داخله. */
  const btn =
    "hidden sm:grid place-items-center absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full " +
    "bg-black/60 border border-white/15 text-white backdrop-blur-sm transition " +
    "opacity-65 group-hover/rail:opacity-100 focus-visible:opacity-100 hover:bg-black/80";

  return (
    <div className="relative group/rail">
      {/* 🆕 T398 — `data-rail-*` مقابضُ الشبكة على الحاسوب (`.lz-deskgrid` في `globals.css`) — لا أثرَ لها في غيره */}
      <div
        ref={ref}
        data-rail-scroller=""
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (swallow.current) {
            swallow.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={mouseDrag ? (e) => e.preventDefault() : undefined}
        className={`-mx-4 px-4 scroll-px-4 overflow-x-auto overscroll-x-contain snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${mouseDrag ? "sm:cursor-grab select-none" : ""}`}
      >
        <div data-rail-track="" className="flex gap-3 w-max pb-1">{children}</div>
      </div>

      {/* فيزيائيان لا منطقيان — left/right لا start/end عمداً */}
      <button
        type="button"
        aria-label={prevLabel}
        data-rail-arrow=""
        onClick={() => go(-1)}
        hidden={!edge.canL}
        className={`${btn} left-0`}
      >
        <Icon name="chevron-down" size={18} className="rotate-90" />
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        data-rail-arrow=""
        onClick={() => go(1)}
        hidden={!edge.canR}
        className={`${btn} right-0`}
      >
        <Icon name="chevron-down" size={18} className="-rotate-90" />
      </button>
    </div>
  );
}
