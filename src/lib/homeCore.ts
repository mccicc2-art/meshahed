import "server-only";
/**
 * ====== نواةُ الرئيسية — حسابٌ واحدٌ لقارئَين ======
 *
 * 🆕 D-1066 (Phase 11-H · H0/H1): كلُّ ما كانت `app/page.tsx` تحسبه
 * لترسم الرئيسية — أرقامُ الترويسة، صفوفُ الأقسام الاثني عشر، طوابيرُ
 * الترتيب، ما يُخبَّأ للودجت وللإحصاءات — خرج إلى هنا **بحرفه** (نصُّ
 * `HomePage`/`HomeBody` نفسُه، تعليقاتُه معه)، فتقرؤه صفحةُ الويب كما
 * كانت، ويقرؤه `GET /api/v1/me/home` للشاشة الأصليّة. **رئيسيّةٌ واحدة
 * لا اثنتان** (القاعدة ٦، وصفةُ D-1059 في البحث): قرارٌ في هذا الملفّ
 * يصل السطحَين معاً، وما لم يُنقل هو الرسمُ وحدَه.
 *
 * ⚠️ **الرسمُ يبقى في الصفحة**: `Suspense` وبثُّ الأقسام (D-087/D-437)
 * وأبوابُ «الكل» — كلُّها JSX لا حساب. الجزءُ الذي يبثّ بعد الرفوف
 * (مشاهدُ «التالي»، أرقامُ حلقات القادم، الرائج) صار ثلاثَ دوالٍّ هنا
 * تناديها الصفحةُ خلف `Suspense` ويناديها `me/home/extras` معاً.
 */
import type { Locale } from "@/core/i18n";
import {
  getFollows,
  getMyTitleArt,
  getSavedListsBrief,
  getMyPlaylistsBrief,
  getMyListedMovieIds,
  artKey,
  getAllWatchedEpisodes,
  getWatchSummary,
  getWatchedMovies,
  watchedMovieMinutes,
  getProfile,
  getAllMovieProgress,
  getMyRatings,
  getMyLists,
  listsForDisplay,
  getListCardStats,
  getMyPlaylistIds,
  getSavedLists,
  getFriendsWatching,
  getWatchedForShow,
  getWatchHistory,
  type SavedListBrief,
  type ListItem,
} from "@/lib/data";
import { getTv, getMovie, trending, type SearchResult } from "@/lib/tmdb";
import { railGuard } from "@/lib/topChart";
import { nextUnwatchedEpisode, airedEpisodeCount, percentOf } from "@/core/progress";
import { whenLabel } from "@/core/when";
import { localizeFollows, localizeRows } from "@/lib/localize";
import { curatedName } from "@/core/universes";
import type { getT } from "@/lib/locale";
import type { HeaderStat } from "@/components/HomeHeader";
import type { WeekEntry } from "@/components/WeekStrip";
import type { ReorderItem } from "@/components/ReorderSheet";
import type { ShowStat } from "@/components/ShowStatsSync";
import {
  sanitizeHomePrefs,
  applyQueueOrder,
  TW_LIST_KEY,
  unwatchedOf,
  headerStatMeta,
  type HeaderStatKey,
} from "@/core/homePrefs";

export type T = Awaited<ReturnType<typeof getT>>["t"];


/* المسلسل كما تحتاجه هذه الصفحة (اسمُه ومقياسُ تقدّمه من صفّ المتابعة
   المخزّن، لا من TMDB) — على مستوى الملفّ لأن قسم «تابِع المشاهدة» صار
   مكوّناً مستقلاً (جولة ٢٠ أغسطس) ويشاركه النوع */
export type Item = {
  id: number;
  name: string;
  posterPath: string | null;
  watched: number;
  aired: number;
  progress: number;
};

/* نوعُ عناصر «للمشاهدة» و«القادم» — على مستوى الملفّ لأن قسم «القادم»
   صار مكوّناً مستقلاً (جولة ٢٠ أغسطس) ويشاركه النوع */
export type MixedItem = {
  key: string;
  mediaType?: "tv" | "movie";
  tmdbId?: number;
  runtime?: number | null;
  href: string;
  title: string;
  posterPath: string | null;
  progress?: number;
  badge?: string;
  badgeTone?: "neutral" | "progress" | "watched" | "rating";
  /** سطرُ الوضع المختصر — النوعُ وعددُ الحلقات أو الموعد */
  subtitle?: string;
  /** «الحلقة ٥» — للقادم وحدَه، ويغيب إن لم يعرفه TMDB */
  ep?: string;
};

/**
 * جسد الرئيسية — كل ما تحت الترويسة (D-087).
 *
 * مكوّن خادمٍ مستقل خلف Suspense: يحمل الموجة الثانية كاملة (ترجمة
 * المكتبة، تفاصيل TMDB، بطاقات «أكمل المشاهدة»…) بعيداً عن المسار الحرج،
 * فأول بايت للصفحة لم يعد رهينة أبطأ طلبٍ خارجي.
 */
/** ما يعرفه صفُّ «تابِع المشاهدة» عن بطاقة مسلسلٍ فوق صفّ المتابعة */
export type ContinueExtra = {
  id: number;
  backdropPath: string | null;
  episodeLabel: string | null;
  season: number | null;
  episode: number | null;
  runtime: number | null;
};

/** بطاقةُ قائمةٍ في «تابِع المشاهدة» — محفوظةٌ أو قائمةُ تشغيلٍ صريحة */
export type BriefListCard = {
  list: SavedListBrief;
  watched: number;
  next: ListItem | null;
  /** 🆕 هل «التالي» في مكتبتك؟ (D-604) — ختمُ المسلسل من البطاقة يتابعه أوّلاً إن لم يكن */
  nextFollowed: boolean;
  total: number;
};

/** بطاقةُ طابور «بلا قائمة» (D-505) */
export type ToWatchQueueCard = {
  name: string;
  next: {
    tmdb_id: number;
    media_type: "movie";
    title: string;
    poster_path: string | null;
  };
  watched: number;
  total: number;
};

/**
 * الموجةُ الأولى — ما تحتاجه الترويسةُ وأبوابُ التحويل (D-087):
 * أرقامٌ من الصفوف الخام قبل أيِّ ترجمةٍ أو نداءِ TMDB. **المُدخلاتُ هي
 * ما جلبته الصفحةُ (أو الباب) في موجتها الأولى** — لا نداءَ هنا إلّا
 * احتياطُ ما قبل `performance.sql`.
 */
export async function buildHomeHeader({
  followRows,
  summary,
  watchedMovies,
  profile,
  myRatings,
  t,
}: {
  followRows: Awaited<ReturnType<typeof getFollows>>;
  summary: Awaited<ReturnType<typeof getWatchSummary>>;
  watchedMovies: Awaited<ReturnType<typeof getWatchedMovies>>;
  profile: Awaited<ReturnType<typeof getProfile>>;
  myRatings: Awaited<ReturnType<typeof getMyRatings>>;
  t: T;
}) {
  /* احتياط ما قبل performance.sql — كان في الموجة الثانية وصعد هنا:
     أرقام الترويسة تُبنى من عدّاد المشاهدات، والترويسة (منذ D-087) تُرسم
     قبل الموجة الثانية. من شغّل performance.sql لا يدفع هذا الطلب أصلاً */
  const fallbackEps = summary ? null : await getAllWatchedEpisodes();

  // مجموعة المعرّفات للحالة، والدقائق الفعلية للوقت — من الصفوف نفسها
  const watchedMovieIds = new Set(watchedMovies.map((m) => m.id));
  const movieMinutes = watchedMovieMinutes(watchedMovies);

  const prefs = sanitizeHomePrefs(profile?.home_prefs);

  const myRatingsCount = myRatings.length;

  const today = new Date().toISOString().slice(0, 10);

  /* ===== الموجة الثانية: كل ما تبقّى من قراءاتٍ خارجية دفعةً واحدة =====
     كانت الصفحة سبع موجات انتظارٍ متسلسلة (ترجمة ← تهيئة ← بطاقات ←
     رائج ← أفلام ← ملخّص) رغم أن أغلبها مستقل. المعرّفات والأعداد كلها
     تُحسب من الصفوف الخام قبل الترجمة — الترجمة تغيّر النص لا الهوية —
     فتنطلق الطلبات كلها معاً وتبقى موجتان لا سبع. */

  const rawActive = followRows.filter((f) => !f.dropped);
  const rawTv = rawActive.filter((f) => f.media_type === "tv");
  const rawMovies = rawActive.filter((f) => f.media_type === "movie");

  const watchedByShow = new Map<number, number>();
  // المسلسلات مرتّبة من الأحدث مشاهدةً — أساس اختيار «الحلقة التالية» والاقتراحات
  let lastWatchedOrder: number[] = [];
  if (summary) {
    for (const s of summary) watchedByShow.set(s.show_tmdb_id, s.watched);
    lastWatchedOrder = [...summary]
      .sort((a, b) =>
        (b.last_watched ?? "").localeCompare(a.last_watched ?? ""),
      )
      .map((s) => s.show_tmdb_id);
  }

  // لحظات بدء الإعادة بيدنا هنا — تُمرَّر فلا يستعلم عنها أحد مرة ثانية
  const rewatchSinceMap = new Map<number, string>();
  for (const f of rawTv) {
    if (f.rewatch_started_at)
      rewatchSinceMap.set(f.tmdb_id, f.rewatch_started_at);
  }

  if (!summary && fallbackEps) {
    // مسار ما قبل performance.sql — مع احترام دورات الإعادة
    for (const w of fallbackEps) {
      const since = rewatchSinceMap.get(w.show_tmdb_id);
      if (since && w.watched_at < since) continue;
      watchedByShow.set(
        w.show_tmdb_id,
        (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1,
      );
    }
    for (const w of [...fallbackEps].sort((a, b) =>
      b.watched_at.localeCompare(a.watched_at),
    )) {
      if (!lastWatchedOrder.includes(w.show_tmdb_id))
        lastWatchedOrder.push(w.show_tmdb_id);
    }
  }

  /* ===== أرقام الترويسة — من الموجة الأولى وحدها (D-087) =====
     الترجمة تغيّر الأسماء لا الأعداد، وتفاصيل TMDB تُجمّل البطاقات لا
     العدّادات — فالترويسة تُرسم من الصفوف الخام فوراً ولا تنتظر الموجة
     الثانية. استثناء واحد مقصود: عدّاد «القادم» يقرأ تواريخ الأفلام
     المخزّنة فقط؛ فيلمٌ توبِع للتوّ ينضم للعدّاد بعد أول مزامنةٍ لبياناته
     (MovieStatsSync تكتبها من أول رسمة) — نقصٌ نادر يشفى ذاتياً. */
  let unfinishedCount = 0;
  let finishedShowsCount = 0;
  for (const row of rawTv) {
    const aired = row.aired_episodes ?? row.total_episodes ?? 0;
    const watched = Math.min(
      watchedByShow.get(row.tmdb_id) ?? 0,
      aired || Infinity,
    );
    if (aired === 0 || watched < aired) unfinishedCount++;
    if (aired > 0 && watched >= aired) finishedShowsCount++;
  }
  const finishedMoviesCount = rawMovies.filter((f) =>
    watchedMovieIds.has(f.tmdb_id),
  ).length;
  const toWatchCount =
    unfinishedCount +
    rawMovies.filter((f) => !watchedMovieIds.has(f.tmdb_id)).length;
  const droppedCount = followRows.filter((f) => f.dropped).length;

  const watchedEpisodeTotal = [...watchedByShow.values()].reduce(
    (a, n) => a + n,
    0,
  );
  const totalMinutes =
    (summary ?? []).reduce((a, r) => a + (r.minutes ?? 0), 0) + movieMinutes;
  const hours = Math.round(totalMinutes / 60);
  const watchTime =
    hours < 24 ? t.hours(hours) : t.days(Math.floor(hours / 24));

  const upcomingCount = Math.min(
    16,
    rawTv.filter((r) => r.next_air_date && r.next_air_date >= today).length +
      rawMovies.filter(
        (f) =>
          !watchedMovieIds.has(f.tmdb_id) &&
          f.stats_updated_at != null &&
          f.next_air_date &&
          f.next_air_date >= today,
      ).length,
  );

  /* ⚖️ 🆕 **أصفرٌ واحدٌ لكلِّ الرموز** (D-437، طلبُ أحمد: «طبّق نفس
     اللون الأصفر في كل الأيقونات»). **ونقضٌ مسجَّل**: كان لكلِّ خانةٍ
     لونُها «فتُعرف قبل أن تُقرأ» — **وثمنُه أن الشاشةَ الواحدة فيها
     خمسةُ ألوانِ تمييزٍ فلا يبقى للأصفر معنى «هنا الفعل».**
     **واللونُ الدلاليُّ باقٍ حيث يقول حالةً** (أخضرُ الاكتمال وأحمرُ
     الإيقاف في خيط الملصق) — **الذي سقط هو التلوينُ التزيينيّ.** */
  /* 🆕 **الرمزُ والاسمُ من `headerStatMeta` لا مكتوبَين هنا** (D-787):
     **كانت الخريطةُ منسوخةً بين هذا الملفّ ولوح التخصيص**، وافترقت
     فعلاً في «حلقات» — **ومن نسخ خريطةً في ملفّين افترقت عند أوّل
     تعديل** (القاعدة ٦). **والقيمةُ والوجهةُ تبقيان هنا**: هما بيانُ
     الصفحة لا وصفُ الخانة. */
  const statMeta = headerStatMeta(t);
  const allHeaderStats: Record<HeaderStatKey, HeaderStat> = {
    shows: {
      key: "shows",
      icon: statMeta.shows.icon,
      value: String(rawTv.length),
      label: statMeta.shows.label,
      href: "/library?filter=tv",
      color: "var(--accent)",
    },
    movies: {
      key: "movies",
      icon: statMeta.movies.icon,
      value: String(rawMovies.length),
      label: statMeta.movies.label,
      href: "/library?filter=movie",
      color: "var(--accent)",
    },
    towatch: {
      key: "towatch",
      icon: statMeta.towatch.icon,
      value: String(toWatchCount),
      label: statMeta.towatch.label,
      href: "/library",
      color: "var(--accent)",
    },
    time: {
      key: "time",
      icon: statMeta.time.icon,
      value: watchTime,
      label: statMeta.time.label,
      href: "/stats",
      color: "var(--accent)",
    },
    episodes: {
      key: "episodes",
      icon: statMeta.episodes.icon,
      value: String(watchedEpisodeTotal),
      label: statMeta.episodes.label,
      href: "/stats",
      color: "var(--accent)",
    },
    upcoming: {
      key: "upcoming",
      icon: statMeta.upcoming.icon,
      value: String(upcomingCount),
      label: statMeta.upcoming.label,
      href: "/library",
      color: "var(--accent)",
    },
    completed: {
      key: "completed",
      icon: statMeta.completed.icon,
      value: String(finishedShowsCount + finishedMoviesCount),
      label: statMeta.completed.label,
      href: "/library",
      color: "var(--accent)",
    },
    dropped: {
      key: "dropped",
      icon: statMeta.dropped.icon,
      value: String(droppedCount),
      label: statMeta.dropped.label,
      href: "/library",
      color: "var(--accent)",
    },
    // خانة «تقييماتي» في بطاقة الأرقام (طلب أحمد 9 Aug)
    ratings: {
      key: "ratings",
      icon: statMeta.ratings.icon,
      value: String(myRatingsCount),
      label: statMeta.ratings.label,
      href: "/ratings",
      color: "var(--accent)",
    },
  };
  const headerStats: HeaderStat[] = prefs.statsPick.map(
    (k) => allHeaderStats[k],
  );
  return {
    watchedMovieIds, prefs, today,
    watchedByShow, lastWatchedOrder, rewatchSinceMap,
    headerStats, allHeaderStats, myRatingsCount,
  };
}

export type HomeHeaderModel = Awaited<ReturnType<typeof buildHomeHeader>>;

/**
 * الموجةُ الثانية — جسدُ الرئيسية كلُّه (كان `HomeBody` قبل `return`):
 * الأقسامُ الاثنا عشر بحسابها وترتيبها وطوابيرها. **الأسماءُ هي أسماءُ
 * متغيّرات الصفحة بأعيانها** فتفكّها الصفحةُ بـ`const {…} = await
 * buildHomeBody(…)` ويبقى JSX كما كان حرفاً.
 */
export async function buildHomeBody({
  followRows,
  summary,
  watchedMovieIds,
  profile,
  movieProgress,
  prefs,
  watchedByShow,
  lastWatchedOrder,
  rewatchSinceMap,
  myRatings,
  locale,
  t,
  today,
}: {
  followRows: Awaited<ReturnType<typeof getFollows>>;
  summary: Awaited<ReturnType<typeof getWatchSummary>>;
  watchedMovieIds: Set<number>;
  profile: Awaited<ReturnType<typeof getProfile>>;
  /** وعدٌ لا مصفوفة: أُطلق في `HomePage` وانتُظر هنا (جولة ٢٢ أغسطس) */
  movieProgress: ReturnType<typeof getAllMovieProgress>;
  prefs: ReturnType<typeof sanitizeHomePrefs>;
  watchedByShow: Map<number, number>;
  lastWatchedOrder: number[];
  rewatchSinceMap: Map<number, string>;
  myRatings: Awaited<ReturnType<typeof getMyRatings>>;
  locale: Locale;
  t: T;
  today: string;
}) {
  const rawActive = followRows.filter((f) => !f.dropped);
  const rawTv = rawActive.filter((f) => f.media_type === "tv");
  const rawMovies = rawActive.filter((f) => f.media_type === "movie");

  // الصفوف التي لم يُحسب لها عدد حلقات بعد تحتاج TMDB مرة واحدة لتهيئتها
  const bootstrapIds = rawTv
    .filter((f) => f.aired_episodes == null)
    .slice(0, 12)
    .map((f) => f.tmdb_id);

  // مرشّحو «أكمل المشاهدة» يُعرفون من الملخّص قبل الترجمة — فتنضم
  // تفاصيلهم إلى نفس الموجة بدل موجةٍ خاصة بهم
  /* 🆕 D-918 (حكمُ أحمد بلقطة: «حالياً يعرض ٤ ويُعتبر قليلاً، خلّها
     مفتوحة»): الصفُّ أفقيٌّ يُمرَّر، فالسقفُ لم يعد شاشةً بل كلفةً —
     عشرون بطاقةً ولا أكثر: كلُّ بطاقةٍ نداءُ TMDB وصورةُ خلفيّة (D-914)،
     ومكتبةٌ فيها أكثرُ من عشرين عملاً جارياً تجد بقيّتَها في ورقة «الكل». */
  const CONTINUE_CARDS = 20;
  /* نستطلع بقدر ما نعرض: معرفةُ «الحلقة التالية» تلزم لكلِّ بطاقة، وبها
     نعرف مَن ينتظره موسمٌ جديد فيبقى في «للمشاهدة». */
  const CONTINUE_PROBE = CONTINUE_CARDS;
  const earlyContinueIds: number[] = summary
    ? rawTv
        .map((row) => {
          const aired = row.aired_episodes ?? row.total_episodes ?? 0;
          const watched = Math.min(
            watchedByShow.get(row.tmdb_id) ?? 0,
            aired || Infinity,
          );
          return { id: row.tmdb_id, watched, aired };
        })
        .filter((i) => i.watched > 0 && (i.aired === 0 || i.watched < i.aired))
        .sort((a, b) => {
          const ai = lastWatchedOrder.indexOf(a.id);
          const bi = lastWatchedOrder.indexOf(b.id);
          return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
        })
        .slice(0, CONTINUE_PROBE)
        .map((i) => i.id)
    : [];

  // مواعيد الأفلام: المخزّن في صفّ المتابعة يغني عن TMDB، والناقص يُطلب
  // مرة واحدة ثم يُخزَّن عبر MovieStatsSync
  const upcomingMovieCandidates = rawMovies
    .filter((f) => !watchedMovieIds.has(f.tmdb_id))
    .slice(0, 10);
  const movieIdsNeedingDate = upcomingMovieCandidates
    .filter((f) => f.stats_updated_at == null)
    .map((f) => f.tmdb_id);

  /* قسما «تقييماتي» و«قوائمي» (طلب أحمد 9 Aug) — لا يدفع كلفتهما إلا
     من أظهرهما من التخصيص، كقاعدة «recap» نفسها */
  const topRatedRaw = prefs.order.includes("ratings")
    ? [...myRatings]
        .sort(
          (a, b) =>
            b.rating - a.rating || b.updated_at.localeCompare(a.updated_at),
        )
        .slice(0, 16)
    : [];

  const [
    follows,
    bootstrapDetails,
    fetchedMovieDetails,
    recapHist,
    earlyExtra,
    topRated,
    myListsRaw,
    myPlaylistIds,
    savedListCards,
    friendsRows,
    homeArt,
    savedLists,
    myPlaylists,
    listedMovieIds,
    movieProgressRows,
  ] = await Promise.all([
    // أسماء المكتبة وملصقاتها بلغة الواجهة لا بلغة يوم المتابعة
    localizeFollows(followRows, locale),
    Promise.all(bootstrapIds.map((id) => getTv(id).catch(() => null))),
    Promise.all(
      movieIdsNeedingDate.map((id) => getMovie(id).catch(() => null)),
    ),
    prefs.order.includes("recap")
      ? getWatchHistory(300).catch(() => [])
      : Promise.resolve(null),
    Promise.all(
      earlyContinueIds.map(async (id) => {
        const [tv, keys] = await Promise.all([
          getTv(id).catch(() => null),
          getWatchedForShow(id, rewatchSinceMap.get(id) ?? null).catch(
            () => new Set<string>(),
          ),
        ]);
        const next = tv ? nextUnwatchedEpisode(tv, keys) : null;
        return {
          id,
          backdropPath: tv?.backdrop_path ?? null,
          episodeLabel: next ? `S${next.season} E${next.episode}` : null,
          season: next?.season ?? null,
          episode: next?.episode ?? null,
          runtime: tv?.episode_run_time?.[0] ?? null,
        };
      }),
    ),
    /* ⚖️ **و«الرائج» غادر هذه الموجة** (جولة ٢٠ أغسطس): كان أبطأ عضوٍ
       فيها — نداءَ TMDB الوحيد الذي لا يخصّ مكتبتك فلا يكون في الكاش
       غالباً — **فيحكم وحدَه متى تظهر بطاقاتُ «تابِع المشاهدة» كلُّها.**
       صار قسماً مستقلاً (`TrendingSection`) يبثّ حين يجهز، وحارسُ
       D-321 معه حيث ذهب. */
    // العناوين بلغة الواجهة لا بلغة يوم التقييم (قاعدة D-048)
    topRatedRaw.length
      ? localizeRows(topRatedRaw, locale).catch(() => topRatedRaw)
      : Promise.resolve(topRatedRaw),
    prefs.order.includes("lists")
      ? getMyLists().catch(() => [])
      : Promise.resolve([]),
    /* 🆕 **ورايةُ التشغيل لكلِّ قائمةٍ من قوائمك** (D-674) — **نداءٌ
       مخبَّأٌ خفيفٌ بشرط القسم نفسِه** (D-510)، **ومفتاحُ البطاقة لا
       يُرسم بدونه** فلا يكذب (D-217).
       ⚠️ **والمحفوظةُ لا تحتاجه**: رايتُها تصل مع بطاقتها من
       `shapeListCards` في الاستعلام نفسِه. */
    prefs.order.includes("lists")
      ? getMyPlaylistIds().catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    /* 🆕 **ومحفوظاتُه معها** (D-597، حكمُه بلقطةٍ لصفّ «قوائمي»:
       «اعرض كل الليست حتى الي معطيها قلب») — نظيرُ تبويب الملفّ
       (D-588): **البطاقةُ `PublicListCard` نفسُها وسطرُ صاحبها يفصل
       الإعجابَ عن الملكيّة**. ونفسُ شرط «قوائمي» فلا يدفع كلفتَها
       من أخفى القسم. */
    prefs.order.includes("lists")
      ? getSavedLists().catch(() => [])
      : Promise.resolve([]),
    /* 🆕 **«أعمالُ أصدقائك الآن»** (البند ٧) — **ولا يدفع كلفتَه إلا من
       أظهره** (قاعدةُ «recap» و«قوائمي» نفسُها)، **وهو نداءُ الخطّ نفسِه
       بلا إعجاباتٍ ولا ترجمة** (D-205). */
    prefs.order.includes("friends")
      ? getFriendsWatching(12).catch(() => [])
      : Promise.resolve([]),
    /* أغلفتي المختارة (D-131) — كانت `await` منفرداً بعد الموجة رغم أنها
       لا تعتمد على شيءٍ منها: رحلةُ قاعدةٍ كاملة تُدفع وحدَها على أسخن
       مسارٍ في التطبيق. الاستبدالُ نفسُه بعد الموجة كما كان. */
    getMyTitleArt(),
    /* 🆕 **قوائمُك المحفوظة بعناصرها** (D-496) — **في الموجة المتدفّقة
       لا الأولى**: أوّلُ بايتٍ للرئيسية لا ينتظر قائمة. */
    prefs.order.includes("continue")
      ? getSavedListsBrief().catch(() => [])
      : Promise.resolve([]),
    /* 🆕 **قوائمُ تشغيلك الصريحة** (D-505) — نفسُ شرط «تابِع المشاهدة» */
    prefs.order.includes("continue")
      ? getMyPlaylistsBrief().catch(() => [])
      : Promise.resolve([]),
    /* 🆕 **وأفلامُك الساكنةُ قائمةً — لاستثنائها من طابور «بلا قائمة»**
       (D-505): ما وضعتَه في قائمةٍ قد أعلنتَ سياقَه هناك. */
    prefs.order.includes("continue")
      ? getMyListedMovieIds().catch(() => new Set<number>())
      : Promise.resolve(new Set<number>()),
    /* 🆕 **موضعُ الأفلام يُنتظر هنا** — والنداءُ انطلق في `HomePage`
       قبل الموجة الأولى، **فهذا انتظارُ وعدٍ طائرٍ لا رحلةٌ جديدة.** */
    movieProgress,
  ]);

  /* استبدالُ الأغلفة في مصدرٍ واحد بعد الترجمة: بطاقات «أكمل» و«ابدأ»
     و«للمشاهدة» كلّها تُبنى من `follows`، والرئيسية سطحي أنا فلا تسريب
     (ق٨). التقييمات كذلك — بطاقةُ عملٍ قيّمتُه في صفحتي. */
  if (homeArt.size) {
    for (const f of follows) {
      const a = homeArt.get(artKey(f.media_type, f.tmdb_id));
      if (a?.poster_path) f.poster_path = a.poster_path;
    }
    for (const r of topRated) {
      const a = homeArt.get(artKey(r.media_type, r.tmdb_id));
      if (a?.poster_path) r.poster_path = a.poster_path;
    }
  }

  /* قوائمي بنفس بطاقة المجتمع (PublicListCard): بطاقة واحدة للأبواب
     كلها — بلا سطر صاحبٍ فالصفحة صفحته، والفارغة لا تُعرض */
  /* 🆕 **و«المفضّلة» لا تُرسم هنا كما لا تُرسم في المكتبة و`/lists`**
     (D-670، طلبُ أحمد بلقطةٍ حوّط فيها بطاقتَها في صفِّ «قوائمي»:
     «وليست الفيفورت احذفها») — **قارئٌ ثالثٌ لـ`listsForDisplay` لا
     مرشِّحٌ رابعٌ يُكتب هنا** (D-145).

     🔴 **وهي ثغرةُ D-654 لا نقضٌ لها**: ذلك القرارُ أسقط البطاقةَ من
     `/library` و`/lists` **يومَ لم يكن صفُّ «قوائمي» في الرئيسية يعرض
     قوائمَه أصلاً** — **وD-597 فتحه بعده فورثت الرئيسيةُ البطاقةَ التي
     أُسقطت من أختيها.** **وقاعدةٌ تُطبَّق في سطحين من ثلاثة ليست
     قاعدة.**

     🔑 **ولا صفَّ يُحذف من القاعدة**: المفضّلةُ وعاءُ ما يعرضه القلبُ
     نفسُه (بابُها في صفِّ أفعال المكتبة — D-654)، **والحجبُ عرضٌ لا
     مصدر.** */
  const playlistSet = new Set(myPlaylistIds);
  const myListCards = listsForDisplay(myListsRaw)
    .map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind ?? null,
      owner: null,
      item_count: l.item_count,
      posters: l.posters ?? [],
      /* 🆕 **ومفتاحُ التشغيل معها** (D-674) — **الحالةُ تُقرأ ولا
         تُفترض** (D-217)، والكاتبُ `setListPlaylist` لأنها قائمتك. */
      mine: true,
      playlist: playlistSet.has(l.id),
    }))
    .filter((c) => c.item_count > 0);

  /* 🆕 **قوائمُه ثمّ محفوظاتُه في الصفّ نفسِه** (D-597) — ترتيبُ
     تبويب الملفّ والمكتبة نفسُه (D-588)، **وسطرُ الصاحب على المحفوظة
     وحدَها يقول الفرقَ** فلا تُنسب إليه قائمةُ غيره. والتكرارُ يُسقَط
     بالمعرّف — قائمةٌ يملكها وأعجب بها لا تُرسم مرّتين. */
  const ownedIds = new Set(myListCards.map((c) => c.id));
  /* 🆕 **وأولويّتُه تسبق العرفَ** (D-615، حكمُ أحمد: «والليست في الهوم
     احتاج أقدر أرتّبهم كذلك مثل الأفلام والمسلسلات»): ترتيبُ D-597
     (قوائمُه ثمّ محفوظاتُه) يبقى للمَن لم يرتّب — ومَن رتّب فترتيبُه
     المحفوظ يتقدّم والجديدُ يلحق بذيله (نمطُ الصفَّين حرفاً). */
  const homeListCardsBase = applyQueueOrder(
    [
      ...myListCards,
      ...savedListCards.filter((c) => c.item_count > 0 && !ownedIds.has(c.id)),
    ],
    (c) => c.id,
    prefs.listsOrder,
  );
  /* 🔴 🆕 **وأرقامُ قوائمك كانت تسقط في الرئيسية وحدَها** (D-673، سؤالُ
     أحمد بلقطةٍ حوّط فيها بطاقةَ «Best movies.»: «ليه الليستات القديمة
     ما فيها نجمة وقلب وشكلها مو مثل الجديدة؟»).

     🔍 **والسببُ ليس في البطاقة**: **المحفوظةُ تمرّ بـ`shapeListCards`
     فتصلها الأرقام**، **وقوائمُك تُبنى بيدٍ هنا بستّة حقول** — ولا
     `saves` ولا `rating` فيها. **وقسمُ «قوائمي» في المكتبة يمرّ
     بـ`getListCardStats`** (D-350) **فيعرضها** — **فبطاقةٌ واحدةٌ
     بشكلين في سطحين**، وهو نقضٌ صامتٌ لقاعدة «بطاقةُ القائمة مقاسُها
     واحدٌ في كلِّ سطح» (D-375/D-433/D-461).

     🔑 **والعلاجُ قارئٌ ثالثٌ للدالّة نفسِها لا حسابٌ جديد** (D-145).
     ⚠️ **والعامّةُ وحدَها لها أرقام**: الخاصّةُ لا تُقرأ فلا تُحفظ ولا
     تُقيَّم (نصُّ الهجرة ١٠٥ حرفاً).
     ⚡ **والنداءُ يُطلق ولا يُنتظر هنا**: يُجمع بعد موجة TMDB لـ«تابِع
     المشاهدة» أدناه — **فيركب رحلةً قائمةً ولا يضيف رحلةً إلى أسخن
     مسارٍ في التطبيق** (D-470/D-511). */
  const publicOwnIds = listsForDisplay(myListsRaw)
    .filter((l) => l.is_public && (l.item_count ?? 0) > 0)
    .map((l) => l.id);
  const listStatsP: Promise<
    Map<string, { saves: number; reviews: number; rating: number | null }>
  > =
    publicOwnIds.length > 0
      ? getListCardStats(publicOwnIds).catch(
          () =>
            new Map<
              string,
              { saves: number; reviews: number; rating: number | null }
            >(),
        )
      : Promise.resolve(
          new Map<
            string,
            { saves: number; reviews: number; rating: number | null }
          >(),
        );

  // ما تغيّر اسمه بالترجمة يُكتب مرة واحدة في قاعدة البيانات
  const metaToCache = follows
    .filter((f, n) => f.title !== followRows[n]?.title)
    .slice(0, 24)
    .map((f) => ({
      tmdbId: f.tmdb_id,
      mediaType: f.media_type,
      title: f.title,
      posterPath: f.poster_path,
    }));

  // الموقوف ببطاقةٍ حمراء لا مكان له في الرئيسية — مكانه المكتبة وحدها
  const active = follows.filter((f) => !f.dropped);
  const tvFollows = active.filter((f) => f.media_type === "tv");
  const movieFollows = active.filter((f) => f.media_type === "movie");

  interface UpcomingItem {
    key: string;
    href: string;
    title: string;
    posterPath: string | null;
    date: string;
  }

  /**
   * المسلسل كما تحتاجه هذه الصفحة.
   *
   * كانت الصفحة تطلب من TMDB تفاصيل كل مسلسل في المكتبة — أربعون متابعة
   * تعني أربعين طلباً خارجياً قبل أن يظهر شيء. وكل ما نعرضه هنا (الاسم،
   * الملصق، الحلقات المعروضة، موعد القادمة) مخزّنٌ عندنا في صفّ المتابعة
   * نفسه، يُحدَّث من صفحة المسلسل ومن `ShowStatsSync`. فالطلبات الخارجية
   * بقيت للحالتين اللتين تحتاجانها فعلاً: بطاقة «الحلقة التالية»، وصفٌّ
   * جديد لم يُحسب له عدد بعد.
   */
  const items: Item[] = [];
  const upcoming: UpcomingItem[] = [];

  for (const row of tvFollows) {
    const aired = row.aired_episodes ?? row.total_episodes ?? 0;
    // لا تتجاوز المشاهَد ما عُرض، وإلا خرجت نسبة فوق ١٠٠٪
    const watched = Math.min(
      watchedByShow.get(row.tmdb_id) ?? 0,
      aired || Infinity,
    );
    items.push({
      id: row.tmdb_id,
      name: row.title,
      posterPath: row.poster_path,
      watched,
      aired,
      progress: percentOf(watched, aired),
    });

    if (row.next_air_date && row.next_air_date >= today) {
      upcoming.push({
        key: `tv-${row.tmdb_id}`,
        href: `/show/${row.tmdb_id}`,
        title: row.title,
        posterPath: row.poster_path,
        date: row.next_air_date,
      });
    }
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  // كل ما لم يكتمل — ثم ما بدأته فعلاً
  const unfinished = items
    .filter((i) => i.aired === 0 || i.watched < i.aired)
    .sort((a, b) => {
      if (a.watched > 0 !== b.watched > 0) return a.watched > 0 ? -1 : 1;
      return b.progress - a.progress;
    });

  const continueWatching = unfinished.filter((i) => i.watched > 0);

  const statsToCache: ShowStat[] = [];
  for (const tv of bootstrapDetails) {
    if (!tv) continue;
    const row = tvFollows.find((f) => f.tmdb_id === tv.id);
    if (!row) continue;
    const nextDate = tv.next_episode_to_air?.air_date ?? null;
    statsToCache.push({
      tmdbId: tv.id,
      total: tv.number_of_episodes ?? 0,
      aired: airedEpisodeCount(tv),
      nextAirDate: nextDate,
    });
  }

  // ===== أكمل المشاهدة =====
  // ما أنت في وسطه، الأحدث مشاهدةً أولاً — صفٌّ واحد حلّ محلّ البطاقة
  // العريضة التي كانت تعرض عملاً واحداً وتأخذ ثلث الشاشة
  /* 🆕 **وأولويّةُ صاحبها فوق الحداثة** (D-605): ما رتّبه بيده من ورقة
     الصفِّ يتقدّم بترتيبه، **قبل القصّ** — فعملٌ قدّمه وهو خارج أحدث
     المشاهدات يدخل البطاقات، وما لم يرتّبه يبقى بالأحدث كما كان. */
  const continueRow = applyQueueOrder(
    [...continueWatching].sort((a, b) => {
      const ai = lastWatchedOrder.indexOf(a.id);
      const bi = lastWatchedOrder.indexOf(b.id);
      return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
    }),
    (i) => `c-${i.id}`,
    prefs.continueOrder,
  );

  /* بطاقات «أكمل المشاهدة»: تفاصيلها جاءت مع الموجة الثانية أصلاً في
     المسار الطبيعي؛ الاحتياط (قبل performance.sql) وحده يطلبها هنا */
  const continueTop = continueRow.slice(0, CONTINUE_CARDS);
  const extraById = new Map(earlyExtra.map((e) => [e.id, e]));
  /* موسمٌ جديد ينتظر: أنهيت كل ما سبق، وأوّل حلقةٍ لم تُشاهَد هي حلقة
     موسمٍ جديد. هذا العمل «لم يبدأ» من جهة المستخدم وإن كان في وسط
     المسلسل، فيبقى في «للمشاهدة» ولا يُطوى في «أكمل المشاهدة» وحدها. */
  const newSeasonWaiting = new Set(
    earlyExtra
      .filter((e) => e.episode === 1 && (e.season ?? 0) > 1)
      .map((e) => e.id),
  );
  const continueExtra = summary
    ? continueTop.map(
        (i) =>
          extraById.get(i.id) ?? {
            id: i.id,
            backdropPath: null,
            episodeLabel: null,
            season: null,
            episode: null,
            runtime: null,
          },
      )
    : await Promise.all(
        continueTop.map(async (i) => {
          const [tv, keys] = await Promise.all([
            getTv(i.id).catch(() => null),
            getWatchedForShow(i.id, rewatchSinceMap.get(i.id) ?? null).catch(
              () => new Set<string>(),
            ),
          ]);
          const next = tv ? nextUnwatchedEpisode(tv, keys) : null;
          return {
            id: i.id,
            backdropPath: tv?.backdrop_path ?? null,
            episodeLabel: next ? `S${next.season} E${next.episode}` : null,
            season: next?.season ?? null,
            episode: next?.episode ?? null,
            runtime: tv?.episode_run_time?.[0] ?? null,
          };
        }),
      );


  /* 🆕 D-929 — **لقطةُ الودجت**: ثلاثةُ سطورٍ نصّيّةٍ لا أكثر. الودجتُ
     `RemoteViews` ولا تقبل صورةً تُجلب من الشبكة، **والنصُّ يكفي لسؤالٍ
     واحد: أيُّ حلقةٍ تاليةٍ لأقرب ثلاثة أعمال.** */
  const widgetItems = continueTop.slice(0, 3).map((i, n) => ({
    t: i.name,
    s: continueExtra[n]?.episodeLabel ?? null,
    h: `/show/${i.id}`,
  }));

  /* 🆕 **وهنا تُجمع أرقامُ قوائمك** (D-673) — **بعد موجة TMDB لا
     قبلها**، فالرحلةُ تجري بجوارها لا في أثرها. **والصفرُ لا يُطبع**
     (D-219): من لم يحفظها أحدٌ ولم يقيّمها تبقى بطاقتُها بلا رمزٍ —
     **وهو الصدقُ لا نقصُ الشكل.** */
  const listStats = await listStatsP;
  const homeListCards = homeListCardsBase.map((c) => {
    const st = listStats.get(c.id);
    return st
      ? { ...c, saves: st.saves, reviews: st.reviews, rating: st.rating }
      : c;
  });

  const empty = false;

  const favGenres = profile?.favorite_genres ?? [];

  /* 🔴 🆕 **وحارسُ «الرائج للفارغين وحدَهم» سقط** (D-599، بلاغُ أحمد
     بلقطتين: «حطّيت تريندينج ذيس ويك وما طلع لي شي!»): كان القسمُ
     يُرسم فقط لمن لا «أكمل المشاهدة» عنده — احتياطاً للحساب الفارغ —
     **بينما سجلُّ الأقسام وورقةُ الترتيب يعرضانه خياراً لكلِّ أحد**:
     **مفتاحٌ فعّلتَه ولا يفعل شيئاً هو عطلُ D-217 بعينه.**
     **والحاكمُ الآن `prefs.order` وحدَه** ككلِّ أقسام الصفحة — ومن لم
     يفعّله لا يدفع نداءَه (شرطُ الرسم في الخريطة أدناه)، وسقوطُ جلبِ
     TMDB يُسقطه صامتاً كما كان. */

  // لزرّ الحفظ السريع على «الرائج»: ما تتابعه، وما أنهيته فعلاً
  const followedKeys = new Set(
    follows.map((f) => `${f.media_type}-${f.tmdb_id}`),
  );
  const doneShowIds = new Set(
    items.filter((i) => i.aired > 0 && i.watched >= i.aired).map((i) => i.id),
  );

  /* ===== 🆕 القوائمُ التي تتابعها كما تتابع مسلسلاً (D-496) =====
     **والعلامةُ ليست عموداً جديداً بل ما تقوله بياناتُك أصلاً**:
     **قائمةٌ حفظتَها وأعمالُها في مكتبتك = قائمةٌ أضفتَها لتشاهدها.**
     **و«أضف الكل» تفعل الاثنين معاً** (D-495) فتدخل من أوّل ضغطة.

     **وثلاثةُ حدودٍ تمنعها من أن تصير رفّاً ثانياً:**
     **١ · القصيرةُ وحدَها** (≤٤٠): «أفضل ٢٥٠» ليست شيئاً يُتابَع
     فيلماً فيلماً — **وقائمةٌ بمئتَي عنصرٍ في «تابِع المشاهدة» تُقرأ
     كتالوجاً لا استئنافاً.**
     **٢ · وأكثرُها في مكتبتك** (≥٦٠٪): قائمةٌ تصادف أن عندك ثلاثةً
     منها ليست قائمةً «دخلتَها».
     **٣ · وفيها ما لم يُشاهَد**: المكتملةُ ليست «تابِع المشاهدة».

     ⚠️ **وسقفُ اثنتين**: الصفُّ صفُّ أعمالٍ أوّلاً، **والقوائمُ ضيفٌ
     فيه لا صاحبُ دار.** */
  /* 🆕 ===== D-505: قوائمُ التشغيل الصريحة، وطابورُ «بلا قائمة» =====

     **ثلاثُ عائلاتٍ لبطاقة القائمة في هذا الصفّ، من الأصرح إلى الأحدس:**
     **١ · طابورُ أفلامك التي بلا قائمة** (طلبُ أحمد بنصّه: «ليست اسمها
     تو واتش تدخل فيها كل الأفلام اللي بدون ليست وتنعرض كplay list») —
     يُحسب من مكتبتك ولا يسكن القاعدة: **فيلمٌ يدخل قائمةً يخرج منه
     وحدَه**، بترتيب الإضافة (الأقدمُ وعدُك الأقدم).
     **٢ · قوائمُك برايةِ التشغيل** (هجرة ١٢٢) — **الصريحُ لا يمرّ بحدسِ
     المحفوظ**: لا نسبةَ ٦٠٪ ولا سقفَ ٤٠، من رفع الرايةَ قال أريدها.
     **٣ · المحفوظُ من قوائم الآخرين بحدس D-496** — كما كان. */
  const seenIt = (it: { media_type: "tv" | "movie"; tmdb_id: number }) =>
    it.media_type === "movie"
      ? watchedMovieIds.has(it.tmdb_id)
      : doneShowIds.has(it.tmdb_id);

  const unlistedQueue = movieFollows
    .filter((f) => !listedMovieIds.has(f.tmdb_id))
    .sort((a, b) => a.added_at.localeCompare(b.added_at));
  const unlistedNext =
    unlistedQueue.find((f) => !watchedMovieIds.has(f.tmdb_id)) ?? null;
  /* ⚖️ 🆕 **ورايةٌ فوقه** (D-559، بلاغُ أحمد: «ما أبغى أشوفها، أبغى
     الليست الي جنبها فقط وهي جات معها»): **كان الطابورُ الوحيدَ في
     هذا الصفّ بلا مفتاح** — قوائمُك الحقيقيّةُ تدخله برايةٍ ترفعها
     (`is_playlist`، D-505) **وهذا يدخل بحكم الحساب.** **ومفتاحُه
     بطاقتُه في تبويب «القوائم» بالمكتبة**، حيث تُرفع الرايات. */
  /* 🆕 D-703: بطاقةُ الطابور في صفِّ «القوائم» — **مفتاحُها هو مفتاحُ
     المكتبة نفسُه** (`setToWatchQueue`)، **والفارغُ لا بطاقةَ له** (D-219) */
  /* 🆕 **وترتيبُ صاحبها يُطبَّق قبل أن تُقرأ** (D-719): الورقةُ تحفظ
     `tw-mv-<id>` **بمفتاح البطاقة الرابع** (`towatchListOrder`)، **وما
     لم يُذكر يلحق على ترتيب الإضافة** (`applyQueueOrder`). */
  /* 🆕 **والمشاهَدُ يسقط من القائمة لا من الحساب** (D-848): **ما يُعرض
     ويُرتَّب ويُعدّ هو الباقي**، **و`unlistedQueue` الكاملُ يبقى تحته
     لبطاقة «تابِع المشاهدة» وحدَها** — الحكمُ في `unwatchedOf`. */
  const unlistedLeft = unwatchedOf(unlistedQueue, watchedMovieIds);
  const unlistedOrdered = applyQueueOrder(
    unlistedLeft,
    (f) => `tw-mv-${f.tmdb_id}`,
    prefs.towatchListOrder,
  );
  /* ⚠️ **والشرطُ صار على الباقي لا على الطابور** (D-219/D-280): **من
     شاهد أفلامَه كلَّها لا يرى بطاقةَ «للمشاهدة» تقول صفراً** — **وهي
     القاعدةُ نفسُها التي أخفتها حين كان الطابورُ فارغاً أصلاً.** */
  const toWatchQueueCard = unlistedLeft.length
    ? {
        on: prefs.toWatch,
        count: unlistedLeft.length,
        /* **والملصقاتُ الثلاثةُ رأسُ الطابور بعد ترتيبه** — **وبطاقةٌ
           لا تتغيّر بعد السحب تُقرأ حفظاً فاشلاً** (D-719). */
        posters: unlistedOrdered.slice(0, 3).map((f) => f.poster_path ?? null),
      }
    : null;
  /** 🆕 بذرةُ ورقة ترتيب البطاقة (D-719) — أفلامُها كلُّها بترتيب عرضها */
  const toWatchListItems: ReorderItem[] = unlistedOrdered.map((f) => ({
    key: `tw-mv-${f.tmdb_id}`,
    title: f.title,
    poster_path: f.poster_path ?? null,
    media_type: "movie" as const,
  }));

  const toWatchCard =
    prefs.toWatch && unlistedNext
      ? {
          name: t.libToWatch,
          next: {
            tmdb_id: unlistedNext.tmdb_id,
            media_type: "movie" as const,
            title: unlistedNext.title,
            poster_path: unlistedNext.poster_path,
          },
          watched: unlistedQueue.filter((f) => watchedMovieIds.has(f.tmdb_id))
            .length,
          total: unlistedQueue.length,
        }
      : null;

  const playlistCards = myPlaylists
    .map((l) => {
      const next = l.items.find((it) => !seenIt(it)) ?? null;
      return {
        list: l,
        watched: l.items.filter(seenIt).length,
        next,
        nextFollowed: next
          ? followedKeys.has(`${next.media_type}-${next.tmdb_id}`)
          : false,
        total: l.items.length,
      };
    })
    /* المكتملةُ ليست «تابِع المشاهدة» — الرايةُ باقيةٌ والبطاقةُ تغيب */
    .filter((c) => c.next !== null)
    .slice(0, 3);
  const playlistIds = new Set(myPlaylists.map((l) => l.id));

  const listCards = savedLists
    /* قائمةٌ رُفعت عليها الرايةُ لا تدخل من باب الحدس ثانيةً (قاعدة ٦) */
    .filter((l) => !playlistIds.has(l.id))
    .filter((l) => l.items.length > 0 && l.items.length <= 40)
    .map((l) => {
      const seen = (it: (typeof l.items)[number]) =>
        it.media_type === "movie"
          ? watchedMovieIds.has(it.tmdb_id)
          : doneShowIds.has(it.tmdb_id);
      const mine = l.items.filter((it) =>
        followedKeys.has(`${it.media_type}-${it.tmdb_id}`),
      ).length;
      const watched = l.items.filter(seen).length;
      const next = l.items.find((it) => !seen(it)) ?? null;
      return {
        list: l,
        mine,
        watched,
        next,
        nextFollowed: next
          ? followedKeys.has(`${next.media_type}-${next.tmdb_id}`)
          : false,
        total: l.items.length,
      };
    })
    .filter((c) => c.next !== null && c.mine / c.total >= 0.6)
    .slice(0, 2);

  /* ⚖️ **ومشهدُ «التالي» لبطاقات القوائم (D-507) غادر إلى قسمه**
     (جولة ٢٠ أغسطس): كان `await` منفرداً هنا بعد الموجة — رحلةَ TMDB
     إضافيةً تقف في وجه كلِّ الأقسام، ونتيجتُها لا يقرؤها إلا صفُّ
     «تابِع المشاهدة». صار داخل `ContinueSection` خلف Suspense خاصّته:
     البطاقاتُ تبثّ حين تجهز صورُها، والرفوفُ لا تنتظرها. */

  // ===== مسلسلاتي: كل ما تتابعه، الأقرب إلى الاستئناف أولاً =====
  const myShows = [...items].sort((a, b) => {
    const rank = (i: typeof a) =>
      i.watched > 0 && (i.aired === 0 || i.watched < i.aired)
        ? 0
        : i.watched === 0
          ? 1
          : 2;
    const d = rank(a) - rank(b);
    return d !== 0 ? d : b.progress - a.progress;
  });

  // ===== أفلامي: الموضع المحفوظ يصير شريط تقدّم، والمشاهَد يمتلئ =====
  const progressById = new Map(
    movieProgressRows.map((m) => [m.movie_tmdb_id, m]),
  );
  const myMovies = movieFollows
    .map((f) => {
      const prog = progressById.get(f.tmdb_id);
      const done = watchedMovieIds.has(f.tmdb_id);
      const pct = done
        ? 100
        : prog?.runtime_minutes && prog.runtime_minutes > 0
          ? Math.round((prog.position_minutes / prog.runtime_minutes) * 100)
          : 0;
      return {
        tmdbId: f.tmdb_id,
        title: f.title,
        posterPath: f.poster_path,
        progress: pct,
        badge: done
          ? "✓"
          : prog
            ? t.minuteBadge(prog.position_minutes)
            : t.typeMovie,
        rank: done ? 2 : prog ? 0 : 1,
      };
    })
    .sort((a, b) => a.rank - b.rank || b.progress - a.progress);

  // ===== «للمشاهدة» و«القادم» في الرئيسية: مسلسلات وأفلام معاً =====
  // للمشاهدة: كل ما لم يكتمل — المسلسلات غير المنتهية والأفلام غير
  // المشاهَدة — بترتيب الأقرب إلى الاستئناف. القادم: ما له موعدٌ آتٍ.
  /* 🆕 **الكاملُ قبل القصّ** (D-605): ورقةُ الترتيب تعرض القائمةَ
     كلَّها («أشوف القائمة كاملة عندي في تو واتش») والصفُّ يقصّ للعرض
     وحدَه — **وأولويّةُ صاحبها تُطبَّق قبل القصّ** فما قدّمه يظهر. */
  const toWatchAll: MixedItem[] = [
    ...myShows
      /* لا تكرار بين الصفّين: ما بدأته مكانه «أكمل المشاهدة» وحدها،
         و«للمشاهدة» لِما لم يبدأ — عملٌ جديد، أو موسمٌ جديد ينتظر أوّل
         حلقةٍ منه. كان الصفّان يعرضان الشيء نفسه فيقرأ المستخدم مكتبته
         مرّتين ويظنّ أن أحدهما معطّل. قرارُ المالك. */
      .filter(
        (i) =>
          (i.aired === 0 || i.watched < i.aired) &&
          (i.watched === 0 || newSeasonWaiting.has(i.id)),
      )
      .map((i) => ({
        key: `tw-tv-${i.id}`,
        mediaType: "tv" as const,
        tmdbId: i.id,
        href: `/show/${i.id}`,
        title: i.name,
        posterPath: i.posterPath,
        progress: i.progress,
        /* ⚖️ 🆕 **وشارةُ «ما بدأته» سقطت من هذا الصفّ** (D-434، طلبُ
           أحمد بنصّه: «لا تعرض Not started داخل قسم معروف مسبقاً بأنه To
           Watch»). **وهو محقّ: القسمُ كلُّه ما لم يُبدأ**، **وشارةٌ تعيد
           عنوانَ قسمها على كلِّ بطاقةٍ فيه ضجيجٌ لا خبر** — والشارةُ
           باقيةٌ حيث تُفرِّق فعلاً (صفُّ «مسلسلاتي» والمكتبة). */
        subtitle:
          i.aired > 0
            ? `${t.typeSeries} · ${t.epsCount(i.aired)}`
            : t.typeSeries,
      })),
    /* 🆕 **وأولويّةُ البطاقة تُطبَّق داخل قسم الأفلام وحدَه** (D-719):
       **هذا هو ثمنُ المفتاح الرابع ومكسبُه معاً** — ما رتّبتَه في
       البطاقة يتقدّم بين الأفلام هنا، **ولا يُزيح مسلسلاً عن موضعه**
       (ولو تشاركا مفتاحاً واحداً لقفزت الأفلامُ كلُّها فوق المسلسلات). */
    ...applyQueueOrder(
      myMovies.filter((m) => m.progress < 100),
      (m) => `tw-mv-${m.tmdbId}`,
      prefs.towatchListOrder,
    ).map((m) => ({
      key: `tw-mv-${m.tmdbId}`,
      mediaType: "movie" as const,
      tmdbId: m.tmdbId,
      runtime: progressById.get(m.tmdbId)?.runtime_minutes ?? null,
      href: `/movie/${m.tmdbId}`,
      title: m.title,
      posterPath: m.posterPath,
      progress: m.progress,
      /* **والشارةُ تبقى حين تحمل خبراً**: «٤٥ د» موضعُك في الفيلم —
           **وأمّا «فيلم» فنوعُه، ومكانُه السطرُ الثاني في المختصر لا
           رقاقةٌ فوق الملصق.** */
      badge: m.progress === 0 ? undefined : m.badge,
      subtitle: t.typeMovie,
    })),
  ];
  const toWatchOrdered = applyQueueOrder(
    toWatchAll,
    (x) => x.key,
    prefs.towatchOrder,
  );
  const toWatchRow = toWatchOrdered.slice(0, 16);

  /* 🆕 **بذرتا ورقة الأولويّة** (D-605) — قائمتا الصفَّين كاملتَين
     بترتيب عرضهما الحاليّ، للمضيف الواحد `HomeQueueSheetHost`.
     مفاتيحُ «تابِع المشاهدة» مفاتيحُ عناصره المرسومة بأعيانها
     (`lc-towatch` · `pl-` · `lc-` · `c-`) فالحفظُ يعيد ما رُتِّب. */
  const continueQueueItems: ReorderItem[] = applyQueueOrder(
    [
      ...(toWatchCard
        ? [
            {
              key: "lc-towatch",
              title: toWatchCard.name,
              poster_path: toWatchCard.next.poster_path,
              fallbackIcon: "list" as const,
            },
          ]
        : []),
      ...playlistCards.map((c) => ({
        key: `pl-${c.list.id}`,
        title: curatedName(c.list.sourceSlug, c.list.name, locale),
        poster_path: c.next!.poster_path,
        fallbackIcon: "list" as const,
      })),
      ...listCards.map((c) => ({
        key: `lc-${c.list.id}`,
        title: curatedName(c.list.sourceSlug, c.list.name, locale),
        poster_path: c.next!.poster_path,
        fallbackIcon: "list" as const,
      })),
      ...continueRow.map((i) => ({
        key: `c-${i.id}`,
        title: i.name,
        poster_path: i.posterPath,
        media_type: "tv" as const,
      })),
    ],
    (x) => x.key,
    prefs.continueOrder,
  );
  const toWatchQueueItems: ReorderItem[] = toWatchOrdered.map((x) => ({
    key: x.key,
    title: x.title,
    poster_path: x.posterPath,
    media_type: x.mediaType,
  }));
  /* 🆕 وبذرةُ «قوائمي» (D-615) — البطاقاتُ مرتَّبةً كما تُعرض، ومفتاحُها
     معرّفُ القائمة نفسُه فالحفظُ يعيد ما رُتِّب بلا ترجمة */
  /* 🔴 🆕 **و«للمشاهدة» دخلت الترتيبَ معها** (D-866، بلاغُ أحمد بلقطتين:
     «تو واتش خليها تكون ظاهرة هنا عشان أرتّبها»).

     🔍 **والعلّةُ في التركيب لا في الورقة**: البطاقةُ كانت تُمرَّر
     `leading` — **موضعٌ مفروضٌ خارج الصفّ لا عضوٌ فيه** — **فورقةُ
     الترتيب تسرد ما في `lists` وحدَه فتغيب هي.** **وصفٌّ يعرض ستَّ
     بطاقاتٍ وورقتُه تعرض خمساً يُقرأ عطلاً** (D-217): ما يُرى يُرتَّب.

     🔑 **ولا صفَّ لها في `user_lists`** (حجّةُ D-559: طابورُ «ما لا
     قائمةَ له» لو صار قائمةً أفرغ نفسَه) — **فمفتاحُها اسمُها**
     (`tw-queue`)، والعمودُ JSON حرٌّ يقبله (`keyList`).
     ⚠️ **وغيابُ المفتاح من المحفوظ = الصدارة**: مَن رتّب قبل اليوم
     لا تقفز بطاقتُه إلى الذيل — **نصدّر المفتاحَ للترتيب المقروء
     فيبقى أوّلَ الصفّ كما كان** (D-028: ما لم يُقل لا يتغيّر). */
  const listsRowSeq = applyQueueOrder(
    [
      ...(toWatchQueueCard
        ? [
            {
              key: TW_LIST_KEY,
              card: null as (typeof homeListCards)[number] | null,
            },
          ]
        : []),
      ...homeListCards.map((c) => ({
        key: c.id,
        card: c as (typeof homeListCards)[number] | null,
      })),
    ],
    (x) => x.key,
    prefs.listsOrder.includes(TW_LIST_KEY)
      ? prefs.listsOrder
      : [TW_LIST_KEY, ...prefs.listsOrder],
  );
  const listsRowCards = listsRowSeq
    .map((x) => x.card)
    .filter((c): c is (typeof homeListCards)[number] => c !== null);
  /** موضعُ بطاقة «للمشاهدة» بين البطاقات — `-1` حين لا بطاقةَ لها */
  const toWatchListAt = listsRowSeq.findIndex((x) => x.card === null);
  const listsQueueItems: ReorderItem[] = listsRowSeq.map((x) =>
    x.card
      ? {
          key: x.card.id,
          title: x.card.name,
          poster_path: x.card.posters[0] ?? null,
          fallbackIcon: "list" as const,
        }
      : {
          key: TW_LIST_KEY,
          title: t.libToWatch,
          poster_path: toWatchQueueCard?.posters[0] ?? null,
          fallbackIcon: "list" as const,
        },
  );

  // مواعيد الأفلام: المخزّن يُقرأ من صفّ المتابعة، والمجلوب حديثاً يُكتب
  // عبر MovieStatsSync فلا يُطلب مرتين
  const fetchedDateById = new Map(
    movieIdsNeedingDate.map((id, n) => [
      id,
      fetchedMovieDetails[n]?.release_date ?? null,
    ]),
  );
  const movieDatesToCache = movieIdsNeedingDate.map((id) => ({
    tmdbId: id,
    releaseDate: fetchedDateById.get(id) ?? null,
  }));
  const movieDateOf = (f: (typeof upcomingMovieCandidates)[number]) =>
    f.stats_updated_at != null
      ? (f.next_air_date ?? null)
      : (fetchedDateById.get(f.tmdb_id) ?? null);

  const upcomingRow: MixedItem[] = [
    ...upcoming.map((u) => ({
      key: `up-${u.key}`,
      href: u.href,
      title: u.title,
      posterPath: u.posterPath,
      badge: whenLabel(u.date, t),
      subtitle: t.typeSeries,
      date: u.date,
    })),
    ...upcomingMovieCandidates
      .map((f) => ({ f, d: movieDateOf(f) }))
      .filter(({ d }) => d && d >= today)
      .map(({ f, d }) => ({
        key: `up-mv-${f.tmdb_id}`,
        href: `/movie/${f.tmdb_id}`,
        title: f.title,
        posterPath: f.poster_path,
        badge: whenLabel(d!, t),
        subtitle: t.typeMovie,
        date: d!,
      })),
  ]
    .sort((a, b) =>
      (a as { date: string }).date.localeCompare((b as { date: string }).date),
    )
    .slice(0, 16);

  /* ===== رقمُ الحلقة القادمة (D-437، طلبُ أحمد: «وأظهر رقم الحلقة في
     القادم») =====

     **ولا هجرةَ ولا عمود**: صفُّ المتابعة يحمل `next_air_date` وحدَه،
     **والرقمُ في `next_episode_to_air` من TMDB** — **وهو نداءٌ مخبّأٌ
     ساعةً** (`revalidate: 3600`) **لأعمالٍ يتابعها صاحبُ الحساب أصلاً
     فأكثرُها مجلوبٌ في الطلب نفسِه.**

     ⚠️ **والسقفُ عشرة**: القادمُ قد يكون ستّةَ عشر، **ونداءٌ لكلِّ صفٍّ
     بلا سقفٍ هو بالضبط ما أسقط شارةَ تقييم الحلقة** (D-384).
     **والغائبُ يغيب صامتاً** — **ولا يُخمَّن رقم** (D-432). */
  /* ⚖️ **وجلبُ الرقم غادر إلى قسم «القادم» نفسِه** (جولة ٢٠ أغسطس):
     كان `await` هنا يجعل عشرَ رحلات TMDB — زينةَ رقمٍ في صفٍّ واحد —
     تقف في وجه الرفوف كلِّها. `UpcomingSection` أدناه يجلبه خلف
     Suspense خاصّته، وقواعدُ D-437/D-432 معه بحرفها: السقفُ عشرة،
     والغائبُ يغيب صامتاً ولا يُخمَّن رقم. */

  // ===== ملخّص أسبوعك — قسمٌ اختياري يطيع نظام التخصيص كأي قسم =====
  // لا يُقرأ السجلّ إلا لمن فعّله، ولا يُرسم إن كان الأسبوع صفراً
  let recap: { line: string; posters: (string | null)[] } | null = null;
  if (prefs.order.includes("recap") && recapHist) {
    const hist = recapHist;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const rows = hist.filter((h) => h.watchedAt >= weekAgo);
    if (rows.length > 0) {
      const eps = rows.filter((h) => h.kind === "episode").length;
      const mv = rows.filter((h) => h.kind === "movie").length;
      const mins = rows.reduce(
        (n, h) => n + (h.runtime ?? (h.kind === "movie" ? 110 : 40)),
        0,
      );
      const hrs = Math.round(mins / 60);
      const seen = new Set<string>();
      const posters: (string | null)[] = [];
      for (const h of rows) {
        const key = `${h.kind === "movie" ? "movie" : "tv"}-${h.tmdbId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const f = follows.find((x) => `${x.media_type}-${x.tmdb_id}` === key);
        posters.push(f?.poster_path ?? null);
        if (posters.length === 3) break;
      }
      const parts: string[] = [];
      if (eps > 0) parts.push(t.diaryEpsGrouped(eps));
      if (mv > 0) parts.push(t.moviesGrouped(mv));
      if (hrs > 0)
        parts.push(hrs < 24 ? t.hours(hrs) : t.days(Math.floor(hrs / 24)));
      recap = { line: parts.join(" · "), posters };
    }
  }

  /* ===== الأيامُ الأربعةَ عشرَ القادمة — لشريط التقويم إن كان ظاهراً
     🆕 **أسبوعان لا أسبوع** (D-491، طلبُ أحمد: «أحتاج أقدر أكرّره بيدي
     وأشوف الأسبوع اللي بعده»): **الشريطُ صار يُمرَّر**، فسبعةُ أيامٍ
     تُظهر أسبوعاً وتترك الإصبعَ بلا ما يسحبه. **وأربعةَ عشرَ يومٍ سقفٌ
     لا اعتباطاً**: `upcoming` مبنيٌّ أصلاً، **فلا نداءَ جديدٌ ولا صفٌّ
     إضافيٌّ يُجلب** — الفلترةُ وحدَها اتّسعت. ===== */
  const nowTs = new Date();
  const weekDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(nowTs.getTime() + i * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      weekday: new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
        weekday: "short",
        timeZone: "UTC",
      }).format(d),
      dayNum: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        timeZone: "UTC",
      }).format(d),
    };
  });
  const weekEnd = weekDays[weekDays.length - 1].date;
  const weekEntries: WeekEntry[] = upcoming
    .filter(
      (u) =>
        u.date >= weekDays[0].date &&
        u.date <= weekEnd &&
        u.key.startsWith("tv-"),
    )
    .map((u) => ({
      date: u.date,
      showTmdbId: Number(u.key.replace("tv-", "")),
      title: u.title,
      label: "",
    }));
  return {
    statsToCache, metaToCache, movieDatesToCache,
    continueQueueItems, toWatchQueueItems, listsQueueItems, toWatchListItems,
    empty, widgetItems,
    toWatchCard, playlistCards, listCards, continueTop, continueExtra,
    weekDays, weekEntries,
    toWatchRow, toWatchOrdered, upcomingRow,
    myShows, myMovies, recap, topRated,
    homeListCards, toWatchQueueCard, listsRowCards, toWatchListAt,
    friendsRows, followedKeys, doneShowIds, favGenres,
  };
}

export type HomeBodyModel = Awaited<ReturnType<typeof buildHomeBody>>;

/**
 * مشاهدُ «التالي» لبطاقات القوائم في «تابِع المشاهدة» (D-507) — تُجلب
 * بعد الرفوف: في الويب خلف `Suspense` القسمِ، وفي التطبيق من `extras`.
 */
export async function continueBackdrops({
  toWatchCard,
  playlistCards,
  listCards,
}: {
  toWatchCard: ToWatchQueueCard | null;
  playlistCards: BriefListCard[];
  listCards: BriefListCard[];
}) {
  const cardNexts = [
    ...(toWatchCard ? [toWatchCard.next] : []),
    ...playlistCards.map((c) => c.next!),
    ...listCards.map((c) => c.next!),
  ];
  const nextBackdrops = new Map(
    await Promise.all(
      cardNexts.map(async (n) => {
        const key = `${n.media_type}-${n.tmdb_id}`;
        try {
          const d =
            n.media_type === "movie"
              ? await getMovie(n.tmdb_id)
              : await getTv(n.tmdb_id);
          return [key, d?.backdrop_path ?? null] as const;
        } catch {
          return [key, null] as const;
        }
      }),
    ),
  );
  const backdropOf = (n: { media_type: "tv" | "movie"; tmdb_id: number }) =>
    nextBackdrops.get(`${n.media_type}-${n.tmdb_id}`) ?? null;

  return { nextBackdrops, backdropOf };
}

/**
 * أرقامُ حلقات «القادم» (D-437/D-432): سقفُ عشرة، والغائبُ يغيب صامتاً.
 * **نسخٌ لا تعديلُ خاصيّة**: `row` يُعاد بنسخةٍ عليها `ep`.
 */
export async function upcomingWithEpisodes(row: MixedItem[], t: T): Promise<MixedItem[]> {
  const upcomingTvIds = row
    .filter((x) => x.key.startsWith("up-tv-"))
    .map((x) => Number(x.key.slice("up-tv-".length)))
    .filter((n) => Number.isFinite(n))
    .slice(0, 10);
  const epById = new Map<number, number>();
  if (upcomingTvIds.length > 0) {
    const eps = await Promise.all(
      upcomingTvIds.map((id) =>
        getTv(id)
          .then((tv) => tv.next_episode_to_air?.episode_number ?? null)
          .catch(() => null),
      ),
    );
    upcomingTvIds.forEach((id, n) => {
      const e = eps[n];
      if (e != null) epById.set(id, e);
    });
  }
  /* نسخٌ لا تعديلُ خاصيّة: `row` معاملُ مكوّنٍ والمعاملات لا تُمسّ —
     الرقمُ يُركَّب على نسخةٍ محليّة */
  const rows: MixedItem[] = row.map((x) => {
    if (!x.key.startsWith("up-tv-")) return x;
    const e = epById.get(Number(x.key.slice("up-tv-".length)));
    return e != null ? { ...x, ep: t.episodeNo(e) } : x;
  });
  return rows;
}

/** «رائجٌ هذا الأسبوع» — نداءُ TMDB الوحيدُ الذي لا يخصّ مكتبتك، بحارس D-321 */
export async function trendingRail(): Promise<SearchResult[]> {
  const trend: SearchResult[] = await trending()
    .then((rows) => railGuard(rows, { anime: "keep" }))
    .catch(() => [] as SearchResult[]);
  return trend;
}
