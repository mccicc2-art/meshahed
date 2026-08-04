import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getAllMovieProgress,
} from "@/lib/data";
import { getTv, getMovie, getSeason } from "@/lib/tmdb";
import { posterUrl } from "@/lib/media";
import { getT } from "@/lib/locale";
import { nextUnwatchedEpisode, airedEpisodeCount } from "@/lib/progress";
import { episodeKey } from "@/lib/keys";
import { whenLabel, formatDate } from "@/lib/when";
import { Icon } from "@/components/Icon";
import {
  LibraryView,
  type ShowRow,
  type ShowUpcomingRow,
  type MovieRow,
} from "@/components/LibraryView";

/** سقف الطلبات الخارجية: مكتبة ضخمة لا تفتح مئة اتصال */
const TV_LIMIT = 24;
const MOVIE_LIMIT = 24;
const SEASON_LIMIT = 8;

/**
 * المكتبة.
 *
 * تبويبان: مسلسلات وأفلام، وتحت كلٍّ منهما «للمشاهدة» و«القادم». الصفّ
 * يجيب عن سؤال الصفحة مباشرةً — الحلقة التالية بالضبط وكم باقٍ بعدها —
 * وزرّ التأشير في طرفه يغني عن فتح صفحة العمل لحلقة واحدة.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { filter } = await searchParams;
  const initialTab = filter === "movie" ? "movies" : "shows";

  const [follows, watchedEpisodes, watchedMovieIds, movieProgress] = await Promise.all([
    getFollows(),
    getAllWatchedEpisodes(),
    getWatchedMovieIds(),
    getAllMovieProgress(),
  ]);

  // مفاتيح الحلقات المشاهَدة لكل مسلسل — تُبنى من قراءة واحدة لا من قراءة
  // لكل مسلسل، ومنها يُشتقّ العدد والحلقة التالية معاً
  const keysByShow = new Map<number, Set<string>>();
  for (const w of watchedEpisodes) {
    if (!keysByShow.has(w.show_tmdb_id)) keysByShow.set(w.show_tmdb_id, new Set());
    keysByShow.get(w.show_tmdb_id)!.add(episodeKey(w.season_number, w.episode_number));
  }

  const tvFollows = follows.filter((f) => f.media_type === "tv").slice(0, TV_LIMIT);
  const movieFollows = follows.filter((f) => f.media_type === "movie").slice(0, MOVIE_LIMIT);

  const [tvDetails, movieDetails] = await Promise.all([
    Promise.all(tvFollows.map((f) => getTv(f.tmdb_id).catch(() => null))),
    Promise.all(movieFollows.map((f) => getMovie(f.tmdb_id).catch(() => null))),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    weekday: "long",
    timeZone: "UTC",
  });

  const shows: ShowRow[] = [];
  const showsUpcoming: ShowUpcomingRow[] = [];

  tvFollows.forEach((f, i) => {
    const tv = tvDetails[i];
    const keys = keysByShow.get(f.tmdb_id) ?? new Set<string>();
    const aired = f.aired_episodes ?? (tv ? airedEpisodeCount(tv) : (f.total_episodes ?? 0));
    const watchedCount = keys.size;

    const next = tv ? nextUnwatchedEpisode(tv, keys) : null;
    if (next) {
      shows.push({
        tmdbId: f.tmdb_id,
        title: f.title,
        posterUrl: posterUrl(f.poster_path, "w185"),
        season: next.season,
        episode: next.episode,
        episodeName: null,
        // الباقي بعد هذه الحلقة
        remaining: Math.max(0, aired - watchedCount - 1),
        runtime: tv?.episode_run_time?.[0] ?? null,
        started: watchedCount > 0,
      });
    }

    const up = tv?.next_episode_to_air;
    const date = up?.air_date ?? f.next_air_date ?? null;
    if (date && date >= today) {
      showsUpcoming.push({
        tmdbId: f.tmdb_id,
        title: f.title,
        posterUrl: posterUrl(f.poster_path, "w185"),
        season: up?.season_number ?? 0,
        episode: up?.episode_number ?? 0,
        episodeName: up?.name ?? null,
        date,
        dayLabel: weekday.format(new Date(`${date}T12:00:00Z`)),
        whenLabel: whenLabel(date, t),
      });
    }
  });

  showsUpcoming.sort((a, b) => a.date.localeCompare(b.date));

  // أسماء الحلقات لأوّل صفوف «للمشاهدة» فقط: الاسم زينة مفيدة لا شرطٌ
  // لقراءة الصفّ، ولا يستحقّ طلباً لكل مسلسل في المكتبة
  const named = shows.slice(0, SEASON_LIMIT);
  const seasons = await Promise.all(
    named.map((r) => getSeason(r.tmdbId, r.season).catch(() => null)),
  );
  named.forEach((r, i) => {
    r.episodeName = seasons[i]?.episodes.find((e) => e.episode_number === r.episode)?.name ?? null;
  });

  const movies: MovieRow[] = [];
  const moviesUpcoming: MovieRow[] = [];
  const monthFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  movieFollows.forEach((f, i) => {
    if (watchedMovieIds.has(f.tmdb_id)) return;
    const m = movieDetails[i];
    const release = m?.release_date ?? null;
    const prog = movieProgress.find((p) => p.movie_tmdb_id === f.tmdb_id);

    if (release && release >= today) {
      moviesUpcoming.push({
        tmdbId: f.tmdb_id,
        title: f.title,
        posterUrl: posterUrl(f.poster_path, "w185"),
        meta: formatDate(release, t),
        when: whenLabel(release, t),
        groupLabel: monthFmt.format(new Date(`${release}T12:00:00Z`)),
        runtime: m?.runtime ?? null,
      });
      return;
    }

    movies.push({
      tmdbId: f.tmdb_id,
      title: f.title,
      posterUrl: posterUrl(f.poster_path, "w185"),
      meta: prog
        ? t.minuteBadge(prog.position_minutes)
        : release
          ? release.slice(0, 4)
          : t.typeMovie,
      groupLabel: t.libToWatch,
      runtime: m?.runtime ?? prog?.runtime_minutes ?? null,
    });
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">{t.libraryTitle}</h1>

      {follows.length === 0 ? (
        <p className="text-center text-muted py-20">{t.libraryEmpty}</p>
      ) : (
        <LibraryView
          shows={shows}
          showsUpcoming={showsUpcoming}
          movies={movies}
          moviesUpcoming={moviesUpcoming}
          locale={locale}
          initialTab={initialTab}
        />
      )}

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Link
          href="/stats"
          className="flex items-center justify-center gap-2 text-xs text-muted hover:text-accent border border-dashed border-border rounded-xl py-3 transition"
        >
          <Icon name="chart" size={16} />
          {t.libAnalysisBtn}
        </Link>
        <Link
          href="/diary"
          className="flex items-center justify-center gap-2 text-xs text-muted hover:text-accent border border-dashed border-border rounded-xl py-3 transition"
        >
          <Icon name="clock" size={16} />
          {t.diaryTitle}
        </Link>
        <Link
          href="/lists"
          className="flex items-center justify-center gap-2 text-xs text-muted hover:text-accent border border-dashed border-border rounded-xl py-3 transition"
        >
          <Icon name="list" size={16} />
          {t.listsTitle}
        </Link>
      </div>
    </div>
  );
}
