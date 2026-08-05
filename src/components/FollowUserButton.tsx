"use client";

import { useState, useTransition } from "react";
import { flashError } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { followUser, unfollowUser } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { buttonClass } from "./ui/Button";

export function FollowUserButton({
  targetId,
  locale,
  initialFollowing,
}: {
  targetId: string;
  locale: Locale;
  initialFollowing: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [on, setOn] = useState(initialFollowing);
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        tap(10);
        const next = !on;
        setOn(next);
        start(async () => {
          try {
            if (next) await followUser(targetId);
            else await unfollowUser(targetId);
            router.refresh();
          } catch (e) {
            flashError((e as Error).message);
            setOn(!next);
          }
        });
      }}
      className={buttonClass({
        variant: on ? "surface" : "primary",
        className: on ? "hover:border-[color:var(--error)]/60 hover:text-[color:var(--error)]" : "",
      })}
    >
      {on ? t.followingUser : t.followUser}
    </button>
  );
}
