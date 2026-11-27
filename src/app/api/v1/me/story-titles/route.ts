import type { NextRequest } from "next/server";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getProfile } from "@/lib/data";
import { asTimeZone } from "@/core/zone";
import { storyTitles } from "@/lib/historyShare";
import type { StoryTitlesPayload } from "@/core/contracts/report";

/**
 * `GET /api/v1/me/story-titles?p=year|all` — 🆕 أعمالُ القصّة (حصاد 2026 وقصّة «إحصائياتك»): «مسلسلُ سنتك» وتالياه، و«أكثرُ ما
 * أحببت». الأرقامُ نفسُها في التقرير (`/me/report`)؛ هنا ما لا يحمله التقرير: الاسمُ بقاعدة لوبز وتقييمُك.
 */
export async function GET(req: NextRequest) {
  return handle<StoryTitlesPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:story-titles:${auth.user.id}`, 20, 60_000);
    if (lim) return lim;
    const period = req.nextUrl.searchParams.get("p") === "all" ? "all" : "year";
    const profile = await getProfile();
    return ok(await storyTitles(period, await getLocale(), asTimeZone(profile?.timezone)));
  });
}
