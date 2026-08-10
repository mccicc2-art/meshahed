"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { getDict, num, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { openTitleRoom } from "@/lib/actions";

/**
 * بابُ غرفة نقاش العمل — في تبويب التعليقات، فوق تقييمي (D-140).
 *
 * **صفٌّ واحد بحالتين لا زرٌّ واحد يكذب:** إن وُجدت غرفة فهو رابطٌ يقول
 * كم فيها من الناس؛ وإن لم توجد فهو زرُّ «ابدأ غرفة النقاش» يولدها عند
 * الضغط (الميلاد الكسول — هجرة 53). الفرق مقصود: «افتح غرفةً فيها ١٢
 * عضواً» و«كن أوّل من يفتحها» وعدان مختلفان، ودمجُهما في نصٍّ واحد هو
 * كيف تُولد الغرف الفارغة التي قرّرنا ألّا نبنيها.
 *
 * ولا يُنشئ شيئاً بمجرّد فتح الصفحة: الاهتمام ضغطةٌ لا زيارة.
 */
export function TitleRoomLink({
  tmdbId,
  mediaType,
  room,
  locale,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  /** الغرفة إن وُجدت — تُقرأ على الخادم في نفس دفعة صفحة العمل */
  room: { id: string; member_count: number } | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  const shell =
    "flex items-center gap-3 w-full text-start bg-surface border border-border rounded-2xl px-4 py-3 hover:border-accent/50 transition disabled:opacity-50";

  if (room) {
    return (
      <Link href={`/people?tab=all&c=${room.id}`} className={shell}>
        <Icon name="people" size={18} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{t.titleRoomOpen}</span>
          <span className="block text-xs text-muted">
            {room.member_count > 0
              ? t.titleRoomOpenHint(num(room.member_count, locale))
              : t.titleRoomBeFirst}
          </span>
        </span>
        <Icon
          name="chevron-down"
          size={16}
          className="-rotate-90 rtl:rotate-90 text-muted shrink-0"
        />
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending || busy}
      onClick={() => {
        tap(10);
        setBusy(true);
        start(async () => {
          try {
            const id = await openTitleRoom(tmdbId, mediaType);
            router.push(`/people?tab=all&c=${id}`);
          } catch (e) {
            setBusy(false);
            flashError((e as Error).message);
          }
        });
      }}
      className={shell}
    >
      <Icon name="people" size={18} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{t.titleRoomStart}</span>
        <span className="block text-xs text-muted">{t.titleRoomStartHint}</span>
      </span>
      <Icon
        name="chevron-down"
        size={16}
        className="-rotate-90 rtl:rotate-90 text-muted shrink-0"
      />
    </button>
  );
}
