import type { NextRequest } from "next/server";
import { listWatchProviders } from "@/lib/tmdb";
import { getWatchRegion } from "@/lib/locale";
import { handle, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { ProvidersPayload } from "@/core/contracts/discover";

/**
 * `GET /api/v1/discover/providers?tab=` — قائمةُ منصّات الاشتراك لورقة الفلاتر الأصليّة (D-992).
 * المصدرُ `listWatchProviders` نفسُه الذي تقرؤه الصفحة (مخبَّأٌ ساعةً في طبقة fetch)، وبلدُ
 * المشاهدة معه ليُكتب في عنوان المحور («المنصّة في السعودية») كما في الورقة الويبيّة.
 */
export async function GET(req: NextRequest) {
  return handle(
    async () => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:discover:providers:${ip}`, 60, 60_000);
      if (lim) return lim;
      const tab = req.nextUrl.searchParams.get("tab");
      const [providers, region] = await Promise.all([
        listWatchProviders(tab === "movies" ? "movie" : "tv").catch(() => []),
        getWatchRegion(),
      ]);
      const payload: ProvidersPayload = { region, providers: providers.map((p) => ({ id: p.id, name: p.name, logo_path: p.logo_path ?? null })) };
      return ok(payload);
    },
    { cacheControl: "private, max-age=3600" },
  );
}
