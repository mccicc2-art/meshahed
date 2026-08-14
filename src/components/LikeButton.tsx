"use client";

import { useState, useTransition } from "react";
import { flashError } from "@/lib/toast";
import { toggleActivityLike, toggleReviewLike, toggleReaction } from "@/lib/actions";
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
  reviewUserId = "",
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
  /** صاحبُ الرأي — لوجهتَي المراجعة والنشاط؛ **وخبرُنا لا صاحبَ له** */
  reviewUserId?: string;
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
  /**
   * وجهة الكتابة — الافتراضي المراجعة كي لا يتغيّر أي نداءٍ قائم.
   *
   * **و`post` هو خبرُنا نحن** (`post_reactions`، D-224): لا كاتبَ له فلا
   * `review_likes` تسعه. **وهذا هو قرار 🔥 المرفوض وقد صُحِّح لا نُقض:**
   * الرفضُ كان أن «🔥 هي الإعجابُ نفسه بأيقونةٍ أخرى» — **فالعلاجُ أن
   * تُرسم بأيقونة الإعجاب**، لا أن يُهجر الجدول. عائلةُ تفاعلٍ واحدة،
   * ورمزٌ واحد، وجدولان لأن الشيء المُعجَب به يختلف.
   */
  target?: "review" | "activity" | "post";
  /** يوم الحدث (YYYY-MM-DD) — لازمٌ لوجهة النشاط وحدها */
  day?: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(likes);
  const [pending, start] = useTransition();

  /**
   * **والصفرُ يُخفى** (D-219/D-134/D-216) — كان كلُّ صفٍّ في الخطّ يحمل
   * «❤ ٠»، **فتُقرأ الصفحةُ جداراً من أصفار** بينما جارُه `WorksTalk`
   * يُخفيها من أوّل يوم: **لغتان لرقمٍ واحد في صفحةٍ واحدة**.
   * **ورقمٌ يُقرأ خطأً أسوأ من لا رقم** — والصفرُ هنا لا يقول «لم يُعجب
   * أحد»، يقول «هذا التطبيق فارغ».
   */
  if (isMine || readOnly) {
    /* صفرٌ بلا زرّ لا يقول شيئاً ولا يُضغط — **وأداةٌ لا تفعل ولا تخبر
       تُحذف من الصفّ** (D-138/D-142) */
    if (count === 0) return null;
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
        if (target === "post") {
          await toggleReaction({ tmdbId, mediaType, on: !was });
        } else if (target === "activity") {
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

  /* **حشوةٌ بهامشٍ سالبٍ يقابلها**: الرقمُ حين يغيب يترك رمزاً بعرض ١٦
     بكسل هدفَ لمسٍ وحيداً — **فالزرُّ يُوسَّع ولا يتحرّك**، والهامشُ متماثلُ
     الطرفين فلا ينقلب في RTL (D-033/D-216) */
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={t.likesLabel}
      title={t.likesLabel}
      className={`flex items-center gap-1.5 rounded-full -mx-2 px-2 py-1.5 text-[12px] transition ${
        liked ? "text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      <Icon name={liked ? "like-filled" : "like"} size={16} />
      {/* **والزرُّ يبقى وإن غاب رقمُه** — الرمزُ وحده فعلٌ مفهوم */}
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
