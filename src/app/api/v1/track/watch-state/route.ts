import { setWatchState } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import type { WatchStateBody } from "@/core/contracts/track";

/**
 * `POST /api/v1/track/watch-state` — D-1280: «ابدأ» · «إيقاف مؤقّت» · «كمّل». نفسُ `setWatchState`،
 * والوسومُ تطابق `revalidatePath` فيه: الرئيسيّةُ والمكتبة — صفحةُ العمل لا تقرأ هذه الحالة.
 */
export const POST = trackRoute<WatchStateBody>(
  (b) => setWatchState(b.showTmdbId, b.state),
  () => ["home", "me:library"],
);
