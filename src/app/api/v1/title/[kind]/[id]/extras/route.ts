import type { NextRequest } from "next/server";
import { titleExtras } from "@/lib/titleExtras";
import { getUserId } from "@/lib/data";
import { handle, limited, fail, positiveInt } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { TitleExtrasPayload } from "@/core/contracts/title";

/**
 * `GET /api/v1/title/{kind}/{id}/extras` — ملحقاتُ البطل (Phase 11-D · D2 · D-956).
 *
 * 🔑 **ردٌّ ثانٍ لا يحبس الأوّل**: البطلُ والأفعالُ تصل من `/title/{kind}/{id}`
 * فوراً، وهذا يلحق (IMDb/RT عبر OMDb · المزوّدون · الطاقم · المشابهات) — **كما
 * تفعل الصفحةُ بـ`Suspense` حول كلِّ قسم**. الوصفةُ في `src/lib/titleExtras.ts`
 * (المصدرُ الواحد مع `HeroRatings`/`RelatedTitles`/`CastRail`). **`private`**:
 * فيه قوائمي والمفضّل.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  return handle(
    async () => {
      const { kind, id } = await ctx.params;
      const tmdbId = positiveInt(id);
      if (!tmdbId || (kind !== "tv" && kind !== "movie")) return fail("invalid_input");
      const uid = await getUserId();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:title:extras:${uid ?? ip}`, 60, 60_000);
      if (lim) return lim;
      const x = await titleExtras(kind, tmdbId);
      const groups = x.watch
        ? (["flatrate", "free", "rent", "buy"] as const)
            .map((key) => ({
              key,
              providers: (x.watch!.options[key] ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logo_path: p.logo_path, link: x.watch!.links[p.provider_id] ?? null })),
            }))
            .filter((g) => g.providers.length > 0)
        : [];
      const payload: TitleExtrasPayload = {
        ratings: x.ratings ? { imdb: x.ratings.imdb ?? null, rt: x.ratings.rt ?? null, rated: x.ratings.rated ?? null } : null,
        pulse: x.pulse,
        watch: x.watch && groups.length ? { region: x.watch.region, groups } : null,
        cast: x.cast,
        collection: x.collection,
        related: x.related,
        my_lists: x.my_lists,
        containing: x.containing,
        favorite: x.favorite,
      };
      return ok(payload);
    },
    { cacheControl: "private, max-age=300" },
  );
}
