import { setSeasonWatched } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { SetSeasonBody } from "@/core/contracts/track";

/** `POST /api/v1/track/season` — يُبطل صفحةَ العمل كما يفعل الفعل. */
export const POST = trackRoute<SetSeasonBody>(setSeasonWatched, (b) => [
  "home",
  "me:library",
  "me:stats",
  titleTag("tv", b.showTmdbId),
]);
