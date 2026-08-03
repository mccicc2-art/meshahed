import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { getSeason } from "@/lib/tmdb";
import { allow, retryAfter } from "@/lib/ratelimit";

/**
 * حلقات موسم واحد، تُطلب عند فتح الموسم في صفحة المسلسل.
 *
 * كانت الصفحة تجلب كل المواسم دفعة واحدة: مسلسل بثلاثين موسماً يعني
 * ثلاثين طلب TMDB وحمولة ضخمة تُرسل للمتصفح ولا يُقرأ منها إلا موسم واحد.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ episodes: [] }, { status: 401 });

  const key = `season:${user.id}`;
  if (!allow(key, 60, 60_000)) {
    return NextResponse.json(
      { episodes: [] },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const params = new URL(request.url).searchParams;
  const tvId = Number(params.get("tv"));
  const seasonNumber = Number(params.get("s"));

  if (!Number.isInteger(tvId) || tvId <= 0 || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return NextResponse.json({ episodes: [] }, { status: 400 });
  }

  try {
    const season = await getSeason(tvId, seasonNumber);
    const episodes = season.episodes.map((e) => ({
      episode_number: e.episode_number,
      name: e.name,
      air_date: e.air_date,
      runtime: e.runtime,
      still_path: e.still_path,
    }));
    return NextResponse.json(
      { episodes },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return NextResponse.json({ episodes: [] }, { status: 502 });
  }
}
