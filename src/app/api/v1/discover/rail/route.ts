import type { NextRequest } from "next/server";
import { curatedRail, isCuratedKey, dateOfResult, type CuratedKey } from "@/lib/discoverRails";
import { sectionHref } from "@/lib/sections";
import { getLocale, getWatchRegion } from "@/lib/locale";
import { handle, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { fail } from "@/lib/v1";
import { titleOf } from "@/core/media";
import type { CuratedRailPayload, CuratedCard } from "@/core/contracts/discover";

/**
 * `GET /api/v1/discover/rail?tab=shows|movies&key=<CuratedKey>` — صفٌّ منسَّقٌ
 * واحدٌ للشاشة الأصليّة (Phase 11-C · C1 · D-955).
 *
 * 🔑 **الوصفةُ وصفةُ الصفحة** (`curatedRail` — المصدرُ الواحد)، **واللغةُ
 * والمنطقةُ من الطلب** (`Accept-Language` · كوكي المنطقة، كما للصفحة). **مفتوحٌ
 * للضيف** كما «اكتشف» نفسُها (D-627)؛ الحدُّ بعنوان الشبكة.
 * ⚠️ **`private`**: `buildSection` تطيع تفضيلاتِ المحتوى لكلِّ قارئ.
 */
export async function GET(req: NextRequest) {
  return handle(
    async () => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:discover:rail:${ip}`, 120, 60_000);
      if (lim) return lim;
      const sp = req.nextUrl.searchParams;
      const tabRaw = sp.get("tab");
      const tab = tabRaw === "movies" ? "movies" : tabRaw === "anime" ? "anime" : "shows";
      const keyRaw = sp.get("key") ?? "";
      if (!isCuratedKey(keyRaw)) return fail("invalid_input", { field: "key" });
      const key: CuratedKey = keyRaw;
      const [locale, region] = await Promise.all([getLocale(), getWatchRegion()]);
      const type = tab === "movies" ? "movie" : tab === "anime" ? "anime" : "tv";
      const { items, region: cinemaRegion } = await curatedRail(key, { type, locale, region });
      const cards: CuratedCard[] = items
        .filter((r) => r.media_type === "tv" || r.media_type === "movie")
        .map((r) => ({
          kind: r.media_type === "tv" ? "tv" : "movie",
          id: r.id,
          title: titleOf(r),
          poster_path: r.poster_path,
          vote_average: r.vote_average ?? 0,
          year: dateOfResult(r).slice(0, 4) || null,
          imdb_rating: typeof r.imdb_rating === "number" ? r.imdb_rating : null,
          date: dateOfResult(r) || null,
        }));
      /* أبوابُ «عرض الكلّ» كما تضعها الصفحة: للأنمي `airing-now`/`most-popular`/`upcoming` وحدَها */
      const sectionKey =
        key === "cinemas" && type !== "anime"
          ? "in-cinemas"
          : key === "airing"
            ? "airing-now"
            : key === "popular"
              ? "most-popular"
              : key === "soon"
                ? "upcoming"
                : key.startsWith("top10") && type !== "anime"
                  ? "top-ten"
                  : null;
      const payload: CuratedRailPayload = {
        key,
        tab,
        /* المرتَّبُ بالأرقام: أفضل ١٠ وأفضل ٢٥/٥٠ — كما تقرّره `RankedRail` في الصفحة */
        ranked: key.startsWith("top10") || key.startsWith("top50"),
        region: cinemaRegion ?? null,
        see_all: sectionKey ? sectionHref(sectionKey, type) : null,
        items: cards,
      };
      return ok(payload);
    },
    { cacheControl: "private, max-age=600" },
  );
}
