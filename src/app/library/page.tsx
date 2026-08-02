import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getAllMovieProgress,
} from "@/lib/data";
import { getTv } from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { num, type Dict } from "@/lib/i18n";
import { MediaSection, type LibraryEntry } from "@/components/LibraryTabs";

function fmtWatchTime(minutes: number, t: Dict) {
  const h = Math.round(minutes / 60);
  if (h < 24) return t.hours(h);
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest === 0 ? t.days(d) : t.daysAndHours(d, rest);
}

export default async function LibraryPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const [follows, watchedEps, watchedMovieIds, movieProgress] = await Promise.all([
    getFollows(),
    getAllWatchedEpisodes(),
    getWatchedMovieIds(),
    getAllMovieProgress(),
  ]);

  const watchedByShow = new Map<number, number>();
  for (const w of watchedEps)
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);

  const tvFollows = follows.filter((f) => f.media_type === "tv");
  const movieFollows = follows.filter((f) => f.media_type === "movie");

  // إجمالي الحلقات لمعرفة المكتمل من الجاري
  const tvTotals = new Map<number, number>();
  await Promise.all(
    tvFollows.map(async (f) => {
      const tv = await getTv(f.tmdb_id).catch(() => null);
      if (tv) tvTotals.set(f.tmdb_id, tv.number_of_episodes);
    }),
  );

  const shows: LibraryEntry[] = [];
  const movies: LibraryEntry[] = [];
  const watching: LibraryEntry[] = [];
  const finished: LibraryEntry[] = [];

  for (const f of tvFollows) {
    const done = watchedByShow.get(f.tmdb_id) ?? 0;
    const total = tvTotals.get(f.tmdb_id) ?? 0;
    const complete = total > 0 && done >= total;
    const entry: LibraryEntry = {
      key: `tv-${f.tmdb_id}`,
      href: `/show/${f.tmdb_id}`,
      title: f.title,
      posterPath: f.poster_path,
      kind: "tv",
      badge: complete ? t.watchedBadge : done > 0 ? t.episodesBadge(done) : undefined,
      progress: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : undefined,
    };
    shows.push(entry);
    if (complete) finished.push(entry);
    else if (done > 0) watching.push(entry);
  }

  for (const f of movieFollows) {
    const prog = movieProgress.find((p) => p.movie_tmdb_id === f.tmdb_id);
    const complete = watchedMovieIds.has(f.tmdb_id);
    const pct =
      !complete && prog?.runtime_minutes && prog.runtime_minutes > 0
        ? Math.round((prog.position_minutes / prog.runtime_minutes) * 100)
        : undefined;
    const entry: LibraryEntry = {
      key: `movie-${f.tmdb_id}`,
      href: `/movie/${f.tmdb_id}`,
      title: f.title,
      posterPath: f.poster_path,
      kind: "movie",
      badge: complete ? t.watchedBadge : prog ? t.minuteBadge(prog.position_minutes) : undefined,
      progress: complete ? 100 : pct,
    };
    movies.push(entry);
    if (complete) finished.push(entry);
    else if (prog) watching.push(entry);
  }

  // أفلام لها موضع توقف لكنها ليست ضمن المتابَعة
  for (const p of movieProgress) {
    if (movieFollows.some((f) => f.tmdb_id === p.movie_tmdb_id)) continue;
    if (watchedMovieIds.has(p.movie_tmdb_id)) continue;
    watching.push({
      key: `movie-${p.movie_tmdb_id}`,
      href: `/movie/${p.movie_tmdb_id}`,
      title: p.title ?? t.typeMovie,
      posterPath: p.poster_path,
      kind: "movie",
      badge: t.minuteBadge(p.position_minutes),
      progress:
        p.runtime_minutes && p.runtime_minutes > 0
          ? Math.round((p.position_minutes / p.runtime_minutes) * 100)
          : undefined,
    });
  }

  const epMinutes = watchedEps.reduce((s, e) => s + (e.runtime ?? 40), 0);
  const totalMinutes = epMinutes + watchedMovieIds.size * 110;
  const distinctShows = new Set(watchedEps.map((e) => e.show_tmdb_id)).size;

  const stats = [
    { label: t.statsWatchMinutes, value: fmtWatchTime(totalMinutes, t), icon: "⏱️" },
    { label: t.statsWatchedEpisodes, value: num(watchedEps.length, locale), icon: "✅" },
    { label: t.statsStartedShows, value: num(distinctShows, locale), icon: "📺" },
    { label: t.statsWatchedMovies, value: num(watchedMovieIds.size, locale), icon: "🎬" },
    { label: t.statsFollowing, value: num(follows.length, locale), icon: "⭐" },
    { label: t.libTabFinished, value: num(finished.length, locale), icon: "🏁" },
  ];

  return (
    <div className="space-y-12">
      <h1 className="text-2xl font-bold">{t.libraryTitle}</h1>

      <MediaSection
        title={t.libTabWatching}
        count={watching.length}
        items={watching}
        empty={t.libEmptyWatching}
      />

      <MediaSection
        title={t.libShowsGroup}
        count={shows.length}
        items={shows}
        empty={t.libEmptyFavorites}
      />

      <MediaSection
        title={t.libMoviesGroup}
        count={movies.length}
        items={movies}
        empty={t.libEmptyFavorites}
      />

      <MediaSection
        title={t.libTabFinished}
        count={finished.length}
        items={finished}
        empty={t.libEmptyFinished}
      />

      <section>
        <h2 className="text-lg font-bold mb-4">{t.statsTitle}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface border border-border rounded-2xl p-5">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-sm text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
