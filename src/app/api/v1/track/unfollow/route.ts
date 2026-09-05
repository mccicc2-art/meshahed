import { unfollow } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { UnfollowBody } from "@/core/contracts/track";

/** `POST /api/v1/track/unfollow` — D-916: نفسُ `unfollow`، الوسومُ نفسُها. */
export const POST = trackRoute<UnfollowBody>(unfollow, (b) => [
  "home",
  "me:library",
  titleTag(b.mediaType, b.tmdbId),
]);
