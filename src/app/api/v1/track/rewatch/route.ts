import { startRewatch } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { ShowRefBody } from "@/core/contracts/track";

/** Phase 11 · B3 — الفعلُ نفسُه الذي تناديه قائمةُ Hold في الويب (`startRewatch`)، بمعرّف المسلسل وحدَه */
export const POST = trackRoute<ShowRefBody>(
  (b) => startRewatch(b.showTmdbId),
  (b) => ["home", "me:library", "me:diary", titleTag("tv", b.showTmdbId)],
);
