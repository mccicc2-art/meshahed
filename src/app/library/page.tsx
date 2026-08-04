import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getFollows, getAllWatchedEpisodes, getWatchedMovieIds } from "@/lib/data";
import { getT } from "@/lib/locale";
import { localizeFollows } from "@/lib/localize";
import { Icon } from "@/components/Icon";
import { LibraryGrid, type GridItem } from "@/components/LibraryGrid";

/**
 * المكتبة.
 *
 * تبويبان — مسلسلات وأفلام — وكلٌّ شبكةُ ملصقات. كل ما تعرضه مخزّنٌ
 * عندنا في صفوف المتابعة والمشاهدة، فالصفحة لا تفتح اتصالاً واحداً مع
 * TMDB: كانت النسخة السابقة تطلب تفاصيل كل عملٍ لتعرض «الحلقة التالية»،
 * وذلك السؤال صار للرئيسية في قسمَي «للمشاهدة» و«القادم».
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

  const [followRows, watchedEpisodes, watchedMovieIds] = await Promise.all([
    getFollows(),
    getAllWatchedEpisodes(),
    getWatchedMovieIds(),
  ]);
  const follows = await localizeFollows(followRows, locale);

  // عدد المشاهَد لكل مسلسل من قراءةٍ واحدة
  const watchedByShow = new Map<number, number>();
  for (const w of watchedEpisodes) {
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
  }

  // الترتيب داخل كل تبويب: ما أنت في وسطه، ثم ما لم تبدأه، ثم المكتمل
  const shows: (GridItem & { rank: number; progressSort: number })[] = follows
    .filter((f) => f.media_type === "tv")
    .map((f) => {
      const aired = f.aired_episodes ?? f.total_episodes ?? 0;
      const watched = Math.min(watchedByShow.get(f.tmdb_id) ?? 0, aired || Infinity);
      const done = aired > 0 && watched >= aired && watched > 0;
      const progress = aired > 0 ? Math.round((watched / aired) * 100) : 0;
      const dropped = !!f.dropped;
      return {
        key: `tv-${f.tmdb_id}`,
        href: `/show/${f.tmdb_id}`,
        title: f.title,
        posterPath: f.poster_path,
        progress,
        badge: dropped
          ? t.droppedBadge
          : watched === 0
            ? t.notStartedBadge
            : done
              ? t.watchedBadge
              : undefined,
        badgeTone: (dropped ? "dropped" : done ? "watched" : "neutral") as GridItem["badgeTone"],
        count: !dropped && watched > 0 && aired > watched ? aired - watched : undefined,
        dropped,
        rank: dropped ? 3 : watched > 0 && !done ? 0 : watched === 0 ? 1 : 2,
        progressSort: progress,
      };
    })
    .sort((a, b) => a.rank - b.rank || b.progressSort - a.progressSort);

  const movies: (GridItem & { rank: number })[] = follows
    .filter((f) => f.media_type === "movie")
    .map((f) => {
      const done = watchedMovieIds.has(f.tmdb_id);
      const dropped = !!f.dropped;
      return {
        key: `mv-${f.tmdb_id}`,
        href: `/movie/${f.tmdb_id}`,
        title: f.title,
        posterPath: f.poster_path,
        progress: done ? 100 : undefined,
        badge: dropped ? t.droppedBadge : done ? t.watchedBadge : t.typeMovie,
        badgeTone: (dropped ? "dropped" : done ? "watched" : "neutral") as GridItem["badgeTone"],
        dropped,
        rank: dropped ? 2 : done ? 1 : 0,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{t.libraryTitle}</h1>

      <LibraryGrid shows={shows} movies={movies} locale={locale} initialTab={initialTab} />

      <div className="mt-8 grid grid-cols-3 gap-2">
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
