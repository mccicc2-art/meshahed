import { saveHomeQueueOrder } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { QueueOrderBody } from "@/core/contracts/library";

/** `POST /api/v1/me/prefs/queue-order` — ترتيبُ طابورٍ في الرئيسيّة (D-605/D-719؛ `ReorderSheet` أصليّاً — D-948) */
export const POST = bodyRoute<QueueOrderBody, { done: true }>(
  async (b) => {
    const row = b.row === "continue" || b.row === "towatch" || b.row === "lists" || b.row === "towatchlist" ? b.row : "towatchlist";
    await saveHomeQueueOrder(row, Array.isArray(b.keys) ? b.keys.map(String) : []);
    return { done: true };
  },
  () => ["me:lists", "home"],
);
