import type { NextRequest } from "next/server";
import { hideConversation } from "@/lib/actions";
import { fail, handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseMsgPeerBody } from "@/core/contracts/messages";

/** `POST /api/v1/me/messages/hide` — إخفاءُ المحادثة من جهتي وحدها (`hideConversation`، D-066) — الطرفُ الآخر يحتفظ بنسخته */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseMsgPeerBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    await hideConversation(b.person_id);
    return ok({ done: true as const }, ["me:messages"]);
  });
}
