import { createList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { CreateListBody } from "@/core/contracts/library";

/** `POST /api/v1/lists/create` — قائمةٌ جديدة باسمها (D-947؛ `NewListForm` أصليّاً) */
export const POST = bodyRoute<CreateListBody, { id: string | null }>(
  async (b) => ({ id: await createList(String(b.name ?? "")) }),
  () => ["me:lists", "me:library"],
);
