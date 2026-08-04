"use client";

import { useState, useTransition } from "react";
import { toggleReviewLike } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * إعجابٌ بمراجعة.
 *
 * الحالة تنقلب فور اللمس ثم تُكتب: الشبكة قد تأخذ نصف ثانية، والزرّ الذي
 * لا يستجيب يُلمس مرّتين. وإن فشلت الكتابة رجعت الحالة إلى ما كانت —
 * التفاؤل هنا وعدٌ لا كذب.
 *
 * ومراجعتك أنت تعرض العدد بلا زرّ: لا يُعجب المرء بنفسه، والقاعدة تمنعه
 * أصلاً في سياسة الإدراج.
 */
export function LikeButton({
  reviewUserId,
  tmdbId,
  mediaType,
  likes,
  likedByMe,
  isMine,
  locale,
}: {
  reviewUserId: string;
  tmdbId: number;
  mediaType: "tv" | "movie";
  likes: number;
  likedByMe: boolean;
  isMine: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(likes);
  const [pending, start] = useTransition();

  if (isMine) {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-muted" title={t.likesLabel}>
        <Icon name="heart" size={15} />
        <span className="tabular-nums">{count}</span>
      </span>
    );
  }

  function toggle() {
    if (pending) return;
    const was = liked;
    setLiked(!was);
    setCount((c) => c + (was ? -1 : 1));
    start(async () => {
      try {
        await toggleReviewLike(reviewUserId, tmdbId, mediaType, was);
      } catch {
        setLiked(was);
        setCount((c) => c + (was ? 1 : -1));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={t.likesLabel}
      title={t.likesLabel}
      className={`flex items-center gap-1.5 text-[12px] transition ${
        liked ? "text-accent-2" : "text-muted hover:text-foreground"
      }`}
    >
      <Icon name={liked ? "heart-filled" : "heart"} size={15} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
