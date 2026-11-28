import { toggleListReviewLike } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { listTag } from "@/core/contracts/tags";
import type { ListReviewLikeBody } from "@/core/contracts/library";

/**
 * 🆕 D-1038 — قلبٌ على رأيٍ في قائمة
 * غلافٌ رقيقٌ فوق دالّة الويب القائمة (`toggleListReviewLike`): الحراسةُ والتحقّقُ والحدودُ فيها لا هنا —
 * **قارئٌ/كاتبٌ واحدٌ للسطحين**، فلا يفترق التطبيقُ عن الويب عند أوّل إصلاح.
 */
export const POST = bodyRoute<ListReviewLikeBody, { liked: boolean }>(
  async (b) => {
    /* T611 — `liked` في الجسم **الحالُ المطلوبة** (التطبيقُ يرسل `!liked_by_me`)، ودالّةُ الويب تأخذ **الحالَ القائمة** («أعجبتُ ⇒ احذف»):
       كان يُمرَّر كما هو فيُحذف الإعجابُ بدل أن يُكتب، فلا يُحفظ قلبُ رأيٍ في صفحة القائمة أبداً. يُقلب هنا مرّةً واحدة */
    await toggleListReviewLike(String(b.reviewUserId ?? ""), String(b.listId ?? ""), !b.liked);
    return { liked: !!b.liked };
  },
  (b) => [listTag(String(b.listId ?? ""))],
);
