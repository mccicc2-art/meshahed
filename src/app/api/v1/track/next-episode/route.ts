import { markNextEpisode } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { ShowRefBody } from "@/core/contracts/track";

/** Phase 11 · B3 — الفعلُ نفسُه الذي تناديه قائمةُ Hold في الويب (`markNextEpisode`)، بمعرّف المسلسل وحدَه */
export const POST = trackRoute<ShowRefBody>(
  (b) => markNextEpisode(b.showTmdbId),
  (b) => ["home", "me:library", titleTag("tv", b.showTmdbId)],
);
