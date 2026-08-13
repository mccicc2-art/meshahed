"use client";

import { useState, useTransition } from "react";
import { flashError } from "@/lib/toast";
import { toggleActivityLike, toggleReviewLike } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";

/**
 * إعجابٌ بمراجعة، أو **بحدثِ مشاهدة** (D-124).
 *
 * الحالة تنقلب فور اللمس ثم تُكتب: الشبكة قد تأخذ نصف ثانية، والزرّ الذي
 * لا يستجيب يُلمس مرّتين. وإن فشلت الكتابة رجعت الحالة إلى ما كانت —
 * التفاؤل هنا وعدٌ لا كذب.
 *
 * ومراجعتك أنت تعرض العدد بلا زرّ: لا يُعجب المرء بنفسه، والقاعدة تمنعه
 * أصلاً في سياسة الإدراج.
 *
 * **زرٌّ واحد، وجهتان** (`target`): الصفُّ الذي يحمل تقييماً يكتب في
 * `review_likes`، وحدثُ المشاهدة في `activity_likes` بمفتاحٍ فيه يوم.
 * زرّان متطابقان شكلاً لمعنًى واحد كانا سيصيران عائلةً ثانية بلا سبب —
 * والفرق كلّه في أي فعلٍ يُنادى.
 */
export function LikeButton({
  reviewUserId,
  tmdbId,
  mediaType,
  likes,
  likedByMe,
  isMine,
  readOnly = false,
  target = "review",
  day,
  locale,
}: {
  reviewUserId: string;
  tmdbId: number;
  mediaType: "tv" | "movie";
  likes: number;
  likedByMe: boolean;
  isMine: boolean;
  /**
   * **رقمٌ بلا زرّ** (D-221) — للزائر بلا حساب.
   *
   * **ولم يُعَد استعمالُ `isMine` لهذا** وإن كان السلوكُ نفسَه: **معنَيان
   * في علمٍ واحد يجعلان أوّلَ تعديلٍ غداً يمسّ الحالتين معاً**. علمٌ لكل
   * معنى، والسلوكُ يتشاركانه.
   */
  readOnly?: boolean;
  /** وجهة الكتابة — الافتراضي المراجعة كي لا يتغيّر أي نداءٍ قائم */
  target?: "review" | "activity";
  /** يوم الحدث (YYYY-MM-DD) — لازمٌ لوجهة النشاط وحدها */
  day?: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(likes);
  const [pending, start] = useTransition();

  if (isMine || readOnly) {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-muted" title={t.likesLabel}>
        <Icon name="like" size={16} />
        <span className="tabular-nums">{count}</span>
      </span>
    );
  }

  function toggle() {
    if (pending) return;
    tap(8);
    const was = liked;
    setLiked(!was);
    setCount((c) => c + (was ? -1 : 1));
    start(async () => {
      try {
        if (target === "activity") {
          await toggleActivityLike(reviewUserId, tmdbId, mediaType, day ?? "", was);
        } else {
          await toggleReviewLike(reviewUserId, tmdbId, mediaType, was);
        }
      } catch (e) {
        flashError((e as Error).message);
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
        liked ? "text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      <Icon name={liked ? "like-filled" : "like"} size={16} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
