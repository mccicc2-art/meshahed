import { saveListReview } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { ListReviewBody } from "@/core/contracts/library";

/** `POST /api/v1/lists/review` — رأيي في قائمةِ غيري (D-948؛ `ListReviewForm` أصليّاً) */
export const POST = bodyRoute<ListReviewBody, { done: true }>(
  async (b) => {
    await saveListReview({ listId: String(b.listId ?? ""), rating: Number(b.rating), body: b.body ?? null, hasSpoiler: !!b.hasSpoiler });
    return { done: true };
  },
  () => ["me:lists"],
);
