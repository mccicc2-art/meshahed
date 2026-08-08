"use client";

import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * زر الرجوع الموحّد — هيئة زرّ DetailTopBar حرفاً بحرف (نفس القياس
 * والخلفية والسهم)، لأن الرجوع بابٌ واحد في كل صفحة تفصيلية: كان في
 * صفحات الأعمال وغائباً عن ملف الشخص (شكوى أحمد — تدقيق 8 Aug، م٣).
 */
export function BackButton({ locale, className = "" }: { locale: Locale; className?: string }) {
  const router = useRouter();
  const t = getDict(locale);
  return (
    <button
      onClick={() => router.back()}
      aria-label={t.backAria}
      className={`w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 grid place-items-center text-white/90 active:scale-95 transition ${className}`}
    >
      <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
    </button>
  );
}
