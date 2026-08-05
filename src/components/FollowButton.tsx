"use client";

import { useState, useTransition } from "react";
import { flashError } from "@/lib/flash";
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
          // التبديل تفاؤليّ ثم يُثبَّت؛ وإن فشل الحفظ رجع الزرّ لحاله —
          // زرٌّ يقول «أتابعه» وقاعدة البيانات تقول غير ذلك أسوأ من خطأ ظاهر
          const was = following;
          setFollowing(!was);
          try {
            if (was) await unfollow({ tmdbId, mediaType });
            else await follow({ tmdbId, mediaType, title, posterPath });
          } catch (e) {
            flashError((e as Error).message);
            setFollowing(was);
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
