"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptFollowRequest, rejectFollowRequest } from "@/lib/actions";
import { buttonClass } from "./ui/Button";
import { flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/core/i18n";

/**
 * 🆕 11-N دَين — **قبولُ طلب المتابعة ورفضُه في إشعارات الويب** (نظيرُ صفّ الإشعار الأصليّ — D-1197): الفعلان كانا في `actions.ts`
 * والتطبيقُ صار يرسمهما، وبقي الويبُ يقول «طلب متابعتك» بلا باب. **الفعلان نفسُهما** (`acceptFollowRequest` · `rejectFollowRequest`)،
 * والزرّان يُرسمان ما دام الطلبُ قائماً (`getIncomingFollowRequests` — كما يقرؤها `me/signals`)؛ بعد القرار يختفيان وتُقرأ الصفحةُ
 * من جديد. خارجَ رابط الصفّ لا داخلَه: زرٌّ داخل رابطٍ يفتح الملفَّ مع كلِّ ضغطة.
 */
export function FollowRequestActions({ personId, locale }: { personId: string; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return null;
  const act = (accept: boolean) => {
    tap(8);
    setDone(true);
    start(async () => {
      try {
        if (accept) await acceptFollowRequest(personId);
        else await rejectFollowRequest(personId);
        router.refresh();
      } catch (e) {
        setDone(false);
        flashError((e as Error).message);
      }
    });
  };
  return (
    <span className="shrink-0 flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => act(true)} className={buttonClass({ variant: "primary", size: "xs" })}>
        {t.requestAccept}
      </button>
      <button type="button" disabled={pending} onClick={() => act(false)} className={buttonClass({ variant: "surface", size: "xs" })}>
        {t.requestReject}
      </button>
    </span>
  );
}
