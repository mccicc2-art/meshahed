"use client";

import { useRef } from "react";
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
}: {
  children: React.ReactNode;
  prevLabel: string;
  nextLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function go(sign: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: sign * el.clientWidth * 0.85, behavior: "smooth" });
  }

  const btn =
    "hidden sm:grid place-items-center absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full " +
    "bg-black/55 border border-white/15 text-white backdrop-blur-sm transition " +
    "opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100 hover:bg-black/75";

  return (
    <div className="relative group/rail">
      <div
        ref={ref}
        className="-mx-4 px-4 scroll-px-4 overflow-x-auto overscroll-x-contain snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-3 w-max pb-1">{children}</div>
      </div>

      {/* فيزيائيان لا منطقيان — left/right لا start/end عمداً */}
      <button
        type="button"
        aria-label={prevLabel}
        onClick={() => go(-1)}
        className={`${btn} left-0 -translate-x-1/3`}
      >
        <Icon name="chevron-down" size={18} className="rotate-90" />
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        onClick={() => go(1)}
        className={`${btn} right-0 translate-x-1/3`}
      >
        <Icon name="chevron-down" size={18} className="-rotate-90" />
      </button>
    </div>
  );
}
