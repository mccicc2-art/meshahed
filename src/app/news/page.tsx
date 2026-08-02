import { redirect } from "next/navigation";
import { getUser, getFollows, getReactions } from "@/lib/data";
import {
  upcomingMovies,
  airingTv,
  titleOf,
  posterUrl,
  backdropUrl,
  type SearchResult,
} from "@/lib/tmdb";
import { NewsPost, type NewsItem } from "@/components/NewsPost";

function dateOf(r: SearchResult) {
  return r.release_date ?? r.first_air_date ?? "";
}

export default async function NewsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [movies, tv, follows, reactions] = await Promise.all([
    upcomingMovies().catch(() => [] as SearchResult[]),
    airingTv().catch(() => [] as SearchResult[]),
    getFollows(),
    getReactions(),
  ]);

  const followed = new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`));

  // دمج الأفلام القادمة والمسلسلات الجارية وترتيبها بالأحدث موعداً
  const items: NewsItem[] = [...movies, ...tv]
    .filter((r) => r.media_type === "tv" || r.media_type === "movie")
    .map((r) => ({
      id: r.id,
      mediaType: r.media_type as "tv" | "movie",
      title: titleOf(r),
      overview: r.overview ?? "",
      poster: posterUrl(r.poster_path, "w342"),
      posterPath: r.poster_path,
      backdrop: backdropUrl(r.backdrop_path, "w780"),
      date: dateOf(r),
      rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : null,
    }))
    .sort((a, b) => {
      const today = new Date().toISOString().slice(0, 10);
      const aFuture = a.date >= today;
      const bFuture = b.date >= today;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aFuture ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    })
    .slice(0, 30);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">📰 الأخبار</h1>
        <p className="text-muted text-sm mt-1">
          أحدث الأفلام القادمة والمسلسلات الجارية — تفاعل بـ 🔥 أو أضفها لمفضلتك.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-center text-muted py-20">
          تعذّر تحميل الأخبار حالياً. حاول مرة أخرى بعد قليل.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {items.map((item) => {
            const key = `${item.mediaType}-${item.id}`;
            return (
              <NewsPost
                key={key}
                item={item}
                initialCount={reactions.counts[key] ?? 0}
                initialReacted={reactions.mine.has(key)}
                initialFollowing={followed.has(key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
