import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getProfile,
  getAllMovieProgress,
} from "@/lib/data";
import {
  getTv,
  trending,
  discoverByGenres,
  titleOf,
  yearOf,
  posterUrl,
  type TvDetails,
  type SearchResult,
} from "@/lib/tmdb";
import { PosterCard } from "@/components/PosterCard";
import { SearchBox } from "@/components/SearchBox";

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [follows, watchedEps, watchedMovieIds, profile, movieProgress] = await Promise.all([
    getFollows(),
    getAllWatchedEpisodes(),
    getWatchedMovieIds(),
    getProfile(),
    getAllMovieProgress(),
  ]);

  const tvFollows = follows.filter((f) => f.media_type === "tv");
  const movieFollows = follows.filter((f) => f.media_type === "movie");

  const watchedByShow = new Map<number, number>();
  for (const w of watchedEps) {
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
  }

  const tvDetails = await Promise.all(
    tvFollows.map((f) => getTv(f.tmdb_id).catch(() => null)),
  );

  type Item = { tv: TvDetails; watched: number; total: number; progress: number };
  const items: Item[] = [];
  const upcoming: { tv: TvDetails; date: string }[] = [];

  for (const tv of tvDetails) {
    if (!tv) continue;
    const watched = watchedByShow.get(tv.id) ?? 0;
    const total = tv.number_of_episodes;
    const progress = total ? Math.round((watched / total) * 100) : 0;
    items.push({ tv, watched, total, progress });
    if (tv.next_episode_to_air?.air_date) {
      upcoming.push({ tv, date: tv.next_episode_to_air.air_date });
    }
  }

  const continueWatching = items
    .filter((i) => i.watched > 0 && i.progress < 100)
    .sort((a, b) => b.progress - a.progress);
  const notStarted = items.filter((i) => i.watched === 0);
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const unwatchedMovies = movieFollows.filter((m) => !watchedMovieIds.has(m.tmdb_id));
  const empty = follows.length === 0;

  // TMDB خارجي — أي خلل فيه يجب ألا يُسقط الصفحة الرئيسية بالكامل
  const favGenres = profile?.favorite_genres ?? [];
  const followedIds = new Set(follows.map((f) => f.tmdb_id));

  const [trend, suggestedRaw] = await Promise.all([
    trending().catch(() => [] as SearchResult[]),
    favGenres.length
      ? discoverByGenres(favGenres, "tv").catch(() => [] as SearchResult[])
      : Promise.resolve([] as SearchResult[]),
  ]);

  const suggested = suggestedRaw.filter((r) => !followedIds.has(r.id)).slice(0, 12);
  const showTrending = empty || (!suggested.length && continueWatching.length === 0);

  return (
    <div className="space-y-10">
      <div className="max-w-xl mx-auto md:hidden">
        <Suspense fallback={null}>
          <SearchBox big />
        </Suspense>
      </div>

      {empty && (
        <section className="text-center py-6">
          <h1 className="text-2xl font-bold mb-2">
            أهلاً {profile?.nickname ? profile.nickname : "بك"} في مشاهد 👋
          </h1>
          <p className="text-muted mb-6">ابدأ بمتابعة مسلسل أو فيلم لتظهر هنا.</p>
        </section>
      )}

      {movieProgress.length > 0 && (
        <Section title="⏸️ أفلام توقّفت عندها">
          {movieProgress.map((m) => {
            const pct =
              m.runtime_minutes && m.runtime_minutes > 0
                ? Math.round((m.position_minutes / m.runtime_minutes) * 100)
                : 0;
            return (
              <PosterCard
                key={`mp-${m.movie_tmdb_id}`}
                href={`/movie/${m.movie_tmdb_id}`}
                title={m.title ?? "فيلم"}
                posterPath={m.poster_path}
                progress={pct}
                badge={`د ${m.position_minutes}`}
              />
            );
          })}
        </Section>
      )}

      {continueWatching.length > 0 && (
        <Section title="أكمل المشاهدة">
          {continueWatching.map(({ tv, progress }) => (
            <PosterCard
              key={tv.id}
              href={`/show/${tv.id}`}
              title={tv.name}
              posterPath={tv.poster_path}
              progress={progress}
              badge={`${progress}%`}
            />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4">🔔 القادم قريباً</h2>
          <div className="space-y-2">
            {upcoming.map(({ tv, date }) => (
              <Link
                key={tv.id}
                href={`/show/${tv.id}`}
                className="flex items-center gap-4 bg-surface border border-border rounded-xl p-3 hover:border-accent/50 transition"
              >
                <div className="w-12 shrink-0">
                  <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-surface-2">
                    {posterUrl(tv.poster_path, "w185") && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={posterUrl(tv.poster_path, "w185")!}
                        alt=""
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tv.name}</p>
                  <p className="text-xs text-muted">
                    الحلقة {tv.next_episode_to_air?.episode_number} · الموسم{" "}
                    {tv.next_episode_to_air?.season_number}
                  </p>
                </div>
                <span className="text-sm text-accent-2 shrink-0">{date}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {notStarted.length > 0 && (
        <Section title="مسلسلات لم تبدأها بعد">
          {notStarted.map(({ tv }) => (
            <PosterCard key={tv.id} href={`/show/${tv.id}`} title={tv.name} posterPath={tv.poster_path} />
          ))}
        </Section>
      )}

      {unwatchedMovies.length > 0 && (
        <Section title="أفلام في قائمتك">
          {unwatchedMovies.map((m) => (
            <PosterCard key={m.tmdb_id} href={`/movie/${m.tmdb_id}`} title={m.title} posterPath={m.poster_path} />
          ))}
        </Section>
      )}

      {suggested.length > 0 && (
        <Section title="✨ مقترح لك حسب ذوقك">
          {suggested.map((r) => (
            <PosterCard
              key={`sug-${r.id}`}
              href={`/show/${r.id}`}
              title={titleOf(r)}
              posterPath={r.poster_path}
              year={yearOf(r)}
            />
          ))}
        </Section>
      )}

      {favGenres.length === 0 && !empty && (
        <Link
          href="/profile"
          className="block text-center text-sm text-muted hover:text-accent border border-dashed border-border rounded-xl py-4 transition"
        >
          حدّد أنواعك المفضّلة في الملف الشخصي لتظهر لك اقتراحات على ذوقك ←
        </Link>
      )}

      {showTrending && trend.length > 0 && (
        <Section title="🔥 رائج هذا الأسبوع">
          {trend.slice(0, 12).map((r) => (
            <PosterCard
              key={`${r.media_type}-${r.id}`}
              href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`}
              title={titleOf(r)}
              posterPath={r.poster_path}
              year={yearOf(r)}
              badge={r.media_type === "tv" ? "مسلسل" : "فيلم"}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">{children}</div>
    </section>
  );
}
