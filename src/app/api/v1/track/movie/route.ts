import { toggleMovieWatched } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { ToggleMovieBody } from "@/core/contracts/track";

/** `POST /api/v1/track/movie` */
export const POST = trackRoute<ToggleMovieBody>(toggleMovieWatched, (b) => [
  "home",
  "me:stats",
  titleTag("movie", b.movieTmdbId),
]);
