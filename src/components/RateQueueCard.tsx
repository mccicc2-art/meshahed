"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { updateUiState } from "@/lib/actions";
import { posterUrl } from "@/core/media";
import { getDict, num, type Locale } from "@/core/i18n";
import { RATE_CARD_SNOOZE_MS, type RateQueueItem } from "@/core/rateQueue";

/**
 * ====== 🆕 T530 — بابا «بانتظار تقييمك» في الويب: سطرُ «تقييماتي» والمكتبة، وبطاقةُ الرئيسيّة ======
 *
 * توأما `apps/mobile/src/member/rateQueue.tsx` و`apps/mobile/src/home/RateQueueCard.tsx` بشكلهما: السطرُ نجمةٌ في مربّعٍ
 * مُلوَّن واسمٌ وسطرُه وعددٌ في حبّة (أحمد «٢أ»)، والبطاقةُ ملصقان صغيران و«N بانتظار تقييمك» و«آخرها …» وزرُّ «قيّم» و✕
 * يُخفيها أسبوعاً (أحمد «٢»). العددُ والظهورُ يحسبهما الخادم (`getRateQueue`) — هنا الرسمُ وحدَه.
 */

export const RATE_QUEUE_HREF = "/ratings/pending";

export function RateQueueEntryLink({ total, locale, className = "" }: { total: number; locale: Locale; className?: string }) {
  if (!total) return null;
  const t = getDict(locale);
  return (
    <Link
      href={RATE_QUEUE_HREF}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:bg-surface-2 transition-colors ${className}`}
    >
      <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-accent/15 text-accent">
        <Icon name="star" size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-15 font-bold">{t.rateQueueTitle}</b>
        <span className="block truncate text-12 text-muted mt-0.5">{t.rateQueueSub}</span>
      </span>
      <span className="min-w-[34px] h-[26px] px-2.5 grid place-items-center rounded-full bg-accent text-on-accent text-[calc(13px*var(--fs))] font-extrabold tabular-nums" dir="ltr">
        {num(total, locale)}
      </span>
      <Icon name="chevron-down" size={18} className="text-muted -rotate-90 rtl:rotate-90" />
    </Link>
  );
}

export function RateQueueHomeCard({ total, first, locale }: { total: number; first: RateQueueItem[]; locale: Locale }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || !first.length) return null;
  const t = getDict(locale);
  const hide = () => {
    setHidden(true);
    /* فشلُ الحفظ يعيدها — إخفاءٌ لا يُحفظ يرجع في الفتحة التالية، فلا نَعِد بأسبوعٍ لم يُكتب */
    updateUiState({ rateCard: new Date(Date.now() + RATE_CARD_SNOOZE_MS).toISOString() })
      .then((r) => {
        if (!r.ok) setHidden(false);
      })
      .catch(() => setHidden(false));
  };
  return (
    <div className="relative flex items-center gap-3 rounded-2xl bg-surface p-3">
      <Link href={RATE_QUEUE_HREF} aria-label={t.rateQueueCardTitle(num(total, locale))} className="absolute inset-0 rounded-2xl" />
      <span className="flex shrink-0" aria-hidden>
        {first.slice(0, 2).map((it, i) => {
          const src = posterUrl(it.poster_path, "w185");
          return (
            <span
              key={`${it.kind}-${it.id}`}
              className={`relative block w-10 h-[60px] overflow-hidden rounded-lg border-2 border-surface bg-surface-2 ${i > 0 ? "-ms-4" : ""}`}
              style={{ zIndex: 2 - i }}
            >
              {src ? <Image src={src} alt="" fill sizes="40px" className="object-cover" /> : null}
            </span>
          );
        })}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-15 font-extrabold">{t.rateQueueCardTitle(num(total, locale))}</b>
        <span className="block truncate text-12 text-muted mt-0.5">{t.rateQueueCardLast(first[0].title)}</span>
      </span>
      <span className="pointer-events-none shrink-0 h-8 px-3.5 grid place-items-center rounded-full bg-accent text-on-accent text-14 font-extrabold">
        {t.rateQueueCardCta}
      </span>
      <button type="button" onClick={hide} aria-label={t.rateQueueHideCard} className="relative z-10 grid place-items-center w-7 h-7 text-muted hover:text-foreground">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
