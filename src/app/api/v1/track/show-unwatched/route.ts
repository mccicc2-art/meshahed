import { unmarkShow } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { ShowRefBody } from "@/core/contracts/track";

/** `POST /api/v1/track/show-unwatched` — D-989: نفسُ `unmarkShow` (يمسح حلقاتِ المسلسل المشاهَدة كلَّها؛ «منتهٍ ✓» يعود «علّمه مشاهَداً»). */
export const POST = trackRoute<ShowRefBody>(
  (b) => unmarkShow(b.showTmdbId),
  (b) => ["home", "me:library", "me:stats", titleTag("tv", b.showTmdbId)],
);
