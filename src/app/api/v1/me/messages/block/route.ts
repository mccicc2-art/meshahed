import type { NextRequest } from "next/server";
import { blockUser, hideConversation } from "@/lib/actions";
import { fail, handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseMsgPeerBody } from "@/core/contracts/messages";

/**
 * `POST /api/v1/me/messages/block` — **الحظرُ من داخل المحادثة يُخفي الخيطَ أيضاً** (`BlockConfirmSheet` ثمّ
 * `hideConversation` في `Inbox`): لا صفَّ تشرحه لمن حظرتَ صاحبه. والإخفاءُ من جهتي وحدها (D-066)، و**فشلُه لا يُفشل
 * الحظر** — كما في الويب (`.catch(() => {})`).
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseMsgPeerBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    await blockUser(b.person_id);
    await hideConversation(b.person_id).catch(() => {});
    return ok({ done: true as const }, ["me:messages", "people", "home"]);
  });
}
