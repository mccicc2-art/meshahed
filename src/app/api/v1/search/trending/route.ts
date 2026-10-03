import type { NextRequest } from "next/server";
import { getUserId } from "@/lib/data";
import { handle, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { trendingSearch } from "@/lib/searchCore";
import type { SearchTrendingPayload } from "@/core/contracts/search";

/**
 * `GET /api/v1/search/trending` — «رائج اليوم» لشاشة البحث الأصليّة (٣ أكتوبر ٢٠٢٦).
 *
 * 🔑 **النواةُ نواةُ صفحة الويب نفسُها** (`trendingSearch` في `lib/searchCore.ts`): عشرةُ أعمالٍ بترتيب
 * TMDB اليوميّ، أفلاماً ومسلسلاتٍ وأنمي معاً، بلا تفضيلاتِ محتوى وبلا علامةِ «عندك» (قرارُ أحمد).
 *
 * 🔑 **مفتوحٌ للزائر كالبحث** (D-627) وبحدِّه. و`private` لأنّ الأسماءَ بلغة صاحب الكوكي ووضعِ عرضه؛
 * عشرُ دقائقَ في الجهاز تكفي — وخلفها خبيئةُ TMDB ساعةً، فالنداءُ لا يكلّف حصّةً تُذكر.
 */
export async function GET(req: NextRequest) {
  return handle<SearchTrendingPayload>(async () => {
    const uid = await getUserId();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const lim = limited(`search:${uid ?? ip}`, 40, 60_000);
    if (lim) return lim;
    return ok({ items: await trendingSearch() });
  }, { cacheControl: "private, max-age=600" });
}
