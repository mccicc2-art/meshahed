import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchSummary,
  getWatchedMovieIds,
  getMyLists,
  getList,
  listsForDisplay,
  getSavedLists,
  getSavedListsCount,
  getListCardStats,
  getFollowedArtists,
  getMyTitleArt,
  getMyAnimeFlags,
  getMyPlaylistIds,
  getMyListedMovieIds,
  getProfile,
  getTitleMetaFor,
  artKey,
  getMyFavorites,
} from "@/lib/data";
import { sanitizeHomePrefs, applyQueueOrder, unwatchedOf } from "@/lib/homePrefs";
import { getT, getTabPrefs, getHiddenRails } from "@/lib/locale";
import { railsHiddenFor, railOff } from "@/lib/railPrefs";
import { showStatusOf, movieStatusOf } from "@/lib/libraryStatus";
import { isUuid } from "@/lib/validate";
import { defaultTab } from "@/lib/tabPrefs";
import { localizeFollows } from "@/lib/localize";
import { Icon } from "@/components/Icon";
import { LibraryGrid, type GridItem, type LibraryTab } from "@/components/LibraryGrid";
import { FavFilterToggle } from "@/components/LibraryFavFilter";
import { getArtistShelf, type ArtistShelfItem } from "@/lib/artists";
import { buildAutoGroups } from "@/lib/autoGroups";
import { AutoGroups } from "@/components/AutoGroups";
import { isPlus } from "@/lib/plan";
import { FollowMetaSync } from "@/components/MetaSync";
import { PublicListsRail } from "@/components/PublicListsRail";
import { ScrollMemory } from "@/components/ScrollMemory";
import { HomeQueueSheetHost } from "@/components/HomeQueueOrder";
import type { ReorderItem } from "@/components/ReorderSheet";

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
  searchParams: Promise<{ filter?: string; edit?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { filter, edit } = await searchParams;
  const tabPrefs = await getTabPrefs("library");
  /* 🆕 **صفوفُ الصفحة المخفيّة** (D-874، حكمُ أحمد: «نعم، للاثنين») —
     **الكاملةُ تمرّ إلى اللوح** (الفعلُ يستبدل القائمةَ كلَّها، D-462)
     **ومجموعةُ `library:` وحدَها تمرّ إلى الصفوف.** */
  const hiddenAll = await getHiddenRails();
  const hiddenRails = railsHiddenFor(hiddenAll, "library");
  /* 🆕 **قائمةُ مكتبةٍ ذكيّةٌ يُعدَّل شرطُها** (D-876 — الوصفةُ نفسُها في
     اكتشف D-875): **تُحسم من `getMyLists` لا من الرابط** — ذكيّةٌ ومصدرُها
     المكتبة — **وغيرُها تسقط صامتةً وتبقى المكتبةُ مكتبة.** */
  const smartEditing =
    edit && isUuid(edit)
      ? await (async () => {
          /* **`getList` لا `getMyLists`**: **`my_lists` لا تعيد الشرطَ ولا
             مصدرَه** — **وتوسيعُها هجرةٌ لا تستحقّها قراءةٌ نادرة**، وقارئُ
             صفحة القائمة يحمل الشرطَ أصلاً. **والملكيّةُ تُفحص هنا** ولو
             كانت السياسةُ تحرس. */
          const got = await getList(edit);
          const l = got?.list;
          if (!l || l.user_id !== user.id || l.kind !== "smart" || l.rule_source !== "library")
            return null;
          const rule =
            l.rule && typeof l.rule === "object" && !Array.isArray(l.rule)
              ? Object.fromEntries(
                  Object.entries(l.rule as Record<string, unknown>).filter(
                    (e): e is [string, string] => typeof e[1] === "string",
                  ),
                )
              : null;
          return rule ? { id: l.id, name: l.name, rule } : null;
        })()
      : null;
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
  /* 🆕 وأغلفتي وأعلامُ الأنمي في الموجة نفسِها: كان كلٌّ منهما `await`
     منفرداً بعدها — رحلتا قاعدةٍ متسلسلتان فوق صفحةٍ بلا Suspense —
     وكلاهما لا يعتمد على شيءٍ من الموجة. */
  const [
    followRows,
    summary,
    watchedMovieIds,
    lists,
    saved,
    listedMovieIds,
    profileRow,
    savedCount,
    artistRows,
    myArt,
    animeFlags,
    playlistIds,
    favSet,
  ] = await Promise.all([
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
    /* 🆕 **وطابورُ «للمشاهدة» لا يُحسب إلا في تبويبه** (D-559): نداءان
       (أفلامُ قوائمك · ملفُّك) **لا يدفعهما من فتح «مسلسلاتي»** —
       نفسُ شرطِ `getSavedLists` فوقه حرفاً. */
    initialTab === "lists"
      ? getMyListedMovieIds().catch(() => new Set<number>())
      : Promise.resolve(new Set<number>()),
    initialTab === "lists" ? getProfile().catch(() => null) : Promise.resolve(null),
    /* 🆕 **وعدّادُها يجري دائماً** (D-374، بلاغُ أحمد: «وفوق List
       المفروض ٣ بدل صفر»): **الثقيلُ مشروطٌ بتبويبه والعدّادُ لا** —
       نفسُ قسمة `getFollowedArtists` تحته (D-128). **وكان العدّادُ
       `lists.length` وحدَها فقال صفراً فوق لوحٍ يعرض ثلاثاً.** */
    getSavedListsCount(),
    // عدّاد تبويب الفنانين وحده (D-128): نداء Supabase خفيف، بلا TMDB
    getFollowedArtists(60),
    getMyTitleArt(),
    getMyAnimeFlags(),
    /* 🆕 **رايةُ التشغيل لكلِّ قائمة** (D-563) — **ومشروطةٌ بتبويبها**
       كأخواتها فوقها (D-350/D-559): **المفتاحُ لا يُرسم إلا في تبويب
       «القوائم»**، **فمن فتح «مسلسلاتي» لا يدفع نداءً لا يراه.** */
    initialTab === "lists" ? getMyPlaylistIds() : Promise.resolve([] as string[]),
    /* 🆕 **مفاتيحُ مفضّلتك — لمِصفاة القلب** (D-671): **نداءٌ واحدٌ خفيف**
       (`my_favorites` يرجع نوعاً ومعرّفاً لا غير) **ومخبَّأٌ بـ`cache()`**،
       **ويجري في الموجة لا بعدها.** ⚠️ **وغيرُ مشروطٍ بتبويب** بخلاف
       جيرانه: التبويباتُ الثلاثةُ الأساسيّة تُبدَّل في العميل بلا رحلة
       خادم (D-521) — **فشرطُ `initialTab` كان سيُطفئ القلبَ في تبويبٍ
       يصله القارئُ بضغطةٍ بلا طلبٍ جديد.** */
    getMyFavorites(),
  ]);
  const follows = await localizeFollows(followRows, locale);

  /* الأغلفة المختارة (D-131) — تُطبَّق هنا على مصدرٍ واحد: كل بطاقةٍ في
     المكتبة تقرأ من `follows`، فاستبدالُ الملصق مرّةً هنا يغطّي التبويبات
     كلَّها بلا لمس بطاقةٍ واحدة. وهذا سطحُ صاحبها، فلا تسريب (ق٨). */
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

  /* 🆕 **المجموعاتُ التلقائيّة** (D-820، البندُ الرابعُ من خطّة الـ٢٤)
     — **مشروطةٌ بتبويب «القوائم» وحدَه**، **كأخواتها فوقها** (D-128/
     D-559): **نداءٌ واحدٌ مجمَّعٌ لبطاقات الهويّة** (`title_meta`)،
     **ومن فتح «مسلسلاتي» لا يدفع ثمنَ رفٍّ لا يراه.**
     ⚠️ **ولا نداءَ TMDB واحد**: الجدولُ مُلئ مرّةً (D-700) — **والوجهُ
     مسارُ صورةٍ مخزَّن.** */
  const autoGroups =
    initialTab === "lists"
      ? buildAutoGroups(
          follows,
          await getTitleMetaFor(
            follows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id })),
          ).catch(() => new Map()),
        )
      : [];

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
        /* **من الوصفة الواحدة** (D-876): **قائمةُ المكتبة الذكيّة تقرأ الحالةَ
           نفسَها** — فاستُخرجت لا نُسخت (D-376). */
        status: showStatusOf(f, watchedByShow.get(f.tmdb_id) ?? 0),
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
        status: movieStatusOf(f, done),
        rank: dropped ? 2 : done ? 1 : 0,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  /* **تبويبُ الأنمي: عرضٌ ثالثٌ لا اقتطاعٌ من الأوّلين** (D-182).
     العلَمُ يُقرأ من `follows.is_anime` — من متابعة صاحبه لا من بِركة
     «أفضل الأعمال»: بِركةُ `imdb_pool` أربعةُ آلاف مرشّح فوق عتبة خمسة
     آلاف صوت، **فأنميك متوسّطُ التقييم ليس فيها**، وتبويبٌ يُخفي نصفَ
     مكتبتك ويدّعي الاكتمال أسوأُ من غيابه.
     وترتيبُ المسلسلات ثم الأفلام محفوظٌ لأن كلَّ مصفوفةٍ وصلت مرتَّبة.
     (والأعلامُ نفسُها تُجلب في موجة الصفحة الأولى — انظر أعلاه.) */
  /* 🆕 ===== طابورُ «للمشاهدة» بطاقةً بين قوائمك (D-559) =====
     **الحسابُ هو حسابُ الرئيسية حرفاً** (D-505): أفلامُ مكتبتك التي لا
     قائمةَ لها، بترتيب الإضافة. **ولا دالّةَ مشتركةٌ ثالثة** لأن
     المدخلَين مختلفان (هناك `movieFollows` وهنا `follows`) **والسطران
     أقصرُ من الغلاف الذي يوحّدهما** — ⬜ **وتُستخرج يومَ يوجد قارئٌ
     ثالث** (D-002: عند القارئ الثاني يُستخرج، وهذا ثانيها فبقي بحدّه).

     ⚠️ **والفارغُ لا بطاقةَ له**: **بطاقةُ قائمةٍ تقول صفراً أسوأُ من
     غياب** (D-219) — **ومن لا فيلمَ له بلا قائمةٍ لا يرى مفتاحاً
     لطابورٍ لا وجودَ له.** */
  const toWatchQueue =
    initialTab === "lists"
      ? follows
          .filter((f) => f.media_type === "movie" && !listedMovieIds.has(f.tmdb_id))
          .sort((a, b) => a.added_at.localeCompare(b.added_at))
      : [];
  /* 🆕 **وترتيبُ صاحبها هنا كما في الرئيسية** (D-719): **بطاقةٌ واحدةٌ
     في ثلاثة أبواب، وترتيبٌ يظهر في بابٍ ويغيب عن أخيه يُقرأ عطلاً.** */
  /* 🆕 **والمشاهَدُ يسقط هنا كما يسقط في الرئيسيّة** (D-848): **الحكمُ
     في `unwatchedOf` لا مكتوباً مرّتين** — **وبابان يقولان عن القائمة
     نفسِها عددين مختلفين عطلٌ يُقرأ.** */
  const toWatchLeft = unwatchedOf(toWatchQueue, watchedMovieIds);
  const toWatchOrdered = applyQueueOrder(
    toWatchLeft,
    (f) => `tw-mv-${f.tmdb_id}`,
    sanitizeHomePrefs(profileRow?.home_prefs).towatchListOrder,
  );
  const toWatchCard = toWatchLeft.length
    ? {
        on: sanitizeHomePrefs(profileRow?.home_prefs).toWatch,
        count: toWatchLeft.length,
        posters: toWatchOrdered.slice(0, 3).map((f) => f.poster_path ?? null),
      }
    : null;
  /** بذرةُ ورقة الترتيب — أفلامُ البطاقة كلُّها بترتيب عرضها (D-719) */
  const toWatchListItems: ReorderItem[] = toWatchOrdered.map((f) => ({
    key: `tw-mv-${f.tmdb_id}`,
    title: f.title,
    poster_path: f.poster_path ?? null,
    media_type: "movie" as const,
  }));

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

  /* **«المفضّلة» تخرج من عرض القوائم** (D-654) — **وبابُها لم يعد
     وجهةً بل مِصفاةً في مكانها** (D-671)، **فسقط قارئُ معرّفها من هذه
     الصفحة**: نداءٌ لا يُقرأ ثمنٌ بلا مقابل (D-152). */
  const shownLists = listsForDisplay(lists);

  return (
    <div>
      {/* ذاكرة موضع التمرير — العائد من عملٍ يهبط حيث كان (تدقيق 8 Aug م٢) */}
      <ScrollMemory />
      <FollowMetaSync rows={metaToCache} />
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة وسطر الملخّص */}
      <h1 className="sr-only">{t.libraryTitle}</h1>

      {/* 🆕 **مضيفُ ورقة ترتيب بطاقة «للمشاهدة»** (D-719) — **حيث تُرسم
          البطاقةُ يُركَّب مضيفُها**: **بطاقةٌ تُوعد بورقةٍ ولا مضيفَ
          لبابها تبتلع الضغطة** (D-030). **وينتظر حدثَه فلا يرسم شيئاً
          قبله** — و`cont`/`lists` فارغتان هنا لأن زرّيهما في الرئيسية. */}
      {toWatchListItems.length > 0 && (
        <HomeQueueSheetHost locale={locale} cont={[]} towatch={[]} towatchList={toWatchListItems} />
      )}

      <LibraryGrid
        shows={shows}
        movies={movies}
        anime={anime}
        animeUnknown={animeUnknown}
        artists={artists}
        artistCount={artistRows.length}
        lists={shownLists}
        favKeys={[...favSet]}
        toWatch={toWatchCard}
        playlistIds={playlistIds}
        listStats={listStats}
        savedCount={savedCount}
        locale={locale}
        initialTab={initialTab}
        tabPrefs={tabPrefs}
        hiddenRails={[...hiddenAll]}
        smartEditing={smartEditing}
        /* 🆕 **الاختصاران نزلا تحت الشريط** (D-453، طلبُ أحمد بلقطةٍ
           معلَّمة: «هذي نزّلها تحت الشريط»).

           **وحجّةُ D-443 تبقى قائمةً كما هي**: كانا في ذيل الصفحة
           **فلا يُريان إلا بعد عشر تمريرات** (وهو سببُ سقوط التذييل في
           D-437) — **والذي تبدّل موضعُهما لا وجودُهما.** فوقَ التبويبات
           كانا **يدفعان الشريطَ ومعه أوّلَ ملصقٍ تحت منتصف الشاشة**،
           **وأوّلُ ما يُرى في صفحةٍ اسمُها «مكتبتي» يجب أن يكون
           مكتبتَك** — وهو نصُّ طلبك في جولة الضغط (D-437).
           **وتحتَه يبقيان في الشاشة الأولى بلا أن يزاحما التبويبات.**

           **والشكلُ زرّان مطوّقان لا صفٌّ بفواصل**: هما فعلان يُضغطان،
           **ورمزٌ عارٍ يُقرأ زينةً** (D-138). */
        underTabs={
          /* 🆕 **وثالثُ الصفِّ قلبٌ بلا كلمة** (D-654، طلبُ أحمد: «في نفس
             هذا الصف حطّ أيقونة قلب — إذا ضغطته يظهر لي الأفلام
             المفضّلة عندي»).

             🔑 **والأعمدةُ `[1fr_1fr_auto]` كبطاقةِ الملفّ حرفاً**
             (D-611/D-650): **فعلان يقرآن بكلمتيهما، وبابٌ ينكمش على
             رمزه** — **ووصفةُ الشكل واحدةٌ في السطحين** (D-145).

             ⚠️ **والقلبُ لا يُرسم لمن لا مفضّلةَ له**: القائمةُ تُنشأ
             عند أوّل تفضيل، **و٢٤ من ٣١ عضواً لا قائمةَ لهم اليوم** —
             **وبابٌ يَعِد بما لا يعطي أسوأُ من بابٍ غائب** (D-217).
             **ويظهر من تلقائه أوّلَ ما يُفضّل عملاً.** */
          /* 🆕 **وصفٌّ مرنٌ لا شبكةٌ بأعمدةٍ محسوبة** (D-671): القلبُ
             **يغيب في التبويبات التي لا يُصفّيها** (D-217) — **وعمودٌ
             ثالثٌ محجوزٌ لغائبٍ يمطّ جارَه.** والرابطان `flex-1`
             فمنظرُهما لم يتبدّل بكسلاً حين يكون القلبُ حاضراً. */
          <div className="flex gap-2.5">
            {(
              [
                /* ⚖️ 🆕 **والزرُّ صار اسمَ وجهته** (D-675، حكمُ أحمد
                   بلقطةٍ محوَّطة: «الجملة طويلة اختصرها»): «تحليل
                   مكتبتك» جملةٌ تصف فعلاً، **والصفحةُ التي تفتحها
                   اسمُها «الإحصائيات»** — **والاسمُ يتبع ما تجده هناك**
                   (D-030). **وجارُه «النشاط» كلمةٌ واحدة**، فصار
                   الصفُّ كلمتين متوازيتين لا جملةً وكلمة.
                   🔑 **ولا مفتاحَ ترجمةٍ جديد**: `statsPageTitle` هو
                   عنوانُ الصفحة نفسِه — **ومفتاحان لنصٍّ واحدٍ يفترقان
                   عند أوّل تعديل** (D-145). */
                { href: "/stats", icon: "chart", label: t.statsPageTitle },
                /* ⚖️ 🆕 **«اليوميات» صارت «النشاط»** (D-537، تصميمُ
                   أحمد): **الوجهةُ تعرض الأربعةَ لا المشاهدةَ وحدَها**،
                   **والاسمُ يتبع ما تجده هناك** (D-030). **والساعةُ
                   بسهمها ترمز إلى سجلٍّ يُرجَع فيه**، والكتابُ كان
                   يرمز إلى يوميّاتٍ تُكتب. */
                { href: "/activity", icon: "clock", label: t.activityTitle },
              ] as const
            ).map(({ href, icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-14 font-bold transition hover:border-accent/40 active:scale-[0.99]"
              >
                <Icon name={icon} size={17} style={{ color: "var(--accent)" }} />
                {label}
              </Link>
            ))}
            {/* ⚖️ 🆕 **والقلبُ صار مِصفاةً لا باباً** (D-671، حكمُ أحمد:
                «ما أبغاه يفتح صفحة — أبغاه يفلتر الصفحة الي أنا فيها
                بس») — **نقضٌ لوجهةِ D-654 لا لموضعه ولا لرمزه.**
                **ويرسم نفسَه بنفسه**: مالكُ الحالة `LibraryGrid`
                والسياقُ يصله هنا، **فلا يُرسم في تبويبٍ لا يُصفّيه ولا
                لمن لا مفضّلةَ له.** */}
            <FavFilterToggle label={t.profileFavoritesRail} />
          </div>
        }
        listsExtra={
          <>
          {/* 🆕 **«تجتمع عندك» فوق المحفوظة** (D-820): **مجموعاتٌ من
              مكتبتك تسبق قوائمَ غيرك** — **وتبويبٌ اسمُه «قوائمي» يبدأ
              بما هو لك.** */}
          {/* D-874: **الصفُّ المطفأُ يغيب بعنوانه** — والشرطُ هنا لا داخل
              المكوّن، **كصفوف اكتشف حرفاً** (`railOff`). */}
          {!railOff(hiddenRails, "autogroups") && (
            <AutoGroups locale={locale} groups={autoGroups} plus={isPlus(profileRow)} />
          )}
          {!railOff(hiddenRails, "savedlists") && (
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
          )}
          </>
        }
      />

    </div>
  );
}
