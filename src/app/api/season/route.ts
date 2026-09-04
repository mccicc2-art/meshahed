import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { getSeason, tvImdbId } from "@/lib/tmdb";
import { seasonImdbRatings } from "@/lib/omdb";
import { allow, retryAfter } from "@/core/ratelimit";

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
  /* r=1: أرفق تقييمات IMDb للحلقات — يطلبها متتبّع الحلقات فقط بعد أن
     يضغط المستخدم زرّ الكشف، فلا تُحرق حصة OMDb على من لم يطلبها */
  const withRatings = params.get("r") === "1";

  if (!Number.isInteger(tvId) || tvId <= 0 || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return NextResponse.json({ episodes: [] }, { status: 400 });
  }

  try {
    const [season, ratings] = await Promise.all([
      getSeason(tvId, seasonNumber),
      withRatings
        ? tvImdbId(tvId).then((iid) => seasonImdbRatings(iid, seasonNumber))
        : Promise.resolve({} as Record<number, number>),
    ]);
    const episodes = season.episodes.map((e) => ({
      episode_number: e.episode_number,
      name: e.name,
      air_date: e.air_date,
      runtime: e.runtime,
      still_path: e.still_path,
      // undefined يسقط من JSON — الحقل لا يظهر أصلاً في الردّ العادي
      imdb_rating: withRatings ? (ratings[e.episode_number] ?? null) : undefined,
    }));
    return NextResponse.json(
      { episodes },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return NextResponse.json({ episodes: [] }, { status: 502 });
  }
}
