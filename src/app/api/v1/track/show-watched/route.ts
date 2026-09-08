import { markShowWatched } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { ShowRefBody } from "@/core/contracts/track";

/** Phase 11 · B3 — الفعلُ نفسُه الذي تناديه قائمةُ Hold في الويب (`markShowWatched`)، بمعرّف المسلسل وحدَه */
export const POST = trackRoute<ShowRefBody>(
  (b) => markShowWatched(b.showTmdbId),
  (b) => ["home", "me:library", "me:stats", titleTag("tv", b.showTmdbId)],
);
