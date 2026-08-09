"use client";

import { useEffect, useRef, useState } from "react";

/**
 * سطرٌ يتحرّك ليُقرأ كاملاً (ملاحظة صديق أحمد على «لأنك تتابع…»:
 * «ثابت، ما أقدر أقراها كاملة — لو يتحرك ويطلعها كاملة أفضل»).
 *
 * القياس في العميل لا في CSS: لا وسيلة بالأنماط وحدها لمعرفة أن النص
 * فاض عن خانته — فنقيس `scrollWidth` مقابل عرض الحاوية، ولا نحرّك إلا
 * الفائض فعلاً: نصٌّ قصير يبقى ساكناً تماماً كما كان.
 *
 * الحركة ذهابٌ وإياب (alternate) بمهلة بدء، لا لفٌّ دائري: اللفّ يقصّ
 * النص لحظة القفزة، والذهاب والإياب يُبقيه مقروءاً طوال الطريق.
 * والاتجاه من `direction` المحسوبة فيعمل في RTL وLTR. ومن طلب تقليل
 * الحركة (prefers-reduced-motion) لا حركة له — يبقى السطر مقصوصاً
 * كما قبل، صادقاً مع تفضيله.
 */
export function MarqueeText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const measure = () => {
      const box = el.parentElement;
      if (!box) return;
      const dist = el.scrollWidth - box.clientWidth;
      if (dist <= 4) {
        setShift(null);
        return;
      }
      const rtl = getComputedStyle(box).direction === "rtl";
      setShift(`${rtl ? dist : -dist}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span className={`block overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={ref}
        className="inline-block will-change-transform"
        style={
          shift
            ? ({
                animation: "note-marquee 6s ease-in-out 1.5s infinite alternate",
                "--note-dist": shift,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </span>
  );
}
