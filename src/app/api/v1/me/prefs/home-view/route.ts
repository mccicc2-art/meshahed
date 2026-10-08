import { setHomeView } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { HomeViewBody } from "@/core/contracts/home";

/** `POST /api/v1/me/prefs/home-view` — بصريٌّ/مختصر/مزدوج (D-1321) (`HomeViewSwitch`، مجّانيٌّ بحكم D-791) */
export const POST = bodyRoute<HomeViewBody, { view: HomeViewBody["view"] }>(
  async (b) => ({ view: await setHomeView(String(b.view)) }),
  () => ["home"],
);
