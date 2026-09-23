import { setWatchRegion } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { normalizeRegion } from "@/core/region";
import type { RegionBody } from "@/core/contracts/settings";

/** `POST /api/v1/me/settings/region` — بلدُ المشاهدة (كوكي — D-014). يُبطل ما يحمل منصّاتِ العرض. */
export const POST = bodyRoute<RegionBody, { region: string }>(
  async (b) => {
    const region = normalizeRegion(String(b.region));
    await setWatchRegion(region);
    return { region };
  },
  () => ["home", "news"],
);
