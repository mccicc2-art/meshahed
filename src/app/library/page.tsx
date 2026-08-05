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

  // عدد المشاهَد لكل مسلسل من قراءةٍ واحدة — والإعادة تُحسب من لحظة بدئها
  const rewatchSince = new Map<number, string>();
  for (const f of follows) {
    if (f.media_type === "tv" && f.rewatch_started_at)
      rewatchSince.set(f.tmdb_id, f.rewatch_started_at);
  }
  const watchedByShow = new Map<number, number>();
  for (const w of watchedEpisodes) {
    const since = rewatchSince.get(w.show_tmdb_id);
    if (since && w.watched_at < since) continue;
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
  }

  // حلقاتٌ متبقية عبر المكتبة كلها — لسطر الملخّص تحت العنوان
  let remainingEps = 0;

  // الترتيب داخل كل تبويب: ما أنت في وسطه، ثم ما لم تبدأه، ثم المكتمل
  const shows: (GridItem & { rank: number; progressSort: number })[] = follows
    .filter((f) => f.media_type === "tv")
    .map((f) => {
      const aired = f.aired_episodes ?? f.total_episodes ?? 0;
      const watched = Math.min(watchedByShow.get(f.tmdb_id) ?? 0, aired || Infinity);
      const done = aired > 0 && watched >= aired && watched > 0;
      const progress = aired > 0 ? Math.round((watched / aired) * 100) : 0;
      const dropped = !!f.dropped;
      if (!dropped && aired > watched) remainingEps += aired - watched;
      const rewatching = (f.rewatch_count ?? 0) > 0;
      return {
        key: `tv-${f.tmdb_id}`,
        tmdbId: f.tmdb_id,
        mediaType: "tv" as const,
        href: `/show/${f.tmdb_id}`,
        title: f.title,
        posterPath: f.poster_path,
        progress,
        completed: done,
        badge: dropped
          ? t.droppedBadge
          : rewatching && !done
            ? t.rewatchBadge((f.rewatch_count ?? 0) + 1)
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
        tmdbId: f.tmdb_id,
        mediaType: "movie" as const,
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

  const doneCount =
    shows.filter((s) => s.rank === 2).length + movies.filter((m) => m.rank === 1).length;

  return (
    <div>
      <h1 className="text-xl font-bold">{t.libraryTitle}</h1>
      {/* سطر الملخّص: نبض المكتبة بنظرة — كم عندك، كم أنهيت، كم بقي */}
      <p className="text-xs text-muted mt-1 mb-5" dir="auto">
        {t.librarySummary(shows.length + movies.length, doneCount, remainingEps)}
      </p>

      <LibraryGrid shows={shows} movies={movies} locale={locale} initialTab={initialTab} />

      {/* روابط الأدوات — بلا إطار، على نمط صفوف الرئيسية: فواصل رأسية فقط */}
      <div className="mt-8 grid grid-cols-3 border-t border-[color:var(--divider)] pt-1">
        {(
          [
            { href: "/stats", icon: "chart", label: t.libAnalysisBtn },
            { href: "/diary", icon: "book", label: t.diaryTitle },
            { href: "/lists", icon: "list", label: t.listsTitle },
          ] as const
        ).map(({ href, icon, label }, i) => (
          <Link
            key={href}
            href={href}
            className="relative flex flex-col items-center gap-1.5 py-3.5 text-muted hover:text-foreground active:bg-white/[0.04] transition"
          >
            <Icon name={icon} size={18} />
            <span className="text-[11px] leading-tight text-center">{label}</span>
            {i < 2 && (
              <span className="absolute inset-y-2 end-0 w-px bg-white/10" aria-hidden />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
