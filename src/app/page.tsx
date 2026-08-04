import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchSummary,
  getWatchedMovieIds,
  getProfile,
  getAllMovieProgress,
  getMyRatings,
  getFollowStats,
  getReceivedLikes,
} from "@/lib/data";
import {
  getTv,
  getMovie,
  trending,
  titleOf,
  yearOf,
  type SearchResult,
} from "@/lib/tmdb";
import { getWatchedForShow } from "@/lib/data";
import { nextUnwatchedEpisode } from "@/lib/progress";
import { getT } from "@/lib/locale";
import { whenLabel } from "@/lib/when";
import { localizeFollows } from "@/lib/localize";
import { airedEpisodeCount, percentOf } from "@/lib/progress";
import { PosterCard } from "@/components/PosterCard";
import { ContinueCard } from "@/components/ContinueCard";
import { ToWatchCard } from "@/components/ToWatchCard";
import { PosterRail, RailItem } from "@/components/PosterRail";
import type { IconName } from "@/components/Icon";
import { ProfileHeader, type HeaderStat } from "@/components/ProfileHeader";
import { getLevel, levelPoints } from "@/lib/level";
import { sanitizeHomePrefs, type HomeSection } from "@/lib/homePrefs";
import { WeekStrip, type WeekEntry } from "@/components/WeekStrip";
import { ShowStatsSync, type ShowStat } from "@/components/ShowStatsSync";

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  // ملخّص مجمّع: صف لكل مسلسل بدل صف لكل حلقة (آلاف الصفوف سابقاً).
  // صفوف الحلقات التفصيلية تُقرأ لاحقاً لمسلسل واحد فقط — صاحب «الحلقة التالية».
  const [
    followRows,
    summary,
    watchedMovieIds,
    profile,
    movieProgress,
    myRatings,
    followStats,
    receivedLikes,
  ] = await Promise.all([
    getFollows(),
    getWatchSummary(),
    getWatchedMovieIds(),
    getProfile(),
    getAllMovieProgress(),
    getMyRatings(),
    getFollowStats(user.id),
    getReceivedLikes(user.id),
  ]);

  const prefs = sanitizeHomePrefs(profile?.home_prefs);

  const myRatingsCount = myRatings.length;
  const myComments = myRatings.filter((r) => r.review?.trim()).length;

  // أسماء المكتبة وملصقاتها بلغة الواجهة لا بلغة يوم المتابعة
  const follows = await localizeFollows(followRows, locale);

  // الموقوف ببطاقةٍ حمراء لا مكان له في الرئيسية — مكانه المكتبة وحدها
  const active = follows.filter((f) => !f.dropped);
  const tvFollows = active.filter((f) => f.media_type === "tv");
  const movieFollows = active.filter((f) => f.media_type === "movie");

  const watchedByShow = new Map<number, number>();
  // المسلسلات مرتّبة من الأحدث مشاهدةً — أساس اختيار «الحلقة التالية» والاقتراحات
  let lastWatchedOrder: number[] = [];

  if (summary) {
    for (const s of summary) {
      watchedByShow.set(s.show_tmdb_id, s.watched);
    }
    lastWatchedOrder = [...summary]
      .sort((a, b) =>
        (b.last_watched ?? "").localeCompare(a.last_watched ?? ""),
      )
      .map((s) => s.show_tmdb_id);
  } else {
    // احتياط قبل تشغيل ملف performance.sql
    const watchedEps = await getAllWatchedEpisodes();
    for (const w of watchedEps) {
      watchedByShow.set(
        w.show_tmdb_id,
        (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1,
      );
    }
    for (const w of [...watchedEps].sort((a, b) =>
      b.watched_at.localeCompare(a.watched_at),
    )) {
      if (!lastWatchedOrder.includes(w.show_tmdb_id))
        lastWatchedOrder.push(w.show_tmdb_id);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

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
  type Item = {
    id: number;
    name: string;
    posterPath: string | null;
    watched: number;
    aired: number;
    progress: number;
  };

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

  // «ينتظرك»: بدأته وفيه حلقات معروضة لم تُشاهد
  const waitingForYou = continueWatching.filter((i) => i.aired > i.watched);

  // ===== بطاقة «الحلقة التالية» =====
  // ثلاثة مرشّحين على الأكثر، وتفاصيلهم وحلقاتهم المشاهَدة تُطلب دفعةً
  // واحدة: كان كل مرشّح ينتظر الذي قبله، فست رحلات متتابعة قبل أن تُرسم
  // البطاقة. الآن رحلتان: موجة متوازية ثم طلب موسمٍ واحد.
  // الصفوف التي لم يُحسب لها عدد حلقات بعد تحتاج TMDB مرة واحدة لتهيئتها
  const bootstrapIds = tvFollows
    .filter((f) => f.aired_episodes == null)
    .slice(0, 12)
    .map((f) => f.tmdb_id);

  const bootstrapDetails = await Promise.all(
    bootstrapIds.map((id) => getTv(id).catch(() => null)),
  );

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
  const continueRow = [...continueWatching].sort((a, b) => {
    const ai = lastWatchedOrder.indexOf(a.id);
    const bi = lastWatchedOrder.indexOf(b.id);
    return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
  });

  /* بطاقات «أكمل المشاهدة» عريضة بصورة المشهد ورقم الحلقة، وكلاهما ليس في
     صفّ المتابعة. فتُطلب تفاصيلها من TMDB وحلقاتها المشاهَدة من قاعدتنا —
     لأربع بطاقات فقط، وهي أوّل ما تراه العين في الصفحة. الطلب مخبّأ ساعةً،
     فالكلفة تُدفع مرّةً لا مرّةً لكل فتح. */
  const CONTINUE_CARDS = 4;
  const continueTop = continueRow.slice(0, CONTINUE_CARDS);
  const continueExtra = await Promise.all(
    continueTop.map(async (i) => {
      const [tv, keys] = await Promise.all([
        getTv(i.id).catch(() => null),
        getWatchedForShow(i.id).catch(() => new Set<string>()),
      ]);
      const next = tv ? nextUnwatchedEpisode(tv, keys) : null;
      return {
        backdropPath: tv?.backdrop_path ?? null,
        episodeLabel: next ? `S${next.season} E${next.episode}` : null,
      };
    }),
  );

  // مستخدم بلا مكتبة يذهب لشاشة الانضمام بدل صفحة فارغة
  if (follows.length === 0) redirect("/welcome");

  const empty = false;

  const favGenres = profile?.favorite_genres ?? [];

  // «الرائج» احتياطٌ لمن لا شيء في يده الآن — و TMDB خارجي، فخلله لا يُسقط
  // الصفحة: القائمة ترجع فارغة والقسم لا يُرسم
  const showTrending = empty || continueWatching.length === 0;
  const trend = showTrending
    ? await trending().catch(() => [] as SearchResult[])
    : [];

  const displayName = profile?.nickname || user.email?.split("@")[0] || "";

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
  const progressById = new Map(movieProgress.map((m) => [m.movie_tmdb_id, m]));
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
  type MixedItem = {
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
  };

  const toWatchRow: MixedItem[] = [
    ...myShows
      .filter((i) => i.aired === 0 || i.watched < i.aired)
      .map((i) => ({
        key: `tw-tv-${i.id}`,
        mediaType: "tv" as const,
        tmdbId: i.id,
        href: `/show/${i.id}`,
        title: i.name,
        posterPath: i.posterPath,
        progress: i.progress,
        badge: i.watched === 0 ? t.notStartedBadge : undefined,
      })),
    ...myMovies
      .filter((m) => m.progress < 100)
      .map((m) => ({
        key: `tw-mv-${m.tmdbId}`,
        mediaType: "movie" as const,
        tmdbId: m.tmdbId,
        runtime: progressById.get(m.tmdbId)?.runtime_minutes ?? null,
        href: `/movie/${m.tmdbId}`,
        title: m.title,
        posterPath: m.posterPath,
        progress: m.progress,
        badge: m.progress === 0 ? t.typeMovie : m.badge,
      })),
  ].slice(0, 16);

  // مواعيد الأفلام ليست في صفّ المتابعة، فتُطلب من TMDB لغير المشاهَد
  // منها فقط — مخبّأةً ساعة، ولعشرة أفلام كحدّ
  const upcomingMovieCandidates = movieFollows
    .filter((f) => !watchedMovieIds.has(f.tmdb_id))
    .slice(0, 10);
  const upcomingMovieDetails = await Promise.all(
    upcomingMovieCandidates.map((f) => getMovie(f.tmdb_id).catch(() => null)),
  );
  const upcomingRow: MixedItem[] = [
    ...upcoming.map((u) => ({
      key: `up-${u.key}`,
      href: u.href,
      title: u.title,
      posterPath: u.posterPath,
      badge: whenLabel(u.date, t),
      date: u.date,
    })),
    ...upcomingMovieCandidates
      .map((f, n) => ({ f, d: upcomingMovieDetails[n] }))
      .filter(({ d }) => d?.release_date && d.release_date >= today)
      .map(({ f, d }) => ({
        key: `up-mv-${f.tmdb_id}`,
        href: `/movie/${f.tmdb_id}`,
        title: f.title,
        posterPath: f.poster_path,
        badge: whenLabel(d!.release_date!, t),
        date: d!.release_date!,
      })),
  ]
    .sort((a, b) => (a as { date: string }).date.localeCompare((b as { date: string }).date))
    .slice(0, 16);

  // ===== المستوى: يقيس ما شوهد فعلاً — حلقة بنقطة والفيلم بنقطتين =====
  const watchedEpisodeTotal = [...watchedByShow.values()].reduce(
    (a, n) => a + n,
    0,
  );
  const level = getLevel(
    levelPoints(watchedEpisodeTotal, watchedMovieIds.size),
  );

  // ===== أرقام الترويسة =====
  // كلها مشتقّة مما قرأناه أصلاً لهذه الصفحة: لا استعلام إضافي لعرضها
  const totalMinutes = (summary ?? []).reduce(
    (a, r) => a + (r.minutes ?? 0),
    0,
  );
  const hours = Math.round(totalMinutes / 60);
  const watchTime =
    hours < 24 ? t.hours(hours) : t.days(Math.floor(hours / 24));

  // «للمشاهدة»: ما لم يكتمل من المسلسلات وما لم يُشاهَد من الأفلام —
  // العدد نفسه الذي تعرضه المكتبة في تبويبها
  const toWatchCount =
    unfinished.length +
    movieFollows.filter((f) => !watchedMovieIds.has(f.tmdb_id)).length;

  const headerStats: HeaderStat[] = [
    {
      key: "shows",
      icon: "tv",
      value: String(tvFollows.length),
      label: t.shortShows,
      href: "/library?filter=tv",
      color: "var(--accent)",
    },
    {
      key: "movies",
      icon: "film",
      value: String(movieFollows.length),
      label: t.shortMovies,
      href: "/library?filter=movie",
      color: "var(--accent-2)",
    },
    {
      key: "towatch",
      icon: "bookmark",
      value: String(toWatchCount),
      label: t.libToWatch,
      href: "/library",
      color: "var(--brand-3)",
    },
    {
      key: "time",
      icon: "clock",
      value: watchTime,
      label: t.statWatchTime,
      href: "/stats",
      color: "var(--accent)",
    },
  ];

  // ===== الأيام السبعة القادمة — لشريط التقويم إن كان ظاهراً =====
  const nowTs = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(nowTs.getTime() + i * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      weekday: new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
        weekday: "short",
        timeZone: "UTC",
      }).format(d),
      dayNum: new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" }).format(d),
    };
  });
  const weekEnd = weekDays[6].date;
  const weekEntries: WeekEntry[] = upcoming
    .filter((u) => u.date >= weekDays[0].date && u.date <= weekEnd && u.key.startsWith("tv-"))
    .map((u) => ({
      date: u.date,
      showTmdbId: Number(u.key.replace("tv-", "")),
      title: u.title,
      label: "",
    }));

  return (
    <div className="space-y-8 sm:space-y-10">
      <ShowStatsSync stats={statsToCache} />

      <ProfileHeader
        displayName={displayName}
        username={profile?.username ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        coverUrl={profile?.cover_url ?? null}
        level={level}
        alerts={waitingForYou.length}
        stats={headerStats}
        followers={followStats.followers}
        comments={myComments}
        ratings={myRatingsCount}
        likes={receivedLikes}
        show={prefs}
        verified
        locale={locale}
      />

      {empty && (
        <section className="text-center py-4">
          <p className="text-muted">{t.emptyStart}</p>
        </section>
      )}

      {(() => {
        /* أقسام المحتوى تُرسم بترتيب التفضيلات: قائمة أسماء من التخصيص
           تُترجم إلى قوالب هنا، والغائب عن القائمة لا يُرسم أصلاً */
        const sections: Record<HomeSection, React.ReactNode> = {
          continue:
            continueTop.length > 0 ? (
              <Section
                key="continue"
                title={t.continueWatching}
                icon="play"
                iconColor="var(--accent)"
                href="/library"
                seeAll={t.seeAll}
                wide
              >
                {continueTop.map((i, n) => (
                  <ContinueCard
                    key={`c-${i.id}`}
                    href={`/show/${i.id}`}
                    title={i.name}
                    backdropPath={continueExtra[n]?.backdropPath ?? null}
                    posterPath={i.posterPath}
                    progress={i.progress}
                    episodeLabel={continueExtra[n]?.episodeLabel}
                  />
                ))}
              </Section>
            ) : null,
          week: (
            <div key="week">
              <span id="week" className="block scroll-mt-20" />
              <WeekStrip days={weekDays} entries={weekEntries} locale={locale} />
            </div>
          ),
          towatch:
            toWatchRow.length > 0 ? (
              <Section
                key="towatch"
                title={t.libToWatch}
                icon="bookmark"
                iconColor="var(--brand-3)"
                href="/library"
                seeAll={t.seeAll}
              >
                {toWatchRow.map((x) => (
                  <ToWatchCard
                    key={x.key}
                    tmdbId={x.tmdbId!}
                    mediaType={x.mediaType!}
                    runtime={x.runtime ?? null}
                    locale={locale}
                  >
                    <PosterCard
                      href={x.href}
                      title={x.title}
                      posterPath={x.posterPath}
                      progress={x.progress}
                      badge={x.badge}
                    />
                  </ToWatchCard>
                ))}
              </Section>
            ) : null,
          upcoming:
            upcomingRow.length > 0 ? (
              <Section
                key="upcoming"
                title={t.libUpcoming}
                icon="hourglass"
                iconColor="var(--accent)"
                href="/library"
                seeAll={t.seeAll}
              >
                {upcomingRow.map((x) => (
                  <PosterCard
                    key={x.key}
                    href={x.href}
                    title={x.title}
                    posterPath={x.posterPath}
                    badge={x.badge}
                  />
                ))}
              </Section>
            ) : null,
          shows:
            myShows.length > 0 ? (
              <Section
                key="shows"
                title={t.myShows}
                icon="tv"
                iconColor="var(--accent)"
                href="/library?filter=tv"
                seeAll={t.seeAll}
              >
                {myShows.map((i) => (
                  <PosterCard
                    key={`ms-${i.id}`}
                    href={`/show/${i.id}`}
                    title={i.name}
                    posterPath={i.posterPath}
                    progress={i.progress}
                    count={i.watched > 0 && i.aired > i.watched ? i.aired - i.watched : undefined}
                    badge={
                      i.watched === 0
                        ? t.notStartedBadge
                        : i.aired > 0 && i.watched >= i.aired
                          ? t.watchedBadge
                          : undefined
                    }
                    badgeTone={
                      i.aired > 0 && i.watched >= i.aired && i.watched > 0 ? "watched" : "neutral"
                    }
                  />
                ))}
              </Section>
            ) : null,
          movies:
            myMovies.length > 0 ? (
              <Section
                key="movies"
                title={t.myMovies}
                icon="film"
                iconColor="var(--accent-2)"
                href="/library?filter=movie"
                seeAll={t.seeAll}
              >
                {myMovies.map((m) => (
                  <PosterCard
                    key={`mm-${m.tmdbId}`}
                    href={`/movie/${m.tmdbId}`}
                    title={m.title}
                    posterPath={m.posterPath}
                    progress={m.progress}
                    badge={m.badge}
                  />
                ))}
              </Section>
            ) : null,
          trending:
            showTrending && trend.length > 0 ? (
              <Section key="trending" title={t.trendingWeek} icon="trending">
                {trend.slice(0, 12).map((r) => (
                  <PosterCard
                    key={`${r.media_type}-${r.id}`}
                    href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`}
                    title={titleOf(r)}
                    posterPath={r.poster_path}
                    year={yearOf(r)}
                    badge={r.media_type === "tv" ? t.typeSeries : t.typeMovie}
                  />
                ))}
              </Section>
            ) : null,
        };
        return prefs.order.map((k) => sections[k]);
      })()}

      <span id="watching" className="block scroll-mt-20" />

      {favGenres.length === 0 && !empty && (
        <Link
          href="/profile/edit"
          className="block text-center text-sm text-muted hover:text-accent border border-dashed border-border rounded-xl py-4 transition"
        >
          {t.pickGenresHint}
        </Link>
      )}

    </div>
  );
}

/**
 * كل الأقسام صفوف أفقية.
 *
 * كانت الأقسام الصغيرة تُرسم شبكةً ببطاقات أكبر — فيختلف حجم البطاقة بين
 * قسم وقسم في الشاشة نفسها، وقسمٌ بعنصر واحد يترك ثلثي الصفّ فارغاً.
 * الصفّ الأفقي يوحّد الإيقاع ويقصّر الصفحة.
 */
function Section({
  title,
  icon,
  iconColor,
  subtitle,
  href,
  seeAll,
  wide = false,
  children,
}: {
  title: string;
  icon?: IconName;
  iconColor?: string;
  subtitle?: string;
  href?: string;
  seeAll?: string;
  /** بطاقات عريضة بصورة المشهد بدل الملصق */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(
    Boolean,
  );
  if (!items.length) return null;
  return (
    <PosterRail
      title={title}
      icon={icon}
      iconColor={iconColor}
      subtitle={subtitle}
      href={href}
      seeAllLabel={seeAll}
    >
      {items.map((child, i) => (
        <RailItem key={i} wide={wide}>
          {child}
        </RailItem>
      ))}
    </PosterRail>
  );
}
