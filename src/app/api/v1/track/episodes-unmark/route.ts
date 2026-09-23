import { unmarkEpisodes } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { UnmarkEpisodesBody } from "@/core/contracts/track";

/**
 * `POST /api/v1/track/episodes-unmark` — D-1079: نفسُ `unmarkEpisodes` (يحذف الحلقاتِ المذكورة وحدَها).
 * رجعةُ الختم من بطاقة القائمة — يحذف ما أضافته الضغطةُ لا سجلَّ صاحبه (D-047)؛ و`unmarkEpisodes`
 * نفسُها تقصّ الطول وتتحقّق من كلِّ رقم، فلا تحقّقَ ثانياً هنا.
 */
export const POST = trackRoute<UnmarkEpisodesBody>(
  (b) => unmarkEpisodes({ showTmdbId: b.showTmdbId, episodes: Array.isArray(b.episodes) ? b.episodes : [] }),
  (b) => ["home", "me:library", "me:stats", titleTag("tv", b.showTmdbId)],
);
