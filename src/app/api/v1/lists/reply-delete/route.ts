import { deleteMyListReviewReply } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { listTag } from "@/core/contracts/tags";
import type { ListReplyDeleteBody } from "@/core/contracts/library";

/**
 * 🆕 D-1038 — حذفُ ردّي
 * غلافٌ رقيقٌ فوق دالّة الويب القائمة (`deleteMyListReviewReply`): الحراسةُ والتحقّقُ والحدودُ فيها لا هنا —
 * **قارئٌ/كاتبٌ واحدٌ للسطحين**، فلا يفترق التطبيقُ عن الويب عند أوّل إصلاح.
 */
export const POST = bodyRoute<ListReplyDeleteBody, { done: true }>(
  async (b) => {
    await deleteMyListReviewReply({ listId: String(b.listId ?? ""), replyId: String(b.replyId ?? "") });
    return { done: true as const };
  },
  (b) => [listTag(String(b.listId ?? ""))],
);
