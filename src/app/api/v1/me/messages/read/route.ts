import type { NextRequest } from "next/server";
import { markConversationRead } from "@/lib/actions";
import { fail, handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseMsgPeerBody } from "@/core/contracts/messages";

/**
 * `POST /api/v1/me/messages/read` — الواردُ من شخصٍ مقروءٌ عند فتح خيطه (`markConversationRead`، D-765).
 * **بلا وسم**: التطبيقُ يصفّر العدّادَ في كاشه لحظةَ الفتح، والجلبُ التالي (إشارةٌ أو استطلاع) يأتي بقيمة الخادم.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseMsgPeerBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    await markConversationRead(b.person_id);
    return ok({ done: true as const });
  });
}
