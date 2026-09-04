import { watchUpTo } from "@/lib/actions";
import { trackRoute } from "@/lib/v1track";
import type { WatchUpToBody } from "@/core/contracts/track";

/** `POST /api/v1/track/watch-up-to` */
export const POST = trackRoute<WatchUpToBody>(watchUpTo, () => [
  "home",
  "me:library",
  "me:stats",
]);
