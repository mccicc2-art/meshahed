import { rateEpisode } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { EpisodeRateBody } from "@/core/contracts/track";

/** `POST /api/v1/track/episode-rate` — D-1011: نفسُ `rateEpisode` (تقييمُ حلقةٍ، و`null` يسحبه). */
export const POST = trackRoute<EpisodeRateBody>(rateEpisode, (b) => ["home", "me:library", "me:stats", titleTag("tv", b.showTmdbId)]);
