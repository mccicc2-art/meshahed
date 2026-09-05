import { NextRequest } from "next/server";
import {
  topTenThisWeek,
  topTenAnimeThisWeek,
  airingTv,
  upcomingMovies,
  type SearchResult,
} from "@/lib/tmdb";
import { handle, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { DiscoverCard, DiscoverPayload, DiscoverRail } from "@/core/contracts/home";

/**
 * `GET /api/v1/discover` — خمسةُ صفوفٍ عامّة للتطبيق (D-919).
 *
 * 🔑 **الدوالُّ دوالُّ «اكتشف» في الويب نفسُها** (`topTenThisWeek` ·
 * `topTenAnimeThisWeek` · `airingTv` · `upcomingMovies`) — فما يراه في
 * الجوّال هو ما يراه في الموقع، بحواجز الأصوات نفسِها (D-185/D-202).
 *
 * **عامٌّ وقابلٌ للكاش**: لا حالةَ شخصيّةً فيه، فالـCDN يحمله ساعةً
 * (D-914: ما لا يتغيّر بالمستخدم لا يُحسب على الدالّة).
 */
const card = (kind: "tv" | "movie") => (r: SearchResult): DiscoverCard => ({
  kind,
  id: r.id,
  title: r.title ?? r.name ?? "",
  poster_path: r.poster_path,
  vote_average: r.vote_average ?? 0,
  year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4) || null,
});

export async function GET(req: NextRequest) {
  return handle(
    async () => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:discover:${ip}`, 30, 60_000);
      if (lim) return lim;

      const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
      const [tv, movie, anime, airing, upcoming] = await Promise.all([
        safe(topTenThisWeek("tv", 20)),
        safe(topTenThisWeek("movie", 20)),
        safe(topTenAnimeThisWeek(20)),
        safe(airingTv()),
        safe(upcomingMovies()),
      ]);
      const all: DiscoverRail[] = [
        { key: "trending_tv", items: tv.map(card("tv")) },
        { key: "trending_movie", items: movie.map(card("movie")) },
        { key: "anime", items: anime.map(card("tv")) },
        { key: "airing", items: airing.slice(0, 20).map(card("tv")) },
        { key: "upcoming", items: upcoming.slice(0, 20).map(card("movie")) },
      ];
      const rails = all.filter((r) => r.items.length > 0);
      const payload: DiscoverPayload = { rails };
      return ok(payload);
    },
    { cacheControl: "public, s-maxage=3600, stale-while-revalidate=600" },
  );
}
