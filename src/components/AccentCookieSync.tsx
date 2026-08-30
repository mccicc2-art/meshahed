"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncAccentCookie } from "@/lib/actions";

/**
 * 🆕 **جسرُ لونِ التمييز من الحساب إلى كوكي الجهاز** (D-825) — **توأم
 * `ThemeCookieSync` بحرفه.**
 *
 * **والحجّةُ حجّتُه**: التخطيطُ يقرأ اللونَ من كوكيٍّ لا من البروفايل
 * **لأنّ انتظارَ الجلسة والبروفايل يحبس أوّلَ بايتٍ للتطبيق كلِّه**
 * (D-122) — **فجهازٌ ثانٍ يهبط بلا كوكيّ يرى لونَ الثيم حتى يكتبه هذا
 * المكوّنُ مرّةً واحدة.**
 *
 * ⚠️ **ولمَ مكوّنٌ ثانٍ لا معاملٌ في الأوّل**: **`ThemeCookieSync` تعرف
 * ثيماً واسمَ كوكيّه وفعلَه** — **وتعميمُها يعني مكوّناً يأخذ ثلاثةَ
 * معاملاتٍ ليوفّر عشرةَ أسطر**، **والاسمُ العامُّ يخفي أيَّ تفضيلٍ
 * يُزامَن.** ✅ **والوصفةُ الحقيقيّةُ المشتركةُ مُستخرَجةٌ فعلاً**:
 * **`accentVars` واحدةٌ للتطبيق ولصفحة الزائر** — **وهي التي كانت
 * تفترق لو تُركت.**
 */
export function AccentCookieSync({ accent }: { accent: string }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith("accent="))
      ?.split("=")[1];
    if (current === accent) return;
    void syncAccentCookie(accent)
      .then(() => router.refresh())
      .catch(() => {});
  }, [accent, router]);

  return null;
}
