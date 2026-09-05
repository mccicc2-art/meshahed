import { deleteRating } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { UnrateBody } from "@/core/contracts/track";

/** `POST /api/v1/track/unrate` — D-919: نفسُ `deleteRating`، الوسومُ نفسُها. */
export const POST = trackRoute<UnrateBody>(deleteRating, (b) => [
  titleTag(b.mediaType, b.tmdbId),
  "home",
]);
