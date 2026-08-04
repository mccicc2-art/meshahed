import { redirect } from "next/navigation";
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
import { LibraryBrowser, type LibraryItem } from "@/components/LibraryBrowser";

/**
 * المكتبة.
 *
 * صفحة تصفّح لا لوحة قيادة: شبكة واحدة وشرائح فوقها. التحليل الكامل انتقل
 * إلى صفحة الإحصائيات — كان خمس بطاقات رسوم بيانية أسفل أربع شبكات، وهذه
 * صفحة يفتحها المستخدم ليختار ما يشاهده لا ليقرأ تقريراً عن نفسه.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  // شريط الأعداد في الرئيسية يفتح المكتبة على الشريحة المقصودة مباشرةً
  const { filter } = await searchParams;
  const initialFilter =
    filter === "watching" || filter === "notStarted" || filter === "done" || filter === "tv" || filter === "movie"
      ? filter
      : "all";

  const [follows, summary, watchedMovieIds, movieProgress] = await Promise.all([
    getFollows(),
    getWatchSummary(),
    getWatchedMovieIds(),
    getAllMovieProgress(),
  ]);

  // عدد الحلقات المشاهَدة لكل مسلسل — يُستخدم في شارة التقدّم على كل بطاقة
  const watchedByShow = new Map<number, number>();

  if (summary) {
    for (const s of summary) watchedByShow.set(s.show_tmdb_id, s.watched);
  } else {
    for (const w of await getAllWatchedEpisodes()) {
      watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
    }
  }

  const items: LibraryItem[] = [];

  for (const f of follows.filter((f) => f.media_type === "tv")) {
    const done = watchedByShow.get(f.tmdb_id) ?? 0;
    const aired = f.aired_episodes ?? f.total_episodes ?? 0;
    const complete = isComplete(done, aired);
    items.push({
      key: `tv-${f.tmdb_id}`,
      href: `/show/${f.tmdb_id}`,
      title: f.title,
      posterPath: f.poster_path,
      kind: "tv",
      status: complete ? "done" : done > 0 ? "watching" : "notStarted",
      badge: complete ? t.watchedBadge : done > 0 ? t.episodesBadge(done) : undefined,
      progress: aired > 0 ? percentOf(done, aired) : undefined,
    });
  }

  for (const f of follows.filter((f) => f.media_type === "movie")) {
    const prog = movieProgress.find((p) => p.movie_tmdb_id === f.tmdb_id);
    const complete = watchedMovieIds.has(f.tmdb_id);
    const pct =
      !complete && prog?.runtime_minutes && prog.runtime_minutes > 0
        ? Math.round((prog.position_minutes / prog.runtime_minutes) * 100)
        : undefined;
    items.push({
      key: `movie-${f.tmdb_id}`,
      href: `/movie/${f.tmdb_id}`,
      title: f.title,
      posterPath: f.poster_path,
      kind: "movie",
      status: complete ? "done" : prog ? "watching" : "notStarted",
      badge: complete ? t.watchedBadge : prog ? t.minuteBadge(prog.position_minutes) : undefined,
      progress: complete ? 100 : pct,
    });
  }

  // أفلام لها موضع توقف لكنها ليست ضمن المتابَعة
  for (const p of movieProgress) {
    if (items.some((i) => i.key === `movie-${p.movie_tmdb_id}`)) continue;
    if (watchedMovieIds.has(p.movie_tmdb_id)) continue;
    items.push({
      key: `movie-${p.movie_tmdb_id}`,
      href: `/movie/${p.movie_tmdb_id}`,
      title: p.title ?? t.typeMovie,
      posterPath: p.poster_path,
      kind: "movie",
      status: "watching",
      badge: t.minuteBadge(p.position_minutes),
      progress:
        p.runtime_minutes && p.runtime_minutes > 0
          ? Math.round((p.position_minutes / p.runtime_minutes) * 100)
          : undefined,
    });
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">{t.libraryTitle}</h1>

      {items.length === 0 ? (
        <p className="text-center text-muted py-20">{t.libraryEmpty}</p>
      ) : (
        <LibraryBrowser items={items} locale={locale} initialFilter={initialFilter} />
      )}
    </div>
  );
}
