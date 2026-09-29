import type { NextRequest } from "next/server";
import { reportUser } from "@/lib/actions";
import { fail, handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseProfileReportBody } from "@/core/contracts/profile";

/**
 * `POST /api/v1/profile/report` — «الإبلاغ عن هذا الحساب» من ⋯ ملفّ الشخص الأصليّ (Phase 11-N · N2).
 * **الفعلُ فعلُ الويب** (`reportUser` — `ProfileMenu`): حدُّه وحارسُ «لا تُبلغ عن نفسك» فيه، والصفُّ في `user_reports` (upsert —
 * بلاغٌ ثانٍ من الشخص نفسِه يحدّث سببَه لا يكدّس). لا وسمَ يُبطل: لا شيءَ في التطبيق يقرأ البلاغات.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseProfileReportBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    await reportUser({ targetId: b.user_id, reason: b.reason ?? undefined });
    return ok({ done: true as const });
  });
}
