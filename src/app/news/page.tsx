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
import { getT } from "@/lib/locale";
import type { NewsItem } from "@/components/NewsPost";
import { NewsList } from "@/components/NewsList";

function dateOf(r: SearchResult) {
  return r.release_date ?? r.first_air_date ?? "";
}

export default async function NewsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const [movies, tv, follows] = await Promise.all([
    upcomingMovies().catch(() => [] as SearchResult[]),
    airingTv().catch(() => [] as SearchResult[]),
    getFollows(),
  ]);

  const followed = follows.map((f) => `${f.media_type}-${f.tmdb_id}`);
  const today = new Date().toISOString().slice(0, 10);

  // دمج الأفلام القادمة والمسلسلات الجارية: الأقرب موعداً أولاً
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
      const aFuture = a.date >= today;
      const bFuture = b.date >= today;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aFuture ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    })
    .slice(0, 30);

  // عدّادات 🔥 للعناصر الظاهرة فقط بدل قراءة جدول التفاعلات كاملاً
  const reactions = await getReactions(items.map((i) => i.id));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{t.newsTitle}</h1>
        <p className="text-muted text-sm mt-1">{t.newsSubtitle}</p>
      </header>

      {items.length === 0 ? (
        <p className="text-center text-muted py-20">{t.newsEmpty}</p>
      ) : (
        <NewsList
          items={items}
          locale={locale}
          counts={reactions.counts}
          mine={[...reactions.mine]}
          followed={followed}
        />
      )}
    </div>
  );
}
