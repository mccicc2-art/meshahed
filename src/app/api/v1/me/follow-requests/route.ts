import type { NextRequest } from "next/server";
import { acceptFollowRequest, rejectFollowRequest } from "@/lib/actions";
import { fail, handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseFollowRequestBody } from "@/core/contracts/messages";

/**
 * `POST /api/v1/me/follow-requests` — قبولُ طلب متابعةٍ واردٍ أو رفضُه (🆕 Phase 11-N · N2-fix).
 * **بلاغُ أحمد ٢٩ سبتمبر**: «جاني طلب إضافة لأني مقفل.. الإشعار وصل بس يدخلني عالحساب ليش ما يخليني أقبل؟». الفعلان قائمان في
 * `actions.ts` (`accept_follow_request` · حذفُ صفِّ الطلب) ولم يكن لهما بابٌ في أيِّ واجهة — لا الويب ولا التطبيق.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseFollowRequestBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    if (b.accept) await acceptFollowRequest(b.person_id);
    else await rejectFollowRequest(b.person_id);
    return ok({ done: true as const }, ["home", "people", "me:friends"]);
  });
}
