"use client";

import { useState, useTransition } from "react";
import { follow, unfollow } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";

export function FollowButton({
  tmdbId,
  mediaType,
  title,
  posterPath,
  initialFollowing,
  locale,
}: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  initialFollowing: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (following) {
            setFollowing(false);
            await unfollow({ tmdbId, mediaType });
          } else {
            setFollowing(true);
            await follow({ tmdbId, mediaType, title, posterPath });
          }
        })
      }
      className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60 ${
        following
          ? "bg-surface-2 text-foreground border border-border hover:border-red-400/60 hover:text-red-300"
          : "bg-accent text-[color:var(--on-accent)] hover:brightness-110"
      }`}
    >
      {following ? t.following : t.follow}
    </button>
  );
}
