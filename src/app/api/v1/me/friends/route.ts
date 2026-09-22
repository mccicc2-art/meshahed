import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { myMutualFollows } from "@/lib/actions";
import type { FriendsPayload } from "@/core/contracts/library";

/**
 * `GET /api/v1/me/friends` — المتابعةُ المتبادلة (Phase 11-G · G6): من يمكن أن تُرسَل له قائمة. الدالّةُ دالّةُ
 * الويب (`myMutualFollows`)، والصفُّ `PersonLite` كما هو — **قاعدةُ الإخفاء عند القارئ** (`displayNameOf`، D-193).
 */
export async function GET() {
  return handle<FriendsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const people = await myMutualFollows();
    return ok({ people });
  });
}
