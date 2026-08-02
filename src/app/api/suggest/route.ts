import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { searchMulti, titleOf, yearOf, posterUrl } from "@/lib/tmdb";

// اقتراحات البحث الفورية — يبقى مفتاح TMDB على الخادم
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ results: [] });

  try {
    const found = await searchMulti(q);
    const results = found.slice(0, 8).map((r) => ({
      id: r.id,
      mediaType: r.media_type,
      title: titleOf(r),
      year: yearOf(r),
      poster: posterUrl(r.poster_path, "w185"),
      rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : null,
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
