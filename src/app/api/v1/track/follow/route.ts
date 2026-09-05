import { follow } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { FollowBody } from "@/core/contracts/track";

/** `POST /api/v1/track/follow` — D-916: نفسُ `follow` (يُبطل الرئيسةَ والمكتبةَ وصفحةَ العمل). */
export const POST = trackRoute<FollowBody>(follow, (b) => [
  "home",
  "me:library",
  titleTag(b.mediaType, b.tmdbId),
]);
