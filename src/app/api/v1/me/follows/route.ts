import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { peopleFollowsOf } from "@/lib/actions";
import type { FollowsPayload } from "@/core/contracts/library";

/**
 * `GET /api/v1/me/follows?dir=followers|following` — Phase 11-H: ورقةُ عدّادَي
 * المتابِعين/المتابَعين في الرئيسيّة الأصليّة (كانت تفتح الملفَّ الويبيّ — D-1066 §10).
 * **الفعلُ فعلُ الويب** (`peopleFollowsOf` — القواعدُ الأربعُ في القاعدة، D-632)؛
 * والهدفُ صاحبُ الجلسة وحدَه: الشاشةُ لا تعرف `user_id` وليست بحاجةٍ إليه.
 */
export async function GET(req: NextRequest) {
  return handle<FollowsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const dir = req.nextUrl.searchParams.get("dir");
    if (dir !== "followers" && dir !== "following") return fail("invalid_input");
    const people = await peopleFollowsOf(auth.user.id, dir);
    return ok({ dir, people });
  });
}
