import type { NextRequest } from "next/server";
import { toggleReviewLike, toggleReaction, toggleListReviewLike } from "@/lib/actions";
import { parseLikeBody } from "@/core/communityActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { listTag, titleTag, type Tag } from "@/core/contracts/tags";

/**
 * `POST /api/v1/community/like` — قلبُ بطاقة «مجتمعي» (Phase 11-M · M2): `{target, …مفتاحه, on}`.
 *
 * 🔑 **الأفعالُ الثلاثةُ التي يناديها `LikeButton` في الويب حرفاً** — الوجهةُ تختار الجدول (D-124/D-224/D-370)،
 * والحراسةُ (لا إعجابَ بنفسك · لا كتابةَ باسم غيرك) في القاعدة. **والوسومُ ما يُبطله الفعلُ نفسُه**: صفحةُ العمل
 * للرأي، والقائمةُ لرأيها، والأخبارُ لخبرنا — **لا «المجتمع»**: البطاقةُ تفاؤليّةٌ وتملك رقمَها (D-008).
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseLikeBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    let tags: Tag[];
    if (b.target === "review") {
      await toggleReviewLike(b.user_id, b.tmdb_id, b.media_type, !b.on);
      tags = [titleTag(b.media_type, b.tmdb_id)];
    } else if (b.target === "list_review") {
      await toggleListReviewLike(b.user_id, b.list_id, !b.on);
      tags = [listTag(b.list_id)];
    } else {
      await toggleReaction({ tmdbId: b.tmdb_id, mediaType: b.media_type, on: b.on });
      tags = ["news"];
    }
    return ok({ done: true as const }, tags);
  });
}
