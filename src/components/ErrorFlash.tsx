"use client";

import { useEffect, useRef, useState } from "react";

/**
 * توست الخطأ العام — يُركَّب مرة واحدة في الـlayout.
 *
 * يستمع لحدث flashError ويعرض الرسالة شريطاً سفلياً فوق شريط التنقّل
 * ثم يختفي. رسالة واحدة في كل لحظة: الأحدث تحلّ محلّ الأقدم — سيلٌ من
 * التوستات أسوأ من الصمت.
 */
export function ErrorFlash() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onFlash(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (!detail) return;
      setMsg(detail);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 3500);
    }
    window.addEventListener("loopz:flash", onFlash);
    return () => {
      window.removeEventListener("loopz:flash", onFlash);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!msg) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 z-[70] flex justify-center px-4 pointer-events-none"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <p className="sheet-pop max-w-md rounded-2xl border border-[color:var(--error)]/40 bg-[color:var(--elevated)] px-4 py-2.5 text-sm text-red-200 shadow-2xl text-center">
        {msg}
      </p>
    </div>
  );
}
