import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchSummary,
  getWatchedMovieIds,
  getMyLists,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { localizeFollows } from "@/lib/localize";
import { Icon } from "@/components/Icon";
import { LibraryGrid, type GridItem, type LibraryTab } from "@/components/LibraryGrid";
import { FollowMetaSync } from "@/components/MetaSync";

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
  const initialTab: LibraryTab =
    filter === "movie" ? "movies" : filter === "list" ? "lists" : "shows";

  // الملخّص المجمّع (صف لكل مسلسل، والإعادة محسوبة داخله) بدل قراءة كل
  // صفوف الحلقات — نفس الترقية التي أخذتها الرئيسية. الترجمة في نفس الموجة.
  // والقوائم في الموجة نفسها: استدعاءٌ واحد (`my_lists`) يرجع الاسم والعدد
  // وثلاثة ملصقات، ويجري بالتوازي فلا يزيد زمن الصفحة إلا بأبطأ استدعاء —
  // وهذا ثمن أن يفتح تبويب «القوائم» فوراً بلا دوّارة ولا رحلة شبكة.
  const [followRows, summary, watchedMovieIds, lists] = await Promise.all([
    getFollows(),
    getWatchSummary(),
    getWatchedMovieIds(),
    getMyLists(),
  ]);
  const follows = await localizeFollows(followRows, locale);

  // ما تغيّر اسمه بالترجمة يُكتب مرة واحدة — كانت الرئيسية وحدها تكتب،
  // فمن مدخله تبويب المكتبة يعيد دفع كلفة TMDB في كل زيارة
  const metaToCache = follows
    .filter((f, n) => f.title !== followRows[n]?.title)
    .slice(0, 24)
    .map((f) => ({
      tmdbId: f.tmdb_id,
      mediaType: f.media_type,
      title: f.title,
      posterPath: f.poster_path,
    }));

  const watchedByShow = new Map<number, number>();
  if (summary) {
    for (const s of summary) watchedByShow.set(s.show_tmdb_id, s.watched);
  } else {
    // احتياط قبل performance.sql — مع احترام دورات الإعادة
    const rewatchSince = new Map<number, string>();
    for (const f of follows) {
      if (f.media_type === "tv" && f.rewatch_started_at)
        rewatchSince.set(f.tmdb_id, f.rewatch_started_at);
    }
    const watchedEpisodes = await getAllWatchedEpisodes();
    for (const w of watchedEpisodes) {
      const since = rewatchSince.get(w.show_tmdb_id);
      if (since && w.watched_at < since) continue;
      watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
    }
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
        tmdbId: f.tmdb_id,
        mediaType: "tv" as const,
        href: `/show/${f.tmdb_id}`,
        title: f.title,
        posterPath: f.poster_path,
        progress,
        completed: done,
        /* لا كتابة فوق الملصق: الحالة كلها في شريط اللون الأسفل —
           أخضر مكتمل، بنفسجي قيد المشاهدة، أحمر موقوف، ولا شيء لِما لم يبدأ */
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
        dropped,
        rank: dropped ? 2 : done ? 1 : 0,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  return (
    <div>
      <FollowMetaSync rows={metaToCache} />
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة وسطر الملخّص */}
      <h1 className="sr-only">{t.libraryTitle}</h1>

      <LibraryGrid
        shows={shows}
        movies={movies}
        lists={lists}
        locale={locale}
        initialTab={initialTab}
      />

      {/* روابط الأدوات — بلا إطار، على نمط صفوف الرئيسية: فواصل رأسية فقط */}
      {/* عمودان لا ثلاثة: «القوائم» صعدت إلى صفّ التبويبات — قرارُ المالك */}
      <div className="mt-8 grid grid-cols-2 border-t border-[color:var(--divider)] pt-1">
        {(
          [
            { href: "/stats", icon: "chart", label: t.libAnalysisBtn },
            { href: "/diary", icon: "book", label: t.diaryTitle },
          ] as const
        ).map(({ href, icon, label }, i) => (
          <Link
            key={href}
            href={href}
            className="relative flex flex-col items-center gap-1.5 py-3.5 text-muted hover:text-foreground active:bg-surface-2 transition"
          >
            <Icon name={icon} size={18} />
            <span className="text-[11px] leading-tight text-center">{label}</span>
            {i < 1 && (
              <span className="absolute inset-y-2 end-0 w-px bg-white/10" aria-hidden />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
