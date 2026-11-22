import type { NextRequest } from "next/server";
import { togglePostLike } from "@/lib/actions";
import { toggleReplyLike } from "@/lib/replyLikes";
import { parseThreadLikeBody } from "@/core/threadActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/thread/like` — قلبُ منشورٍ في الغرفة (Phase 11-M · M3): `togglePostLike(id, liked)` كـ`ThreadReplies.like`؛
 * `on` حالةٌ مقصودة (D-241) و`liked = !on`. **ولا وسم**: القلبُ تفاؤليٌّ ويملك رقمَه.
 * 🆕 T509 — و`scope` ردُّ تعليقٍ أو ردُّ خبر (`toggleReplyLike`، الهجرة ٢٥٩)؛ غائبٌ ⇒ مشاركةُ الغرفة كما كان.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseThreadLikeBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    if (b.scope === "review" || b.scope === "news") await toggleReplyLike(b.scope, b.post_id, !b.on);
    else await togglePostLike(b.post_id, !b.on);
    return ok({ done: true as const }, []);
  });
}
