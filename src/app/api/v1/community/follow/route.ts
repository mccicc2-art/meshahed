import type { NextRequest } from "next/server";
import { requestOrFollowUser, unfollowUser, cancelFollowRequest } from "@/lib/actions";
import { parseFollowUserBody, type FollowUserResult } from "@/core/communityActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/community/follow` — متابعةُ شخص (Phase 11-M · M2): `{user_id, on}` — زاويةُ الوجه في «عرض الكل»
 * (`FollowUserButton variant="corner"`، D-281). **الأفعالُ نفسُها**: `requestOrFollowUser` يعيد «تتابعه» أو «طلبتَ»
 * (الحسابُ الخاصّ)، والعائدُ حالةٌ لا «تمّ» — فالتطبيقُ يرسم ما وقع لا ما ظنّه.
 *
 * 🔑 **والإلغاءُ يسحب الاثنين**: الحمولةُ لا تعرف «طلبتُ» (`following_ids` وحدَها، كالويب)، فزرٌّ يُلغي بعد طلبٍ في
 * الجلسة نفسِها قد لا يعرف أيَّهما كان — **وحذفُ صفٍّ غير موجودٍ لا شيء**، وكلاهما صفّي أنا (السياسة).
 * **والوسومُ ما يُبطله الفعلُ**: الرئيسيّةُ (عدّاداتُ المتابعة) وأصدقائي (المتبادَلةُ تتغيّر).
 */
export async function POST(req: NextRequest) {
  return handle<FollowUserResult>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseFollowUserBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    if (b.on) {
      const got = await requestOrFollowUser(b.user_id);
      return ok({ state: got === "requested" ? "requested" : "following" }, ["home", "me:friends"]);
    }
    await Promise.all([unfollowUser(b.user_id), cancelFollowRequest(b.user_id)]);
    return ok({ state: "none" }, ["home", "me:friends"]);
  });
}
