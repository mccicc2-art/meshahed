"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getDict, type Locale } from "@/core/i18n";
import { posterUrl } from "@/core/media";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { segmentedItem, segmentedTrackFull } from "./ui/controls";
import type { HistoryCardPayload } from "@/core/contracts/profile";

/**
 * ====== 🆕 «شارك سجلّك» في الويب — توأمُ `HistoryShareSheet` في التطبيق ======
 *
 * المدّةُ (أسبوعٌ من الأحد أو شهرٌ من يومه الأوّل)، ثمّ أعمالُها بترتيب البطاقة ومفتاحٌ لكلٍّ منها («٣أ»)، ثمّ «شارك البطاقة». الصورةُ
 * من `/api/share?kind=history` وتُشارَك ملفّاً (`navigator.share`) أو تُنزَّل — وصفةُ `ShareCard`.
 */
export function HistoryShareSheet({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const t = getDict(locale);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [data, setData] = useState<HistoryCardPayload | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/v1/me/history-card?p=${period}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { data?: HistoryCardPayload }) => live && setData(j.data ?? { period, range: "", titles: [] }))
      .catch(() => live && setError(t.shareFailed));
    return () => {
      live = false;
    };
  }, [period, t.shareFailed]);

  const titles = data?.titles ?? [];
  const shown = titles.filter((x) => !hidden.has(x.key));

  async function share() {
    if (busy || !shown.length) return;
    setBusy(true);
    setError(null);
    try {
      const hide = [...hidden].join(",");
      const res = await fetch(`/api/share?kind=history&p=${period}${hide ? `&hide=${encodeURIComponent(hide)}` : ""}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], "loopz-history.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
      if (nav.share && nav.canShare?.({ files: [file] })) await nav.share({ files: [file], title: "Loopz" });
      else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "loopz-history.png";
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
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} variant="bottom" labelledBy="history-share-title">
      <SheetHeader id="history-share-title" title={t.historyShareTitle} closeLabel={t.closeLabel} onClose={onClose} />
      <div className="px-5 pb-5 space-y-3">
        <div className={segmentedTrackFull} role="tablist">
          {(["week", "month"] as const).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => {
                if (p === period) return;
                /* مدّةٌ أخرى: ما أُخفي في الأولى ليس قرارَ الثانية */
                setPeriod(p);
                setData(null);
                setHidden(new Set());
                setError(null);
              }} className={segmentedItem(period === p, "flex-1")}>
              {p === "week" ? t.historyShareWeek : t.historyShareMonth}
            </button>
          ))}
        </div>
        {data?.range ? <p className="text-13 text-muted">{`${data.range} · ${t.historyShareHint}`}</p> : null}
        {!data ? (
          <p className="text-sm text-muted text-center py-8">{t.shareBusy}</p>
        ) : !titles.length ? (
          <p className="text-sm text-muted text-center py-8">{t.historyShareEmpty}</p>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto">
            {titles.map((x) => {
              const on = !hidden.has(x.key);
              const src = posterUrl(x.poster_path, "w185");
              return (
                <li key={x.key}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() =>
                      setHidden((h) => {
                        const n = new Set(h);
                        if (n.has(x.key)) n.delete(x.key);
                        else n.add(x.key);
                        return n;
                      })
                    }
                    className={`w-full flex items-center gap-3 min-h-14 py-1.5 text-start ${on ? "" : "opacity-50"}`}
                  >
                    <span className="relative block w-[34px] aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-surface-2">
                      {src ? <Image src={src} alt="" fill sizes="34px" className="object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-15 font-semibold">{x.title}</b>
                      {x.key === shown[0]?.key ? <span className="text-12 font-bold text-accent">{t.historyShareHero}</span> : null}
                    </span>
                    {/* مفتاحُ `RailsPrefs` بالبكسل — لا مفتاحَ ثانياً */}
                    <span aria-hidden className={`shrink-0 h-5 w-9 rounded-full transition relative ${on ? "bg-accent" : "bg-border"}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[color:var(--background)] transition-all ${on ? "start-[18px]" : "start-0.5"}`} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error ? <p className="text-13 text-[color:var(--error)]">{error}</p> : null}
        <Button full onClick={() => void share()} disabled={busy || !shown.length}>
          {busy ? t.shareBusy : t.historyShareCta}
        </Button>
      </div>
    </Sheet>
  );
}
