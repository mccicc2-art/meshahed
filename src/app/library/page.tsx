import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
} from "@/lib/data";
import { PosterCard } from "@/components/PosterCard";

export default async function LibraryPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [follows, watchedEps, watchedMovieIds] = await Promise.all([
    getFollows(),
    getAllWatchedEpisodes(),
    getWatchedMovieIds(),
  ]);

  const watchedByShow = new Map<number, number>();
  for (const w of watchedEps)
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);

  const tv = follows.filter((f) => f.media_type === "tv");
  const movies = follows.filter((f) => f.media_type === "movie");

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">مكتبتي</h1>

      {follows.length === 0 && (
        <p className="text-center text-muted py-16">
          مكتبتك فارغة — ابحث عن عمل وتابعه ليظهر هنا.
        </p>
      )}

      {tv.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4">المسلسلات ({tv.length})</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {tv.map((f) => {
              const c = watchedByShow.get(f.tmdb_id) ?? 0;
              return (
                <PosterCard
                  key={f.tmdb_id}
                  href={`/show/${f.tmdb_id}`}
                  title={f.title}
                  posterPath={f.poster_path}
                  badge={c > 0 ? `${c} حلقة` : undefined}
                />
              );
            })}
          </div>
        </section>
      )}

      {movies.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4">الأفلام ({movies.length})</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {movies.map((f) => (
              <PosterCard
                key={f.tmdb_id}
                href={`/movie/${f.tmdb_id}`}
                title={f.title}
                posterPath={f.poster_path}
                badge={watchedMovieIds.has(f.tmdb_id) ? "✓ شوهد" : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
