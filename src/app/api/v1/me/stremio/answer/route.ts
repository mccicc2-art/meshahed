import { answerWatchSignal } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import type { StremioAnswerBody } from "@/core/contracts/stremio";

/**
 * `POST /api/v1/me/stremio/answer` `{id, watched}` — ✓ / ✕ على إشارة Stremio (`answerWatchSignal`).
 * الوسومُ تطابق `revalidatePath` في الفعل: ✓ يمسّ الرئيسيّةَ والمكتبةَ والإحصاء، والإشاراتُ نفسُها تتغيّر في الحالين.
 */
export const POST = trackRoute<StremioAnswerBody>(answerWatchSignal, (b) =>
  b.watched === true ? ["me:stremio", "home", "me:library", "me:stats"] : ["me:stremio"],
);
