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
    await toggleListReviewLike(String(b.reviewUserId ?? ""), String(b.listId ?? ""), !!b.liked);
    return { liked: !!b.liked };
  },
  (b) => [listTag(String(b.listId ?? ""))],
);
