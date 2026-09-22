import { bodyRoute } from "@/lib/v1body";
import { sendListShare } from "@/lib/actions";
import type { ShareFriendBody } from "@/core/contracts/library";

/**
 * `POST /api/v1/lists/share-friend` — القائمةُ إلى صديق (Phase 11-G · G6؛ `FriendPicker` في `ShareListSheet`).
 * الفعلُ نفسُه: متابعةٌ متبادلة (تحرسها القاعدة)، القائمةُ معلنةٌ وإلّا رمى، الملاحظةُ ٢٨٠ حرفاً. لا وسمَ يُبطَل
 * عند المرسِل — المشاركةُ تظهر في صندوق المتلقّي.
 */
export const POST = bodyRoute<ShareFriendBody, { done: true }>(
  async (b) => {
    await sendListShare({ recipientId: String(b.recipientId ?? ""), listId: String(b.listId ?? ""), note: b.note ?? null });
    return { done: true };
  },
  () => [],
);
