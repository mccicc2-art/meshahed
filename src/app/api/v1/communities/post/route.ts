import { bodyRoute } from "@/lib/v1body";
import { postCommunityMessage } from "@/lib/actions";
import type { CommunityPostBody } from "@/core/contracts/library";

/**
 * `POST /api/v1/communities/post` — رسالةٌ في مجتمع (Phase 11-G · G6؛ `CommunityPicker` ينشر رابطَ القائمة،
 * وفقاعةُ المجتمع تحوّل `loopztv.com/lists/` رابطاً). الفعلُ نفسُه: عضويّةٌ (RLS) وحدُّ ٣٠/دقيقة وطولُ ١–٢٠٠٠.
 */
export const POST = bodyRoute<CommunityPostBody, { done: true }>(
  async (b) => {
    await postCommunityMessage(String(b.communityId ?? ""), String(b.body ?? ""));
    return { done: true };
  },
  () => ["people"],
);
