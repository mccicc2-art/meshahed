import { createSmartList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { SmartListBody } from "@/core/contracts/library";

/** `POST /api/v1/lists/smart-catalog` — «قائمة ذكيّة» من فلتر «اكتشف» (D-993): `createSmartList` بمصدر `catalog` — نظيرُ `lists/smart` (مصدر `library`). */
export const POST = bodyRoute<SmartListBody, { id: string | null; needsPlus?: true }>(
  (b) => createSmartList(String(b.name ?? ""), b.rule, "catalog"),
  () => ["me:lists", "me:library"],
);
