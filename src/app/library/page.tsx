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
  getSavedListsCount,
  getListCardStats,
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
  const [followRows, summary, watchedMovieIds, lists, saved, savedCount, artistRows] = await Promise.all([
    getFollows(),
    getWatchSummary(),
    getWatchedMovieIds(),
    getMyLists(),
    /* 🔴 **والمحفوظةُ لا تُقرأ إلا في تبويبها** (D-350، بند ٢): كانت
       تُنادى في **كلِّ** فتحةٍ للمكتبة وناتجُها لا يُستعمل إلا في تبويب
       «القوائم» — **وهي تمرّ بـ`shapeListCards`: أربعةُ استعلامات**
       (العناصر · الملفّات · الأرقام · «أحفظتُها أنا») **فوق استعلامها**.
       **ورفُّ الفنانين مشروطٌ بتبويبه منذ D-128 والحجّةُ واحدة**، وهذا
       سقط منها سهواً. **والعدّادُ لا يحتاجها** — عدّادُ التبويب من
       `getMyLists`. */
    initialTab === "lists" ? getSavedLists() : Promise.resolve([]),
    /* 🆕 **وعدّادُها يجري دائماً** (D-374، بلاغُ أحمد: «وفوق List
       المفروض ٣ بدل صفر»): **الثقيلُ مشروطٌ بتبويبه والعدّادُ لا** —
       نفسُ قسمة `getFollowedArtists` تحته (D-128). **وكان العدّادُ
       `lists.length` وحدَها فقال صفراً فوق لوحٍ يعرض ثلاثاً.** */
    getSavedListsCount(),
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

  /* 🆕 **★ و♥ على «قوائمي» أيضاً** (D-350، بند ٣): كانت بطاقةُ قوائمي
     بلا أرقامٍ **وبطاقةُ «المحفوظة» تحتها في اللوح نفسِه تحملها** —
     **بطاقتان بإيقاعين لمعنًى واحد** (القاعدة ٦)، وهو بابٌ آخرُ لعطل
     D-347. **ونداءٌ واحدٌ لقوائمي كلِّها** (D-205)، **والعامّةُ وحدَها
     لها أرقام** (الخاصّةُ لا تُقرأ فلا تُقيَّم — نصُّ ١٠٥). */
  const listStats =
    initialTab === "lists"
      ? await getListCardStats(lists.filter((l) => l.is_public).map((l) => l.id)).catch(
          () => new Map<string, { saves: number; rating: number | null }>(),
        )
      : new Map<string, { saves: number; rating: number | null }>();

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
        addedAt: f.added_at,
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
        addedAt: f.added_at,
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

      {/* 🆕 **الاختصاران فوق المحتوى لا تحته** (D-443، المرحلة ٥:
          «اختصارات Stats و Journal أعلى المحتوى»). **وكانا في ذيل
          الصفحة** — **ورابطٌ تحت مكتبةٍ من ثلاثين ملصقاً لا يُرى إلا
          بعد عشر تمريرات**، **وهو بعينه سببُ سقوط التذييل** (D-437).
          **والشكلُ زرّان مطوّقان لا صفٌّ بفواصل**: هما فعلان يُضغطان،
          **ورمزٌ عارٍ في ذيلٍ يُقرأ زينةً** (D-138). */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {(
          [
            { href: "/stats", icon: "chart", label: t.libAnalysisBtn },
            { href: "/diary", icon: "book", label: t.diaryTitle },
          ] as const
        ).map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-[13px] font-bold transition hover:border-accent/40 active:scale-[0.99]"
          >
            <Icon name={icon} size={17} style={{ color: "var(--accent)" }} />
            {label}
          </Link>
        ))}
      </div>

      <LibraryGrid
        shows={shows}
        movies={movies}
        anime={anime}
        animeUnknown={animeUnknown}
        artists={artists}
        artistCount={artistRows.length}
        lists={lists}
        listStats={listStats}
        savedCount={savedCount}
        locale={locale}
        initialTab={initialTab}
        tabPrefs={tabPrefs}
        listsExtra={
          <PublicListsRail
            lists={saved}
            locale={locale}
            /* 🆕 **شبكةٌ كشبكة «قوائمي» فوقها** (D-433): **بطاقةٌ واحدةٌ
               بمقاسين في صفحةٍ واحدة كانت تُقرأ صنفين.** */
            grid
            /* 🆕 **ورقمُ اللوح ورقمُ التبويب مصدرُهما واحد** (D-374):
               كانا `saved.length` و`savedCount` — **ورقمان لشيءٍ واحدٍ
               في شاشةٍ واحدة يفترقان يومَ يفترق حدُّهما** (D-219). */
            title={
              savedCount > 0 ? `${t.savedListsSection} · ${savedCount}` : t.savedListsSection
            }
          />
        }
      />

    </div>
  );
}
