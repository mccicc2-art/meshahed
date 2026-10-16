import type { NextRequest } from "next/server";
import { deleteMessages } from "@/lib/messageDelete";
import { fail, handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseMsgDeleteBody, type MsgDeletePayload } from "@/core/contracts/messages";

/**
 * 🆕 `POST /api/v1/me/messages/delete` (D-1441) — «حذف عندي» أو «حذف للجميع» لرسائل محدّدة في الخاص أو في قروب.
 * المنطقُ في `lib/messageDelete.ts`، والحَكَمُ القاعدةُ (الهجرة ٢٠٨). ما رُفض يعود في `refused` فتُبقيه الشاشةُ وتقول السبب.
 */
export async function POST(req: NextRequest) {
  return handle<MsgDeletePayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const slow = limited(`v1:msg-delete:${auth.user.id}`, 30, 60_000);
    if (slow) return slow;
    const b = parseMsgDeleteBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    return ok(await deleteMessages(auth.user.id, b), ["me:messages"]);
  });
}
