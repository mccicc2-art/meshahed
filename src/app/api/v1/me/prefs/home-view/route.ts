import { setHomeView } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { HomeViewBody } from "@/core/contracts/home";

/** `POST /api/v1/me/prefs/home-view` — بصريٌّ/مختصر (`HomeViewSwitch`، مجّانيٌّ بحكم D-791) */
export const POST = bodyRoute<HomeViewBody, { view: "visual" | "compact" }>(
  async (b) => ({ view: await setHomeView(String(b.view)) }),
  () => ["home"],
);
