"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncThemeCookie } from "@/lib/actions";

/**
 * جسر انتقال الثيم إلى الكوكي.
 *
 * الـ layout كان ينتظر جلسةً وبروفايلاً (~رحلتين لقاعدة البيانات) قبل أول
 * بكسل — فقط ليعرف الثيم. صار يقرأه من كوكي فورياً؛ وهذا المكوّن يكتب
 * الكوكي لمن اختار ثيمه قبل هذا التغيير: مرة واحدة ثم لا يفعل شيئاً.
 */
export function ThemeCookieSync({ theme }: { theme: string }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith("theme="))
      ?.split("=")[1];
    if (current === theme) return;
    void syncThemeCookie(theme)
      .then(() => router.refresh())
      .catch(() => {});
  }, [theme, router]);

  return null;
}
