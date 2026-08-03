import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchSummary,
  getWatchedMovieIds,
  getAllMovieProgress,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { percentOf, isComplete } from "@/lib/progress";
import { MediaSection, type LibraryEntry } from "@/components/LibraryTabs";
import { LibraryAnalysis, LibraryAnalysisSkeleton } from "@/components/LibraryAnalysis";

export default async function LibraryPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  // المكتبة لا تطلب TMDB إطلاقاً: عدد الحلقات المعروضة مخزّن مع صف المتابعة
  // وتحدّثه الرئيسية وصفحة المسلسل. كانت الصفحة تطلب تفاصيل كل مسلسل تتابعه.
  //
  // ولا تسحب صفوف الحلقات: ملخّص مجمّع من Postgres (صف لكل مسلسل)
  // بدل آلاف الصفوف. `getAllWatchedEpisodes` تبقى احتياطاً لو لم تُشغَّل الدالة.
  const [follows, summary, watchedMovieIds, movieProgress] = await Promise.all([
    getFollows(),
    getWatchSummary(),
    getWatchedMovieIds(),
    getAllMovieProgress(),
  ]);

  // الأرقام الإجمالية صارت في قسم التحليل — هنا نحتاج عدد الحلقات لكل
  // مسلسل فقط، لحساب حالة كل بطاقة
  const watchedByShow = new Map<number, number>();

  if (summary) {
    for (const s of summary) watchedByShow.set(s.show_tmdb_id, s.watched);
  } else {
    for (const w of await getAllWatchedEpisodes()) {
      watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
    }
  }

  const tvFollows = follows.filter((f) => f.media_type === "tv");
  const movieFollows = follows.filter((f) => f.media_type === "movie");

  const shows: LibraryEntry[] = [];
  const movies: LibraryEntry[] = [];
  const watching: LibraryEntry[] = [];
  const finished: LibraryEntry[] = [];

  for (const f of tvFollows) {
    const done = watchedByShow.get(f.tmdb_id) ?? 0;
    // نفس المقام المستخدم في الرئيسية وصفحة المسلسل
    const aired = f.aired_episodes ?? f.total_episodes ?? 0;
    const complete = isComplete(done, aired);
    const entry: LibraryEntry = {
      key: `tv-${f.tmdb_id}`,
      href: `/show/${f.tmdb_id}`,
      title: f.title,
      posterPath: f.poster_path,
      kind: "tv",
      badge: complete ? t.watchedBadge : done > 0 ? t.episodesBadge(done) : undefined,
      progress: aired > 0 ? percentOf(done, aired) : undefined,
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

  return (
    <div className="space-y-12">
      <h1 className="text-2xl font-bold">{t.libraryTitle}</h1>

      <MediaSection
        title={t.libTabWatching}
        count={watching.length}
        hint={t.libWatchingHint}
        items={watching}
        empty={t.libEmptyWatching}
      />

      <MediaSection
        title={t.libShowsGroup}
        count={shows.length}
        hint={t.libShowsHint}
        items={shows}
        empty={t.libEmptyFavorites}
      />

      <MediaSection
        title={t.libMoviesGroup}
        count={movies.length}
        hint={t.libMoviesHint}
        items={movies}
        empty={t.libEmptyFavorites}
      />

      <MediaSection
        title={t.libTabFinished}
        count={finished.length}
        hint={t.libFinishedHint}
        items={finished}
        empty={t.libEmptyFinished}
      />

      {/* التحليل يطلب TMDB لكل عمل، فيُبَثّ بعد الصفحة لا قبلها —
          المكتبة تظهر فوراً والأرقام تلحق بها. */}
      <section>
        <h2 className="text-lg font-bold">{t.analysisTitle}</h2>
        <p className="text-xs text-muted mt-0.5 mb-4">{t.analysisSub}</p>
        <Suspense fallback={<LibraryAnalysisSkeleton />}>
          <LibraryAnalysis locale={locale} />
        </Suspense>
      </section>
    </div>
  );
}
