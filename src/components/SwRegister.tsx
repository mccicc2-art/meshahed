"use client";

import { useEffect } from "react";

/**
 * تسجيل الـService Worker — لا يرسم شيئاً.
 *
 * في الإنتاج فقط: أثناء التطوير يخلط الكاش بين نسخ البناء ويصنع أشباحاً.
 * التسجيل بعد load حتى لا يزاحم تنزيلَ ما تحتاجه الصفحة الأولى.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* الكاش تحسين لا التزام */
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
