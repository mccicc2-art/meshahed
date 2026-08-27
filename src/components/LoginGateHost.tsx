"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetHeader } from "@/components/ui/Sheet";
import { GoogleButton } from "@/components/GoogleButton";
import { LOGIN_GATE_EVENT } from "@/lib/loginGate";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * مضيف بوّابة الزائر — يُركَّب مرّةً في الـlayout كمضيف التوست (D-627
 * مرحلة ٢).
 *
 * زائرٌ لمس فعلَ كتابةٍ (متابعة، تقييم، ردّ) لا يُطرد إلى صفحة الدخول
 * ولا يُوبَّخ بتوست خطأ: تُفتح له الورقةُ الموحّدة (`Sheet` — لا ورقةَ
 * ثانية، قاعدة النظام) وفيها زرُّ الدخول نفسُه، **ويعود بعد الدخول إلى
 * الصفحة التي كان فيها** (`next` — مساره الحاليّ) لا إلى الجذر: البوّابةُ
 * قاطعت فعلَه في منتصف قراءة، وإضاعةُ مكانه عقوبةٌ على حماسه.
 *
 * الحدثُ نافذةٌ لا سياقُ React — نفسُ عمارة التوست: يعمل من أيّ مكوّنٍ
 * مهما عمق، بلا مزوّدٍ مشترك.
 */
export function LoginGateHost({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(LOGIN_GATE_EVENT, show);
    return () => window.removeEventListener(LOGIN_GATE_EVENT, show);
  }, []);

  if (!open) return null;

  return (
    <Sheet open onClose={() => setOpen(false)} closeLabel={t.closeLabel} variant="center" labelledBy="login-gate-title">
      <SheetHeader id="login-gate-title" title={t.loginGateTitle} closeLabel={t.closeLabel} onClose={() => setOpen(false)} />
      <div className="px-5 pt-3 pb-5 flex flex-col gap-4">
        <p className="text-14 text-muted leading-relaxed">{t.loginGateHint}</p>
        {/* زرُّ الدخول نفسُه لا نسخةٌ عنه — والعودةُ إلى الصفحة الحاليّة */}
        <GoogleButton locale={locale} next={pathname || "/"} />
      </div>
    </Sheet>
  );
}
