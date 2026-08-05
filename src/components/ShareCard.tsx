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
    <div
      className="rounded-3xl p-[1.5px]"
      style={{
        background:
          "linear-gradient(135deg, var(--accent), var(--accent-2) 55%, var(--brand-3))",
      }}
    >
      <div className="rounded-[calc(1.5rem-1.5px)] bg-[color:var(--background)] p-3 sm:p-4">
        {/* معاينة حيّة: الصورة نفسها التي ستُشارَك، مولّدةً من الخادم */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/share"
          alt={t.shareTitle}
          loading="lazy"
          className="w-full rounded-xl border border-border bg-surface-2"
          style={{ aspectRatio: "1200 / 630" }}
        />

        <div className="flex items-center gap-3 mt-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t.shareTitle}</span>
            <span className="block text-[11px] text-muted mt-0.5">
              {error ?? t.shareSub}
            </span>
          </span>
          <button
            onClick={share}
            disabled={busy}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-[color:var(--on-accent)] text-xs font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-50"
          >
            <Icon name="share" size={15} />
            {t.shareBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
