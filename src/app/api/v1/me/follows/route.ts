import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { peopleFollowsOf } from "@/lib/actions";
import type { FollowsPayload } from "@/core/contracts/library";

/**
 * `GET /api/v1/me/follows?dir=followers|following` — Phase 11-H: ورقةُ عدّادَي
 * المتابِعين/المتابَعين في الرئيسيّة الأصليّة (كانت تفتح الملفَّ الويبيّ — D-1066 §10).
 * **الفعلُ فعلُ الويب** (`peopleFollowsOf` — القواعدُ الأربعُ في القاعدة، D-632)؛
 * والهدفُ صاحبُ الجلسة، **أو 🆕 `?user=<id>` لملفّ شخصٍ آخر** (Phase 11-N · N1 — عدّادا ملفّه الأصليّ): القفلُ
 * (`hide_follow_lists`) والخصوصيّةُ والحظرُ في `follow_people` نفسِها — لا حارسَ ثانٍ هنا.
 */
export async function GET(req: NextRequest) {
  return handle<FollowsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const dir = req.nextUrl.searchParams.get("dir");
    if (dir !== "followers" && dir !== "following") return fail("invalid_input");
    const user = req.nextUrl.searchParams.get("user");
    const target = user && /^[0-9a-f-]{36}$/i.test(user) ? user : auth.user.id;
    const people = await peopleFollowsOf(target, dir);
    return ok({ dir, people });
  });
}
