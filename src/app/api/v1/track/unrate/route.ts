import { deleteRating } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { UnrateBody } from "@/core/contracts/track";

/** `POST /api/v1/track/unrate` — D-919: نفسُ `deleteRating`، الوسومُ نفسُها.
 * 🆕 D-1357 — و`me:ratings`: شاشةُ «تقييماتي» الأصليّة مفتاحُها هذا الوسم، فتتجدّد بعد التقييم من صفحة العمل. */
export const POST = trackRoute<UnrateBody>(deleteRating, (b) => [
  titleTag(b.mediaType, b.tmdbId),
  "home",
  "me:ratings",
]);
