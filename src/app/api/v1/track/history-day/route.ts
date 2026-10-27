import { moveWatchDay } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { MoveWatchDayBody } from "@/core/contracts/track";

/**
 * `POST /api/v1/track/history-day` — 🆕 D-1505: «غيّر يوم المشاهدة» من سجلّ المشاهدة. الفعلُ يعقّم ويقصّ المستقبل
 * (`moveWatchDay`)؛ والوسومُ ما يُحسب من طابع المشاهدة: الرئيسيّة (حصيلةُ الأسبوع) والمكتبة والإحصائيات وصفحةُ العمل.
 */
export const POST = trackRoute<MoveWatchDayBody>(
  (b) => moveWatchDay(b),
  (b) => ["home", "me:library", "me:stats", titleTag(b.mediaType === "movie" ? "movie" : "tv", b.tmdbId)],
);
