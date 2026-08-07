"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { createListFromPerson, createListFromCollection } from "@/lib/actions";
import { Icon } from "./Icon";

/**
 * زرٌّ واحد لمصدرين: أعمال فنان، أو أجزاء سلسلة.
 *
 * لا يحمل الأعمال معه: الفعل على الخادم يجلبها بنفسه (`getPersonCredits` /
 * `getCollection`)، فلا نمرّر مصفوفةً كبيرة إلى المتصفّح ولا نطلبها مرّتين —
 * وطلب TMDB مخبّأ ساعةً أصلاً. والرسالة تحمل زرّ «افتح» لأن من أنشأ قائمةً
 * يريد رؤيتها، لا البحث عنها في `/lists`.
 */
export function AddWorksToList({
  source,
  id,
  locale,
  label,
  className = "",
}: {
  source: "person" | "collection";
  id: number;
  locale: Locale;
  label?: string;
  className?: string;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const text = label ?? (source === "person" ? t.worksToListBtn : t.partsToListBtn);

  function run() {
    if (pending) return;
    tap([12, 30]);
    start(async () => {
      try {
        const res =
          source === "person"
            ? await createListFromPerson(id)
            : await createListFromCollection(id);
        if (!res) return;
        const open = { label: t.openListAction, run: () => router.push(`/lists/${res.listId}`) };
        if (res.created) toast(t.listMadeToast(res.name), { action: open });
        else if (res.added > 0) toast(t.listGrewToast(res.added), { action: open });
        else toast(t.listHadAllToast, { tone: "info", action: open });
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border border-border bg-surface px-3.5 h-9 text-[13px] font-semibold text-foreground/85 hover:text-accent hover:border-accent/50 active:scale-95 disabled:opacity-50 transition ${className}`}
    >
      <Icon name="plus" size={16} strokeWidth={2.2} />
      {text}
    </button>
  );
}
