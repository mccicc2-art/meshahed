import type { NextRequest } from "next/server";
import { getTrailer } from "@/lib/tmdb";
import { handle, limited, fail, positiveInt } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { TitleTrailerPayload } from "@/core/contracts/title";

/**
 * `GET /api/v1/title/{tv|movie}/{id}/trailer` — مفتاحُ الإعلان وحدَه (D-1262).
 *
 * **لماذا**: صفحةُ العمل كانت تنتظر الإعلانَ مع التفاصيل، والقياسُ (D-1261) أظهر أنّه وحدَه يؤخّر الردَّ
 * في نحو ثلث الفتحات الباردة. التطبيقُ يطلبه هنا **بالتوازي** مع الصفحة: التفاصيلُ تصل حين تجهز،
 * والإعلانُ يصل حين يجهز — لا ينتظر أحدُهما الآخر.
 *
 * ⚖️ **عامٌّ بلا هويّة**: لا شيءَ شخصيّاً في الردّ، فالحدُّ بالعنوان وحدَه ولا يُسأل عن المستخدم.
 * والاختيارُ هو `getTrailer` نفسُه الذي تستعمله الصفحة — قاعدةٌ واحدة، بابان.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  return handle(
    async () => {
      const { kind, id } = await ctx.params;
      const tmdbId = positiveInt(id);
      if (!tmdbId || (kind !== "tv" && kind !== "movie")) return fail("invalid_input");
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:title:trailer:${ip}`, 120, 60_000);
      if (lim) return lim;
      const trailer = await getTrailer(kind, tmdbId).catch(() => null);
      const payload: TitleTrailerPayload = { trailer_key: trailer?.key ?? null };
      return ok(payload);
    },
    { cacheControl: "private, max-age=300" },
  );
}
