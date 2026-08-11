import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchSummary,
  getWatchedMovieIds,
  getMyLists,
  getSavedLists,
  getFollowedArtists,
  getMyTitleArt,
  getMyAnimeFlags,
  artKey,
} from "@/lib/data";
import { getT, getTabPrefs } from "@/lib/locale";
import { defaultTab } from "@/lib/tabPrefs";
import { localizeFollows } from "@/lib/localize";
import { Icon } from "@/components/Icon";
import { LibraryGrid, type GridItem, type LibraryTab } from "@/components/LibraryGrid";
import { getArtistShelf, type ArtistShelfItem } from "@/lib/artists";
import { FollowMetaSync } from "@/components/MetaSync";
import { PublicListsRail } from "@/components/PublicListsRail";
import { ScrollMemory } from "@/components/ScrollMemory";

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
  const tabPrefs = await getTabPrefs("library");
  /* **الرابط الأعزل يعني «تبويبي الأوّل»** (D-179): كان يعني «الأفلام»
     ثابتاً في الشيفرة، وقد صار الافتراضُ يخصّ صاحبه فيُقرأ من الكوكي.
     و`?filter=` الصريح يبقى فوقه دائماً — ومنه `movie` القديم الذي كان
     يعني «الأفلام» فيبقى يعنيها. */
  const initialTab: LibraryTab =
    filter === "tv"
      ? "shows"
      : filter === "movie"
        ? "movies"
        : filter === "anime"
          ? "anime"
          : filter === "person"
            ? "artists"
            : filter === "list"
              ? "lists"
              : (defaultTab(tabPrefs, "shows") as LibraryTab);

  // الملخّص المجمّع (صف لكل مسلسل، والإعادة محسوبة داخله) بدل قراءة كل
  // صفوف الحلقات — نفس الترقية التي أخذتها الرئيسية. الترجمة في نفس الموجة.
  // والقوائم في الموجة نفسها: استدعاءٌ واحد (`my_lists`) يرجع الاسم والعدد
  // وثلاثة ملصقات، ويجري بالتوازي فلا يزيد زمن الصفحة إلا بأبطأ استدعاء —
  // وهذا ثمن أن يفتح تبويب «القوائم» فوراً بلا دوّارة ولا رحلة شبكة.
  const [followRows, summary, watchedMovieIds, lists, saved, artistRows] = await Promise.all([
    getFollows(),
    getWatchSummary(),
    getWatchedMovieIds(),
    getMyLists(),
    // القوائم المحفوظة تسكن تبويب «الليستات» هنا (طلب أحمد: بيتها
    // المكتبة لا صفحة منفصلة) — نفس الموجة فلا تبطئ الصفحة
    getSavedLists(),
    // عدّاد تبويب الفنانين وحده (D-128): نداء Supabase خفيف، بلا TMDB
    getFollowedArtists(60),
  ]);
  const follows = await localizeFollows(followRows, locale);

  /* الأغلفة المختارة (D-131) — تُطبَّق هنا على مصدرٍ واحد: كل بطاقةٍ في
     المكتبة تقرأ من `follows`، فاستبدالُ الملصق مرّةً هنا يغطّي التبويبات
     كلَّها بلا لمس بطاقةٍ واحدة. وهذا سطحُ صاحبها، فلا تسريب (ق٨). */
  const myArt = await getMyTitleArt();
  for (const f of follows) {
    const art = myArt.get(artKey(f.media_type, f.tmdb_id));
    if (art?.poster_path) f.poster_path = art.poster_path;
  }

  /* رفُّ الفنانين محسوباً — **حين يكون تبويبَه المفتوح وحده** (D-128).
     حسابُ «شاهدتَ له ٧ أعمال» نداءٌ لـTMDB لكل فنان، وصفحة المكتبة اليوم
     لا تفتح اتصالاً واحداً مع TMDB: جعلُ ذلك ثمناً لتبويبٍ يفتحه قليلون
     تراجعٌ في أسخن صفحة. والتبويب يسكن الرابط (D-095) فالخادم يعرفه. */
  const artists: ArtistShelfItem[] =
    initialTab === "artists" ? await getArtistShelf(60) : [];

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
        /* الحالة اسمَ رقاقةٍ لا رقماً: الترتيب الذكي كان يحسبها أصلاً
           (rank)، ورقائق التقسيم (طلب المالك) تحتاجها بالاسم */
        status: dropped
          ? ("dropped" as const)
          : done
            ? ("completed" as const)
            : watched > 0
              ? ("watching" as const)
              : ("unstarted" as const),
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
        // الفيلم بلا «أشاهده»: شاهدتُه أو لم أشاهده أو أوقفته
        status: dropped
          ? ("dropped" as const)
          : done
            ? ("completed" as const)
            : ("unstarted" as const),
        rank: dropped ? 2 : done ? 1 : 0,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  /* **تبويبُ الأنمي: عرضٌ ثالثٌ لا اقتطاعٌ من الأوّلين** (D-182).
     العلَمُ يُقرأ من `follows.is_anime` — من متابعة صاحبه لا من بِركة
     «أفضل الأعمال»: بِركةُ `imdb_pool` أربعةُ آلاف مرشّح فوق عتبة خمسة
     آلاف صوت، **فأنميك متوسّطُ التقييم ليس فيها**، وتبويبٌ يُخفي نصفَ
     مكتبتك ويدّعي الاكتمال أسوأُ من غيابه.
     وترتيبُ المسلسلات ثم الأفلام محفوظٌ لأن كلَّ مصفوفةٍ وصلت مرتَّبة. */
  const animeFlags = await getMyAnimeFlags();
  const anime = [...shows, ...movies].filter(
    (x) => animeFlags.get(`${x.mediaType}-${x.tmdbId}`) === true,
  );
  /* **و`null` ليست `false`:** ما لم يُصنَّف بعد يُسأل عنه مرّةً عند أوّل
     فتحٍ للتبويب. صفٌّ جديد يولد غيرَ مصنَّف، فالعدّ لا يجفّ للأبد.
     والخريطةُ الفارغة (قبل الهجرة ٦١) تعني «الكلُّ غير مصنَّف» — وهو
     الصدق: لا عمودَ بعد. */
  const animeUnknown = follows.filter(
    (f) => (animeFlags.get(`${f.media_type}-${f.tmdb_id}`) ?? null) === null,
  ).length;

  return (
    <div>
      {/* ذاكرة موضع التمرير — العائد من عملٍ يهبط حيث كان (تدقيق 8 Aug م٢) */}
      <ScrollMemory />
      <FollowMetaSync rows={metaToCache} />
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة وسطر الملخّص */}
      <h1 className="sr-only">{t.libraryTitle}</h1>

      <LibraryGrid
        shows={shows}
        movies={movies}
        anime={anime}
        animeUnknown={animeUnknown}
        artists={artists}
        artistCount={artistRows.length}
        lists={lists}
        locale={locale}
        initialTab={initialTab}
        tabPrefs={tabPrefs}
        listsExtra={
          <PublicListsRail
            lists={saved}
            locale={locale}
            title={
              saved.length > 0
                ? `${t.savedListsSection} · ${saved.length}`
                : t.savedListsSection
            }
          />
        }
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
