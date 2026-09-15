import { dismissTitle } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import type { DismissBody } from "@/core/contracts/track";

/** `POST /api/v1/track/dismiss` — D-978: نفسُ `dismissTitle` («غير مهتمّ» من قائمة الضغط المطوّل في «اكتشف» الأصليّة؛ يُبطل `/news`). */
export const POST = trackRoute<DismissBody>(dismissTitle, () => ["news"]);
