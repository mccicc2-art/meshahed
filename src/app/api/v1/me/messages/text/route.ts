import type { NextRequest } from "next/server";
import { sendDirectMessage } from "@/lib/actions";
import { fail, handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseMsgTextBody } from "@/core/contracts/messages";
import { createClient } from "@/lib/supabase/server";

/**
 * 🆕 D-1380 — `POST /api/v1/me/messages/text`: رسالةٌ نصّيّةٌ مباشرة (`sendDirectMessage`)، بلا عملٍ ولا شرطِ متابعة —
 * البوّابُ `can_message` في القاعدة. يُسأل قبل الكتابة ليعود الرفضُ مفتاحاً يُقرأ (`apiMsgNotAccepting`) لا «تعذّر».
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseMsgTextBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    const supabase = await createClient();
    const gate = await supabase.rpc("can_message", { a: auth.user.id, b: b.recipient_id });
    if (!gate.error && gate.data !== true) return fail("forbidden", { message_key: "apiMsgNotAccepting" });
    await sendDirectMessage(b.recipient_id, b.body);
    return ok({ done: true as const }, ["me:messages"]);
  });
}
