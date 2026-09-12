import { deleteListReview } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { ListReviewDeleteBody } from "@/core/contracts/library";

/** `POST /api/v1/lists/review-delete` — حذفُ رأيي (D-948) */
export const POST = bodyRoute<ListReviewDeleteBody, { done: true }>(
  async (b) => {
    await deleteListReview(String(b.listId ?? ""));
    return { done: true };
  },
  () => ["me:lists"],
);
