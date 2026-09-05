import { saveRating } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { RateBody } from "@/core/contracts/track";

/** `POST /api/v1/track/rate` — D-919: نفسُ `saveRating` (يُبطل صفحةَ العمل والرئيسية). */
export const POST = trackRoute<RateBody>(saveRating, (b) => [
  titleTag(b.mediaType, b.tmdbId),
  "home",
]);
