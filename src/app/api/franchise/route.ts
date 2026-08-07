import { NextResponse } from "next/server";
import { getUser, getWatchedMovieIds, getFollows } from "@/lib/data";
import { getCollection, posterUrl, titleOf, yearOf } from "@/lib/tmdb";
import { allow, retryAfter } from "@/lib/ratelimit";

/**
 * أجزاء السلسلة، مع حالة كلّ جزءٍ عند صاحب الحساب.
 *
 * لماذا مسارٌ منفصل بدل تمريرها مع الصفحة: هذه القائمة لا تُعرض إلا بعد
 * ضغطة ✓ — أي لقلّةٍ من زوّار الصفحة. جلبها مع كل فتحة صفحةٍ يدفع ثمنها
 * الجميع ليستفيد قليل، وتأخيرُها بعد الضغطة يُخفيه هيكلٌ قصير. والطلب
 * مخبّأ ساعةً في طبقة `tmdb()` فالضغطة الثانية على العمل نفسه لا تكلّف
 * شيئاً.
 *
 * وتُرجع `watched` و`saved` لكل جزء: زرٌّ يبدأ فارغاً وقد أشاهدتَ صاحبه
 * فعلاً يكذب على المستخدم ويدفعه إلى ضغطةٍ لا لزوم لها.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ parts: [] }, { status: 401 });

  const key = `franchise:${user.id}`;
  if (!allow(key, 30, 60_000)) {
    return NextResponse.json(
      { parts: [] },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const exclude = Number(url.searchParams.get("exclude"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ parts: [] });

  const [collection, watchedIds, follows] = await Promise.all([
    getCollection(id),
    getWatchedMovieIds(),
    getFollows(),
  ]);
  if (!collection) return NextResponse.json({ parts: [] });

  const saved = new Set(
    follows.filter((f) => f.media_type === "movie").map((f) => f.tmdb_id),
  );

  const parts = collection.parts
    .filter((p) => p.id !== exclude)
    .map((p) => ({
      id: p.id,
      title: titleOf(p),
      year: yearOf(p),
      poster: posterUrl(p.poster_path, "w342"),
      watched: watchedIds.has(p.id),
      saved: saved.has(p.id),
    }));

  return NextResponse.json({ name: collection.name, parts });
}
