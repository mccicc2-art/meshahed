"use client";

import { useState } from "react";
import { getDict, type Dict, type Locale } from "@/core/i18n";

/**
 * لغة الواجهة داخل مكوّنات العميل التي لا تستقبل `locale` كخاصية
 * (حدود الأخطاء مثلاً). تُقرأ من `<html lang>` الذي يضبطه التخطيط.
 */
export function useUiLocale(): { locale: Locale; t: Dict } {
  const [locale] = useState<Locale>(() =>
    typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar",
  );
  return { locale, t: getDict(locale) };
}
