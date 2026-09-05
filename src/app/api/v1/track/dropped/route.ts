import { setDropped } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { SetDroppedBody } from "@/core/contracts/track";

/**
 * `POST /api/v1/track/dropped` — D-916: البطاقةُ الحمراء أو رفعُها.
 * `setDropped` بمعاملاتٍ موضعيّة، فالسطرُ هنا يفكّ الجسمَ ولا يترجم شيئاً.
 */
export const POST = trackRoute<SetDroppedBody>(
  (b) => setDropped(b.tmdbId, b.mediaType, b.dropped),
  (b) => ["home", "me:library", titleTag(b.mediaType, b.tmdbId)],
);
