import type { NextRequest } from "next/server";
import { getTrailerFeed } from "@/lib/trailers";
import { trailerKeyOf } from "@/lib/trailerCard";
import { getLocale } from "@/lib/locale";
import { handle, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { TrailerCard, TrailersRailPayload } from "@/core/contracts/discover";

/**
 * `GET /api/v1/discover/trailers?tab=shows|movies|anime` — صفُّ التريلرات
 * للشاشة الأصليّة (D-958 · ١٤ سبتمبر ٢٠٢٦).
 *
 * 🔑 **الوصفةُ وصفةُ الصفحة** (`getTrailerFeed` — المصدرُ الواحد، بالحدّ نفسِه ٩
 * كما `TrailersSection` بعد D-756)، **والمشغّلُ يبقى ويبيّاً بقرار C3**: الشاشةُ
 * ترسم الخلفيّةَ وزرَّ ▶، والضغطُ بابٌ إلى `/trailers?at=` حيث المشغّلُ الواحد
 * (D-759) وصوتُه وتبديلُ الخانات. **مفتوحٌ للضيف** كالصفحة؛ الحدُّ بعنوان الشبكة.
 * ⚠️ **`private`**: الاقتراحاتُ تطيع المصروفَ والمُشاهَد لكلِّ قارئ.
 */
export async function GET(req: NextRequest) {
  return handle(
    async () => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:discover:trailers:${ip}`, 60, 60_000);
      if (lim) return lim;
      const tabRaw = req.nextUrl.searchParams.get("tab");
      const tab = tabRaw === "movies" ? "movies" : tabRaw === "anime" ? "anime" : "shows";
      const locale = await getLocale();
      /* الصمتُ عند الفشل مقصودٌ كما في الصفحة: صفٌّ زائد لا يُسقط «اكتشف» */
      const items = await getTrailerFeed(9, locale, tab).catch(() => []);
      const seeAll = `/trailers?scope=${tab}&from=${encodeURIComponent(`/news?tab=${tab}`)}`;
      const cards: TrailerCard[] = items.map((i) => ({
        kind: i.mediaType,
        id: i.tmdbId,
        title: i.title,
        year: i.year,
        genre: i.genre,
        backdrop: i.backdrop,
        video_key: i.videoKey,
        href: `${seeAll}&at=${trailerKeyOf(i)}`,
      }));
      const payload: TrailersRailPayload = { tab, see_all: seeAll, items: cards };
      return ok(payload);
    },
    { cacheControl: "private, max-age=300" },
  );
}
