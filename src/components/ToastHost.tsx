"use client";

import { useEffect, useRef, useState } from "react";
import { TOAST_EVENT, type ToastPayload } from "@/lib/toast";

/**
 * مضيف الرسائل العابرة — يُركَّب مرّةً في الـlayout.
 *
 * رسالةٌ واحدة في الشاشة: الأحدث تحلّ محلّ سابقتها بدل أن تتكدّس فوقها.
 * وموضعه فوق الشريط السفلي بحساب المنطقة الآمنة حتى لا يختفي نصفه خلف
 * شريط الإيماءات في iOS.
 */

const TONE: Record<ToastPayload["tone"], string> = {
  error: "border-[color:var(--error)]/40 text-[color:var(--error)]",
  success: "border-[color:var(--success)]/40 text-[color:var(--success)]",
  info: "border-border text-foreground",
};

export function ToastHost() {
  const [item, setItem] = useState<ToastPayload | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      if (!detail?.message) return;
      if (timer.current) clearTimeout(timer.current);
      setItem(detail);
      timer.current = setTimeout(() => setItem(null), detail.duration);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!item) return null;

  return (
    <div
      className="fixed inset-x-0 z-[70] flex justify-center px-4 pointer-events-none"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <div
        role={item.tone === "error" ? "alert" : "status"}
        className={`sheet-pop pointer-events-auto flex items-center gap-3 max-w-md rounded-full border bg-[color:var(--elevated)] ps-4 pe-2 py-2.5 shadow-2xl ${TONE[item.tone]}`}
      >
        {/* `dir="auto"`: الرسالة العربية تُقرأ من اليمين و«S2 E15 ✓» من
            اليسار — فتلتصق العلامة بطرفها الصحيح في الحالتين */}
        <span dir="auto" className="text-sm">
          {item.message}
        </span>
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.run();
              setItem(null);
            }}
            className="shrink-0 px-3 py-1 rounded-full text-xs font-bold bg-surface-2 text-foreground hover:brightness-125 transition"
          >
            {item.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
