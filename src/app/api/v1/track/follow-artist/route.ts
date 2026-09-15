import { followArtist } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import type { FollowArtistBody } from "@/core/contracts/person";

/** `POST /api/v1/track/follow-artist` — D-983: نفسُ `followArtist` (يُبطل `/news` — صفُّ «فنّانون»). */
export const POST = trackRoute<FollowArtistBody>(followArtist, () => ["news"]);
