import { addItemsToList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { ListAddItemsBody } from "@/core/contracts/library";
import { listTag } from "@/core/contracts/tags";

/** 🆕 T450 — `POST /api/v1/lists/add-items` — «أضف أعمالاً» بالاختيار من الملصقات: دفعةٌ واحدةٌ لا عملاً عملاً */
export const POST = bodyRoute<ListAddItemsBody, { added: number }>(
  (b) => addItemsToList(String(b.listId ?? ""), Array.isArray(b.items) ? b.items : []),
  (b) => ["me:lists", listTag(String(b.listId ?? ""))],
);
