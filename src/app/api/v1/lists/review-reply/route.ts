import { addListReviewReply } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { listTag } from "@/core/contracts/tags";
import type { ListReviewReplyBody } from "@/core/contracts/library";

/**
 * 🆕 D-1038 — ردٌّ على رأيٍ في قائمة (عمقٌ واحد — الهجرةُ تمنع الثالث)
 * غلافٌ رقيقٌ فوق دالّة الويب القائمة (`addListReviewReply`): الحراسةُ والتحقّقُ والحدودُ فيها لا هنا —
 * **قارئٌ/كاتبٌ واحدٌ للسطحين**، فلا يفترق التطبيقُ عن الويب عند أوّل إصلاح.
 */
export const POST = bodyRoute<ListReviewReplyBody, { reply_id: string | null }>(
  async (b) => {
    const r = await addListReviewReply({ listId: String(b.listId ?? ""), reviewUserId: String(b.reviewUserId ?? ""), body: String(b.body ?? ""), parentId: b.parentId ?? null });
    return { reply_id: r?.replyId ?? null };
  },
  (b) => [listTag(String(b.listId ?? ""))],
);
