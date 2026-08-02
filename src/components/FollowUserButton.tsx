"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { followUser, unfollowUser } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";

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
        const next = !on;
        setOn(next);
        start(async () => {
          try {
            if (next) await followUser(targetId);
            else await unfollowUser(targetId);
            router.refresh();
          } catch {
            setOn(!next);
          }
        });
      }}
      className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60 ${
        on
          ? "bg-surface-2 text-foreground border border-border hover:border-red-400/60 hover:text-red-300"
          : "bg-accent text-[color:var(--on-accent)] hover:brightness-110"
      }`}
    >
      {on ? t.followingUser : t.followUser}
    </button>
  );
}
