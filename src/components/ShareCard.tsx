"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * زرّ مشاركة بطاقة الإحصاءات.
 *
 * على الجوال تُشارَك الصورة نفسها عبر واجهة المشاركة الأصلية — لا رابطاً
 * يطلب من المستلم تسجيل دخول. وعلى المتصفّحات التي لا تدعمها تُنزَّل الصورة،
 * وهذا هو المسار الآمن دائماً: التوليد على الخادم والصورة ملفٌّ عادي بعده.
 */
export function ShareCard({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setError(null);
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
      setError(t.shareFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-3 flex items-center gap-3">
      <span className="grid place-items-center w-9 h-9 rounded-xl bg-surface-2 text-muted shrink-0">
        <Icon name="image" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{t.shareTitle}</span>
        <span className="block text-[11px] text-muted mt-0.5">
          {error ?? t.shareSub}
        </span>
      </span>
      <button
        onClick={share}
        disabled={busy}
        className="shrink-0 px-3 py-2 rounded-xl bg-accent text-[color:var(--on-accent)] text-xs font-bold hover:brightness-110 transition disabled:opacity-50"
      >
        {t.shareBtn}
      </button>
    </div>
  );
}
