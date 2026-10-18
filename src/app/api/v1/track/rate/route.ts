import { saveRating } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import { titleTag } from "@/core/contracts/tags";
import type { RateBody } from "@/core/contracts/track";

/** `POST /api/v1/track/rate` — D-919: نفسُ `saveRating` (يُبطل صفحةَ العمل والرئيسية).
 * 🆕 D-1357 — و`me:ratings`: شاشةُ «تقييماتي» الأصليّة مفتاحُها هذا الوسم، فتتجدّد بعد التقييم من صفحة العمل.
 * 🆕 D-1467 — والتقييمُ الأوّلُ يعلّم المشاهدةَ ويضيف المسلسلَ للمكتبة، فتتجدّد المكتبةُ والإحصاءُ معه. */
export const POST = trackRoute<RateBody>(saveRating, (b) => [
  titleTag(b.mediaType, b.tmdbId),
  "home",
  "me:ratings",
  "me:library",
  "me:stats",
]);
