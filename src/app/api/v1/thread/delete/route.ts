import type { NextRequest } from "next/server";
import { deleteMyReply, deleteMyNewsReply, deleteMyTalkPost } from "@/lib/actions";
import { parseThreadRowBody } from "@/core/threadActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { postTag, titleTag } from "@/core/contracts/tags";

/**
 * `POST /api/v1/thread/delete` — «احذف ردّي» (Phase 11-M · M3): `deleteMyTalkPost` · `deleteMyReply` · `deleteMyNewsReply`
 * كما في `ThreadReplies.remove`؛ **والملكيّةُ في المطابقة نفسِها** (`user_id = أنا`) — ردُّ غيرك لا يُحذف مهما أُرسل.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseThreadRowBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    const t = b.target;
    if (t.kind === "talk") {
      await deleteMyTalkPost({ postId: b.reply_id, tmdbId: t.tmdb_id, mediaType: t.media_type });
      return ok({ done: true as const }, [titleTag(t.media_type, t.tmdb_id), "people"]);
    }
    if (t.kind === "review") {
      await deleteMyReply({ replyId: b.reply_id, tmdbId: t.tmdb_id, mediaType: t.media_type });
      return ok({ done: true as const }, [titleTag(t.media_type, t.tmdb_id)]);
    }
    await deleteMyNewsReply({ replyId: b.reply_id });
    return ok({ done: true as const }, [postTag(t.key), "people"]);
  });
}
