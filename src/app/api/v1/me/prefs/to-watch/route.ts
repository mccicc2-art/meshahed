import { setToWatchQueue } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { ToWatchBody } from "@/core/contracts/library";

/** `POST /api/v1/me/prefs/to-watch` — رايةُ طابور «للمشاهدة» في الرئيسيّة (D-559) */
export const POST = bodyRoute<ToWatchBody, { on: boolean }>(
  async (b) => ({ on: await setToWatchQueue(!!b.on) }),
  () => ["me:lists", "home"],
);
