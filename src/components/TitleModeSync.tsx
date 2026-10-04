"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncTitleModeCookie } from "@/lib/actions";
import { TITLE_MODE_COOKIE, parseTitleMode, type TitleMode } from "@/core/titleMode";

/**
 * 🆕 D-1269 — **اختيارُ «أسماء العناوين» ينزل من الحساب إلى هذا الجهاز** — توأمُ `ThemeCookieSync`.
 *
 * الخادمُ يقرأ الكوكي لا الحساب (رحلةُ قاعدةٍ على كلِّ مسارٍ يحمل اسمَ عملٍ ثمنٌ لا يُدفع لتفضيل
 * عرض)، فالحسابُ يُنسخ إلى الكوكي حين يختلفان: أوّلَ دخولٍ على جهازٍ جديد، أو بعد تغييرٍ جرى على
 * جهازٍ آخر. **مرّةً واحدةً ثمّ لا يفعل شيئاً** — والمقارنةُ بعد `parseTitleMode`: كوكيٌّ غائبٌ
 * يساوي الافتراض، فمن حسابُه على الافتراض لا يُحدَّث له شيء.
 */
export function TitleModeSync({ mode }: { mode: TitleMode }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TITLE_MODE_COOKIE}=`))
      ?.split("=")[1];
    if (parseTitleMode(current) === mode) return;
    void syncTitleModeCookie(mode)
      .then(() => router.refresh())
      .catch(() => {});
  }, [mode, router]);

  return null;
}
