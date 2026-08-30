"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setTimezone } from "@/lib/actions";

/**
 * **جسرُ المنطقة الزمنيّة من الجهاز إلى الحساب** (D-806) — رابعُ
 * التوائم في `AccountSync`.
 *
 * 🔑 **والاتّجاهُ واحدٌ عكسَ أخواته**: الثيمُ وحجمُ الخطّ **تفضيلٌ
 * يختاره القارئ فينزل من حسابه إلى جهازه** — **والمنطقةُ حقيقةُ جهازٍ
 * تصعد إلى الحساب**، **لأنّ الخادمَ هو الذي يحتاجها** (التقريرُ
 * والإحصائيّاتُ والصورةُ المشارَكة تُحسب كلُّها هناك).
 *
 * ⚠️ **ولا يُكتب إلّا ما تغيّر**: من سافر تتغيّر منطقتُه فيُكتب الجديدُ
 * مرّةً — **ومن لم تتغيّر منطقتُه لا يدفع نداءً في كلِّ صفحة.**
 * ⚠️ **والفشلُ صامت**: **تقريرٌ بتوقيت غرينتش خيرٌ من شاشةِ خطأ.**
 */
export function TimezoneSync({ saved }: { saved: string | null }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let here = "";
    try {
      here = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return;
    }
    if (!here || here === saved) return;
    void setTimezone(here)
      .then(() => router.refresh())
      .catch(() => {});
  }, [saved, router]);

  return null;
}
