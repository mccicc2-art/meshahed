"use client";

import { useState, useTransition } from "react";
import { flashError, toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { requestOrFollowUser, unfollowUser, cancelFollowRequest } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { buttonClass } from "./ui/Button";

type FollowState = "none" | "following" | "requested";

/**
 * زرّ المتابعة — ثلاث حالاتٍ لا اثنتان (follow_requests.sql).
 *
 * الضغط لا يعرف مسبقاً أيقود لمتابعةٍ أم طلب: الحساب الخاصّ قرارُ صاحبه
 * والقاعدة وحدها تعرفه، فـ`request_or_follow` تُرجع ما وقع ويُظهر الزرّ
 * «طلبتَ المتابعة» أو «تتابعه» بحسب الجواب. الضغط على «طلبتَ» يسحب الطلب،
 * وعلى «تتابعه» يُلغي المتابعة — كلٌّ فعلُه المعاكس بلا قائمة.
 */
export function FollowUserButton({
  targetId,
  locale,
  initialFollowing,
  initialRequested = false,
}: {
  targetId: string;
  locale: Locale;
  initialFollowing: boolean;
  initialRequested?: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [state, setState] = useState<FollowState>(
    initialFollowing ? "following" : initialRequested ? "requested" : "none",
  );
  const [pending, start] = useTransition();

  const label =
    state === "following"
      ? t.followingUser
      : state === "requested"
        ? t.followRequested
        : t.followUser;

  return (
    <button
      disabled={pending}
      onClick={() => {
        tap(10);
        const prev = state;
        start(async () => {
          try {
            if (prev === "none") {
              const got = await requestOrFollowUser(targetId);
              if (got === "requested") {
                setState("requested");
                toast(t.followRequestSent, { tone: "info" });
              } else if (got === "following") {
                setState("following");
              }
            } else if (prev === "following") {
              setState("none");
              await unfollowUser(targetId);
            } else {
              setState("none");
              await cancelFollowRequest(targetId);
            }
            router.refresh();
          } catch (e) {
            flashError((e as Error).message);
            setState(prev);
          }
        });
      }}
      className={buttonClass({
        variant: state === "none" ? "primary" : "surface",
        className:
          state === "none"
            ? ""
            : "hover:border-[color:var(--error)]/60 hover:text-[color:var(--error)]",
      })}
    >
      {label}
    </button>
  );
}
