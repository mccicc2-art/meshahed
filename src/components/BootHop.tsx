"use client";

import { useEffect } from "react";

/** D-1090 — حزامُ صفحة الإقلاع: الغلافُ يبدّلها إلى `/` بعد أوّل ردِّ جلسة؛ وإن لم يفعل في ستّ
    ثوانٍ (رسالةٌ ضاعت) تبدّل نفسَها — `replace` لا `href` كي لا تدخل التاريخ. */
export function BootHop() {
  useEffect(() => {
    const id = setTimeout(() => window.location.replace("/"), 6000);
    return () => clearTimeout(id);
  }, []);
  return null;
}
