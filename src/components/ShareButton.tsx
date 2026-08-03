"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * زرّ المشاركة في الترويسة.
 *
 * نفس بطاقة الإحصاءات المولّدة على الخادم، لكن بأيقونة وحدها: الترويسة
 * ضيّقة ولا تحتمل بطاقة كاملة. وعلى الجوال تُشارَك الصورة عبر واجهة النظام،
 * وعلى غيره تُنزَّل.
 */
export function ShareButton({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [busy, setBusy] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/share");
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], "loopz.png", { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Loopz" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "loopz.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // فشل المشاركة لا يستحقّ إنذاراً في الترويسة — الزرّ يرجع لحاله
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={share}
      disabled={busy}
      aria-label={t.headerShare}
      title={t.headerShare}
      className="w-9 h-9 grid place-items-center text-white/90 hover:text-white transition disabled:opacity-50"
    >
      <Icon name="share" size={17} />
    </button>
  );
}
