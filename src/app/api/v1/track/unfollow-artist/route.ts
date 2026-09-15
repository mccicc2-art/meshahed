import { unfollowArtist } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import type { UnfollowArtistBody } from "@/core/contracts/person";

/** `POST /api/v1/track/unfollow-artist` — D-983: نفسُ `unfollowArtist`. */
export const POST = trackRoute<UnfollowArtistBody>((b) => unfollowArtist(b.personId), () => ["news"]);
