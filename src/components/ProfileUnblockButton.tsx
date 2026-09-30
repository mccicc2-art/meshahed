"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unblockUser } from "@/lib/actions";
import { buttonClass } from "./ui/Button";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/core/i18n";

/**
 * 🆕 11-N دَين — **رفعُ الحظر من صفحة الملفّ نفسِها** (نظيرُ زرّ الشاشة الأصليّة — D-1198): من حظرتَه يُقال له ذلك صريحاً ومعه
 * بابُ الرجوع، لا صفحةٌ مغلقةٌ لا يُعرف أين تُفتح. الفعلُ `unblockUser` نفسُه الذي في «المحظورون» (`BlockedList`)، ثمّ تُقرأ الصفحةُ
 * من جديد فيعود محتواها.
 */
export function ProfileUnblockButton({ targetId, locale }: { targetId: string; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        tap(8);
        start(async () => {
          try {
            await unblockUser(targetId);
            toast(t.unblockedToast, { tone: "info" });
            router.refresh();
          } catch (e) {
            flashError((e as Error).message);
          }
        });
      }}
      className={buttonClass({ variant: "surface", size: "sm" })}
    >
      {t.unblockButton}
    </button>
  );
}
