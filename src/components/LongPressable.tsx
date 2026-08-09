"use client";

import { useRef } from "react";
import { tap } from "@/lib/haptics";

/**
 * غلاف الضغطة المطوّلة — إجراءٌ ثانٍ فوق بطاقةٍ هي رابط.
 *
 * وُلد في المكتبة (ورقة الإجراءات السريعة) ثم احتاجته بطاقة الاقتراح
 * («غير مهتم» بالضغط المطول — م٢ من تقييم 9 Aug)، فانتُزع مكوّناً
 * مشتركاً: نمطٌ واحد عائلةٌ واحدة (قاعدة ٦).
 *
 * ٤٥٠ مللي ثانية بلا حركةٍ تُطلق الإجراء وتبتلع النقرة التالية حتى لا
 * يفتح الرابط. التحرّك أكثر من ١٠ بكسل يُلغي — فالتمرير يبقى تمريراً.
 */
export function LongPressable({
  onLongPress,
  children,
}: {
  onLongPress: () => void;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }

  return (
    <div
      className="select-none"
      style={{ WebkitTouchCallout: "none" }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          fired.current = true;
          // اهتزازة خفيفة تؤكّد أن الضغطة «مسكت» — حيث يدعمها الجهاز
          tap(12);
          onLongPress();
        }, 450);
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        const dx = e.clientX - origin.current.x;
        const dy = e.clientY - origin.current.y;
        if (dx * dx + dy * dy > 100) clear();
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onClickCapture={(e) => {
        if (fired.current) {
          e.preventDefault();
          e.stopPropagation();
          fired.current = false;
        }
      }}
    >
      {children}
    </div>
  );
}
