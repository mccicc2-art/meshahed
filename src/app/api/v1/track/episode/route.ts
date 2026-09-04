import { toggleEpisode } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import type { ToggleEpisodeBody } from "@/core/contracts/track";

/** `POST /api/v1/track/episode` — نفسُ `toggleEpisode` بلا وسمِ العمل (تفاؤليّ). */
export const POST = trackRoute<ToggleEpisodeBody>(toggleEpisode, (b) =>
  b.watched ? ["home", "me:stats", "me:library"] : ["home", "me:stats"],
);
