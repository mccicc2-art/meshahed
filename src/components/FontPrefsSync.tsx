"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setFontPrefs } from "@/lib/actions";
import {
  FONT_UI_COOKIE,
  FONT_CONTENT_COOKIE,
  sanitizeFontSize,
} from "@/lib/fontPrefs";

/**
 * جسرُ حجم الخطّ من الحساب إلى كوكي الجهاز — توأم `ThemeCookieSync`.
 *
 * من اختار حجماً على جهازٍ ثم فتح حسابه على جهازٍ آخر، كوكي الجهاز
 * الجديد فارغ والحساب يعرف. هذا المكوّن يقارن مرةً واحدة: إن اختلف
 * الكوكي عن قيمة الحساب كتب قيمةَ الحساب وأنعش الصفحة — ثم لا يفعل
 * شيئاً. (ولا يُركَّب أصلاً قبل الهجرة 121: `Navbar` يشترط أن يكون
 * العمود موجوداً وغير فارغ، فلا يتنازع مع كوكي كتبه المستخدم للتوّ.)
 */
export function FontPrefsSync({ fontUi, fontContent }: { fontUi: string; fontContent: string }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const read = (name: string) =>
      document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${name}=`))
        ?.split("=")[1];
    const ui = sanitizeFontSize(fontUi);
    const content = sanitizeFontSize(fontContent);
    const cookieUi = sanitizeFontSize(read(FONT_UI_COOKIE));
    const cookieContent = sanitizeFontSize(read(FONT_CONTENT_COOKIE));
    if (cookieUi === ui && cookieContent === content) return;
    /* كوكي مكتوبٌ يعني اختياراً على هذا الجهاز لم يبلغ الحساب (فشلت
       كتابة القاعدة يومها) — لا يُداس؛ الغائبُ وحده يُهاجَر إليه. */
    if (read(FONT_UI_COOKIE) || read(FONT_CONTENT_COOKIE)) return;
    void setFontPrefs(ui, content)
      .then(() => router.refresh())
      .catch(() => {});
  }, [fontUi, fontContent, router]);

  return null;
}
