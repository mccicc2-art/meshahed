import type { NextRequest } from "next/server";
import { addReviewReply, addNewsReply, addTalkPost } from "@/lib/actions";
import { getMovie, getTv } from "@/lib/tmdb";
import { parseThreadReplyBody } from "@/core/threadActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { postTag, titleTag } from "@/core/contracts/tags";
import type { ThreadReplyResult } from "@/core/contracts/thread";
import type { NewReply } from "@/lib/actions";

const out = (r: NewReply | null): ThreadReplyResult =>
  r ? { reply_id: r.replyId, created_at: r.createdAt, author: { nickname: r.nickname, username: r.username, avatar_url: r.avatar_url, hide_name: r.hide_name } } : null;

/**
 * `POST /api/v1/thread/reply` — ردٌّ في الخيط (Phase 11-M · M3): الأفعالُ الثلاثةُ التي يناديها `ThreadReplies.send`
 * حرفاً — `addTalkPost` (نصٌّ · صورةٌ من مخزننا · GIF بمعرّفه · «فيها حرق») · `addReviewReply` · `addNewsReply`؛
 * وحدودُها فيها (١٥ في الدقيقة · بادئةُ المخزن D-298 · شكلُ المعرّف D-362 · قيدُ العمق في القاعدة D-193).
 *
 * 🔑 **اسمُ العمل وملصقُه للغرفة من TMDB هنا** — الويبُ يمرّرهما من صفحته (`target.title`…) ليُكتبا مع المنشور؛
 * والتطبيقُ لا يُؤتمن عليهما (ما يصل من عميلٍ يُحرس لا يُصدَّق، D-155) — والنداءُ مخبَّأٌ ساعةً في `tmdb()`.
 */
export async function POST(req: NextRequest) {
  return handle<ThreadReplyResult>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseThreadReplyBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    const t = b.target;
    if (t.kind === "talk") {
      const d = (await (t.media_type === "tv" ? getTv(t.tmdb_id) : getMovie(t.tmdb_id)).catch(() => null)) as
        | { name?: string; title?: string; poster_path?: string | null; backdrop_path?: string | null }
        | null;
      const r = await addTalkPost({
        tmdbId: t.tmdb_id,
        mediaType: t.media_type,
        body: b.body,
        parentId: b.parent_id,
        hasSpoiler: b.has_spoiler,
        imageUrl: b.image_url,
        gifId: b.gif_id,
        title: (t.media_type === "tv" ? d?.name : d?.title) || null,
        posterPath: d?.poster_path ?? null,
        backdropPath: d?.backdrop_path ?? null,
      });
      return ok(out(r), [titleTag(t.media_type, t.tmdb_id), "people"]);
    }
    if (t.kind === "review") {
      const r = await addReviewReply({ reviewUserId: t.user_id, tmdbId: t.tmdb_id, mediaType: t.media_type, body: b.body, parentId: b.parent_id });
      return ok(out(r), [titleTag(t.media_type, t.tmdb_id)]);
    }
    const r = await addNewsReply({ postKey: t.key, body: b.body, parentId: b.parent_id });
    return ok(out(r), [postTag(t.key), "people"]);
  });
}
