import { saveList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { SaveListBody } from "@/core/contracts/library";

/** `POST /api/v1/lists/save` — حفظُ قائمةِ غيري أو إلغاؤه (`ListSaveHeart`) */
export const POST = bodyRoute<SaveListBody, { saved: boolean }>(
  async (b) => {
    await saveList(String(b.listId ?? ""), !!b.save);
    return { saved: !!b.save };
  },
  () => ["me:lists", "me:library"],
);
