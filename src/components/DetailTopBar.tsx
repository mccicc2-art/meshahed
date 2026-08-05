"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * زرّان عائمان فوق خلفية صفحة العمل: رجوع وقائمة «المزيد».
 *
 * زجاجيان ودائريان كي يُقرآ فوق أي صورة مهما كان لونها، وبقطر لمس ٤٠
 * بكسلاً. «المزيد» يحمل المشاركة: مشاركة النظام إن وُجدت، وإلا نسخ
 * الرابط مع توست صغير — لا نافذة ولا نموذج.
 */
export function DetailTopBar({ title, locale }: { title: string; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [toast, setToast] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // أغلق المستخدم ورقة المشاركة — ليس خطأً
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast(true);
      setTimeout(() => setToast(false), 2200);
    } catch {}
  }

  // ٤٤ بكسلاً — الحدّ الأدنى المريح لهدف لمسٍ في زاوية الشاشة
  const btn =
    "w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 " +
    "grid place-items-center text-white/90 active:scale-95 transition";

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-3">
      <button onClick={() => router.back()} aria-label={t.backAria} className={btn}>
        <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
      </button>

      <button onClick={share} aria-label={t.shareLinkLabel} title={t.shareLinkLabel} className={btn}>
        <Icon name="dots" size={18} />
      </button>

      {toast && (
        <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] inset-x-0 z-50 flex justify-center pointer-events-none">
          <span className="sheet-pop bg-[color:var(--elevated)] border border-white/10 text-sm px-4 py-2.5 rounded-full shadow-xl">
            {t.linkCopied} ✓
          </span>
        </div>
      )}
    </div>
  );
}
