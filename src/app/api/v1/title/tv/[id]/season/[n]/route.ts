import { NextRequest } from "next/server";
import { getSeason } from "@/lib/tmdb";
import { getWatchedForShow, getUserId } from "@/lib/data";
import { episodeKey } from "@/core/keys";
import { handle, positiveInt, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { SeasonPayload } from "@/core/contracts/title";

/**
 * `GET /api/v1/title/tv/{id}/season/{n}` — حلقاتُ موسمٍ مع حالتي عليها.
 *
 * 🔑 **الحالةُ مدمجةٌ في الحلقة لا في قائمةٍ جانبيّة**: التطبيقُ يرسم
 * صفّاً واحداً من كائنٍ واحد — **وقائمتان تُطابَقان في العميل موضعُ
 * انزلاقٍ** (رقمُ حلقةٍ يُعاد ترقيمُه في TMDB فتُعلَّم غيرُها).
 *
 * ⚠️ **الموسمُ صفر (الخاصّات) مباح** كما في `/api/season` — `n >= 0`.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; n: string }> },
) {
  return handle(
    async () => {
      const { id, n } = await ctx.params;
      const tvId = positiveInt(id);
      const seasonNumber = Number(n);
      if (!tvId || !Number.isInteger(seasonNumber) || seasonNumber < 0)
        return fail("invalid_input");

      const uid = await getUserId();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      // نفسُ أرقام `/api/season` (القاعدة ٧): ٦٠ في الدقيقة
      const lim = limited(`v1:season:${uid ?? ip}`, 60, 60_000);
      if (lim) return lim;

      const [season, watched] = await Promise.all([
        getSeason(tvId, seasonNumber),
        uid ? getWatchedForShow(tvId) : new Set<string>(),
      ]);
      const payload: SeasonPayload = {
        tv_id: tvId,
        season_number: seasonNumber,
        episodes: season.episodes.map((e) => ({
          episode_number: e.episode_number,
          name: e.name,
          overview: e.overview,
          air_date: e.air_date,
          runtime: e.runtime,
          still_path: e.still_path,
          watched: watched.has(episodeKey(seasonNumber, e.episode_number)),
        })),
      };
      return ok(payload);
    },
    { cacheControl: "private, max-age=120" },
  );
}
