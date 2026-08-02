/* eslint-disable @next/next/no-img-element */
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
  getMovie,
  trending,
  discoverByGenres,
  titleOf,
  yearOf,
  type TvDetails,
  type SearchResult,
} from "@/lib/tmdb";
import { GENRES, genreName } from "@/lib/media";
import { getT } from "@/lib/locale";
import { num, type Dict } from "@/lib/i18n";
import { PosterCard } from "@/components/PosterCard";
import { Avatar } from "@/components/Avatar";

function fmtWatchTime(minutes: number, t: Dict) {
  const h = Math.round(minutes / 60);
  if (h < 24) return t.hours(h);
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest === 0 ? t.days(d) : t.daysAndHours(d, rest);
}

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

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

  const today = new Date().toISOString().slice(0, 10);

  const [tvDetails, movieDetails] = await Promise.all([
    Promise.all(tvFollows.map((f) => getTv(f.tmdb_id).catch(() => null))),
    Promise.all(movieFollows.map((f) => getMovie(f.tmdb_id).catch(() => null))),
  ]);

  interface UpcomingItem {
    key: string;
    href: string;
    title: string;
    posterPath: string | null;
    date: string;
    badge?: string;
  }

  type Item = { tv: TvDetails; watched: number; total: number; progress: number };
  const items: Item[] = [];
  const upcoming: UpcomingItem[] = [];

  for (const tv of tvDetails) {
    if (!tv) continue;
    const watched = watchedByShow.get(tv.id) ?? 0;
    const total = tv.number_of_episodes;
    const progress = total ? Math.min(100, Math.round((watched / total) * 100)) : 0;
    items.push({ tv, watched, total, progress });

    const next = tv.next_episode_to_air;
    if (next?.air_date) {
      upcoming.push({
        key: `tv-${tv.id}`,
        href: `/show/${tv.id}`,
        title: tv.name,
        posterPath: tv.poster_path,
        date: next.air_date,
        badge: `S${next.season_number} · E${next.episode_number}`,
      });
    }
  }

  // الأفلام التي تتابعها ولم تُطرح بعد تظهر أيضاً في «القادم قريباً»
  for (const m of movieDetails) {
    if (!m?.release_date || m.release_date < today) continue;
    upcoming.push({
      key: `movie-${m.id}`,
      href: `/movie/${m.id}`,
      title: m.title,
      posterPath: m.poster_path,
      date: m.release_date,
      badge: t.typeMovie,
    });
  }

  // أي عمل تتابعه ولم تُكمله يظهر في «أكمل المشاهدة» — حتى لو لم تبدأه بعد
  const continueWatching = items
    .filter((i) => i.total === 0 || i.watched < i.total)
    .sort((a, b) => {
      if (a.watched > 0 !== b.watched > 0) return a.watched > 0 ? -1 : 1;
      return b.progress - a.progress;
    });
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  // الأفلام المكتملة لا تظهر في الرئيسية
  const pausedMovies = movieProgress.filter((m) => !watchedMovieIds.has(m.movie_tmdb_id));

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

  const displayName = profile?.nickname || user.email?.split("@")[0] || "";
  const epMinutes = watchedEps.reduce((s, e) => s + (e.runtime ?? 40), 0);
  const totalMinutes = epMinutes + watchedMovieIds.size * 110;
  const favNames = GENRES.filter((g) => favGenres.includes(g.id));

  const stats = [
    { label: t.statWatchTime, value: fmtWatchTime(totalMinutes, t), icon: "⏱️" },
    { label: t.statEpisodes, value: num(watchedEps.length, locale), icon: "✅" },
    { label: t.statShows, value: num(tvFollows.length, locale), icon: "📺" },
    { label: t.statMovies, value: num(movieFollows.length, locale), icon: "🎬" },
  ];

  return (
    <div className="space-y-10">
      {/* بطاقة الملف الشخصي — الغلاف ثم الصورة والاسم ثم الإحصائيات */}
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="relative h-28 sm:h-40 bg-surface-2">
          {profile?.cover_url ? (
            <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background:
                  "linear-gradient(120deg, var(--glow-a), transparent 55%), linear-gradient(300deg, var(--glow-b), transparent 55%), var(--surface-2)",
              }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[color:var(--surface)] to-transparent" />
        </div>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
          <div className="-mt-12 sm:-mt-14 relative">
            <Avatar
              src={profile?.avatar_url}
              name={displayName}
              size={88}
              alt={t.avatarAlt}
              className="ring-4 ring-[color:var(--surface)]"
            />
          </div>

          <div className="mt-3">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{displayName}</h1>
            {profile?.username && (
              <p className="text-muted text-sm mt-0.5" dir="ltr">
                @{profile.username}
              </p>
            )}
          </div>

          {favNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {favNames.map((g) => (
                <span
                  key={g.id}
                  className="text-xs bg-surface-2 border border-border px-2.5 py-1 rounded-full"
                >
                  {g.emoji} {genreName(g, locale)}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
            {stats.map((s) => (
              <div key={s.label} className="bg-surface-2 rounded-xl p-3 text-center">
                <div className="text-lg">{s.icon}</div>
                <div className="text-base font-bold mt-0.5">{s.value}</div>
                <div className="text-[11px] text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {empty && (
        <section className="text-center py-4">
          <p className="text-muted">{t.emptyStart}</p>
        </section>
      )}

      {pausedMovies.length > 0 && (
        <Section title={t.pausedMovies}>
          {pausedMovies.map((m) => {
            const pct =
              m.runtime_minutes && m.runtime_minutes > 0
                ? Math.round((m.position_minutes / m.runtime_minutes) * 100)
                : 0;
            return (
              <PosterCard
                key={`mp-${m.movie_tmdb_id}`}
                href={`/movie/${m.movie_tmdb_id}`}
                title={m.title ?? t.typeMovie}
                posterPath={m.poster_path}
                progress={pct}
                badge={t.minuteBadge(m.position_minutes)}
              />
            );
          })}
        </Section>
      )}

      {continueWatching.length > 0 && (
        <Section title={t.continueWatching}>
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
        <Section title={t.comingSoon}>
          {upcoming.map((u) => (
            <PosterCard
              key={u.key}
              href={u.href}
              title={u.title}
              posterPath={u.posterPath}
              year={u.date}
              badge={u.badge}
            />
          ))}
        </Section>
      )}

      {suggested.length > 0 && (
        <Section title={t.suggestedForYou}>
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
          href="/profile/edit"
          className="block text-center text-sm text-muted hover:text-accent border border-dashed border-border rounded-xl py-4 transition"
        >
          {t.pickGenresHint}
        </Link>
      )}

      {showTrending && trend.length > 0 && (
        <Section title={t.trendingWeek}>
          {trend.slice(0, 12).map((r) => (
            <PosterCard
              key={`${r.media_type}-${r.id}`}
              href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`}
              title={titleOf(r)}
              posterPath={r.poster_path}
              year={yearOf(r)}
              badge={r.media_type === "tv" ? t.typeSeries : t.typeMovie}
            />
          ))}
        </Section>
      )}

      <form action="/auth/signout" method="post" className="sm:hidden">
        <button className="w-full py-3 rounded-xl border border-border text-muted hover:text-red-300 hover:border-red-400/60 transition">
          {t.signOutFull}
        </button>
      </form>
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
