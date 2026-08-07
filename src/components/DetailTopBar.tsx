"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { SendShareSheet } from "./SendShareSheet";
import { toast as showToast } from "@/lib/toast";

/**
 * زرّان عائمان فوق خلفية صفحة العمل: رجوع وقائمة «المزيد».
 *
 * زجاجيان ودائريان كي يُقرآ فوق أي صورة مهما كان لونها، وبقطر لمس ٤٤
 * بكسلاً. «المزيد» صار قائمةً لا فعلاً واحداً: نسخ/مشاركة الرابط كما كان،
 * و«أرسِله لـ…» يفتح منتقي صديقٍ من المتابَعين المتبادلين (shares.sql).
 * أُبقيت مشاركة النظام لأنها الطريق خارج التطبيق، وأُضيف الإرسال الداخليّ
 * إلى جانبها لا بدلاً منها.
 */
export function DetailTopBar({
  title,
  locale,
  tmdbId,
  mediaType,
  posterPath,
}: {
  title: string;
  locale: Locale;
  tmdbId: number;
  mediaType: MediaType;
  posterPath: string | null;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [send, setSend] = useState(false);

  async function shareLink() {
    setMenu(false);
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
      showToast(t.linkCopied);
    } catch {
      /* متصفّح بلا حافظة — لا رسالة تفيد هنا */
    }
  }

  // ٤٤ بكسلاً — الحدّ الأدنى المريح لهدف لمسٍ في زاوية الشاشة
  const btn =
    "w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 " +
    "grid place-items-center text-white/90 active:scale-95 transition";

  const menuItem =
    "w-full flex items-center gap-3 px-5 py-3.5 text-start text-[15px] hover:bg-surface-2 transition";

  return (
    <>
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-3">
        <button onClick={() => router.back()} aria-label={t.backAria} className={btn}>
          <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
        </button>

        <button
          onClick={() => setMenu(true)}
          aria-label={t.moreMenuTitle}
          title={t.moreMenuTitle}
          className={btn}
        >
          <Icon name="dots" size={18} />
        </button>
      </div>

      {/* قائمة «المزيد» — ورقةٌ سفلية تلامس الإبهام على الجوال */}
      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        closeLabel={t.closeLabel}
        variant="bottom"
        labelledBy="more-menu-title"
      >
        <p id="more-menu-title" className="text-center font-bold text-[15px] pt-5 pb-2">
          {t.moreMenuTitle}
        </p>
        <div className="pb-3">
          <button
            onClick={() => {
              setMenu(false);
              setSend(true);
            }}
            className={menuItem}
          >
            <Icon name="person-check" size={18} className="text-accent" />
            {t.shareSendTitle}
          </button>
          <button onClick={shareLink} className={menuItem}>
            <Icon name="share" size={18} className="text-muted" />
            {t.shareCopyLink}
          </button>
        </div>
      </Sheet>

      {send && (
        <SendShareSheet
          tmdbId={tmdbId}
          mediaType={mediaType}
          title={title}
          posterPath={posterPath}
          locale={locale}
          onClose={() => setSend(false)}
        />
      )}
    </>
  );
}
