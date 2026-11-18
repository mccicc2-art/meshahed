"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/core/i18n";

/**
 * قصة العمل مطويّة على خمسة أسطر.
 *
 * القصص الطويلة كانت تدفع الأنواع والترايلر شاشةً كاملة لأسفل — ومن يقرأ
 * السطرين الأولين عرف إن كان يريد البقيّة. النصّ القصير يُعرض كاملاً بلا زر.
 */
export function ReadMore({ text, locale, short = false }: { text: string; locale: Locale; /** 🆕 R267 — ثلاثةُ أسطرٍ لا خمسة (نبذةُ الممثّل بجانب اسمه على الحاسوب) */ short?: boolean }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const long = text.length > 260;

  return (
    <div>
      <p
        className={`text-sm text-muted leading-relaxed whitespace-pre-line ${
          long && !open ? (short ? "line-clamp-3" : "line-clamp-5") : ""
        }`}
      >
        {text}
      </p>
      {long && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 text-14 font-bold text-accent hover:brightness-110 transition"
        >
          {open ? t.readLess : t.readMore}
        </button>
      )}
    </div>
  );
}
