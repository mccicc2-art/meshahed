import type { NextRequest } from "next/server";
import { replyToShare } from "@/lib/actions";
import { fail, handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseMsgReplyBody } from "@/core/contracts/messages";

/**
 * `POST /api/v1/me/messages/reply` — ردٌّ في المحادثة (`replyToShare` نفسُه: معلَّقٌ بآخر عملٍ شورك، D-051، والقاعدةُ
 * تشترط بقاءَ المتابعة المتبادلة). الحدُّ حدُّ الفعل (٣٠ في الدقيقة · ٥٠٠ حرف)، والفراغُ يُرفض في القارئ قبل الرحلة.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseMsgReplyBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    await replyToShare(b.share_id, b.body);
    return ok({ done: true as const }, ["me:messages"]);
  });
}
