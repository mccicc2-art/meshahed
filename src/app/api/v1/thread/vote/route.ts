import type { NextRequest } from "next/server";
import { votePost } from "@/lib/actions";
import { parseThreadVoteBody, talkPath } from "@/core/threadActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/thread/vote` — صوتٌ على منشورٍ في الغرفة (Phase 11-M · M3): `votePost(id, -1|0|1, path)` — الحالةُ
 * المقصودةُ لا «اعكس» (D-305)، **والمسارُ يُبنى هنا من الهدف** فيُبطل نسخةَ صفحة الغرفة في الويب (D-361) ولا يعبر من العميل.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseThreadVoteBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    await votePost(b.post_id, b.vote, talkPath(b));
    return ok({ done: true as const }, []);
  });
}
