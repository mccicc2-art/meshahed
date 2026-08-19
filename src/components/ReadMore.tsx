"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * قصة العمل مطويّة على خمسة أسطر.
 *
 * القصص الطويلة كانت تدفع الأنواع والترايلر شاشةً كاملة لأسفل — ومن يقرأ
 * السطرين الأولين عرف إن كان يريد البقيّة. النصّ القصير يُعرض كاملاً بلا زر.
 */
export function ReadMore({ text, locale }: { text: string; locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const long = text.length > 260;

  return (
    <div>
      <p
        className={`text-sm text-muted leading-relaxed whitespace-pre-line ${
          long && !open ? "line-clamp-5" : ""
        }`}
      >
        {text}
      </p>
      {long && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 text-[14px] font-bold text-accent hover:brightness-110 transition"
        >
          {open ? t.readLess : t.readMore}
        </button>
      )}
    </div>
  );
}
