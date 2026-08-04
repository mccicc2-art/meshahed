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
} from "@/lib/data";
import {
  getTv,
  trending,
  titleOf,
  yearOf,
  type SearchResult,
} from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { airedEpisodeCount, percentOf } from "@/lib/progress";
import { PosterCard } from "@/components/PosterCard";
import { ContinueCard } from "@/components/ContinueCard";
import { PosterRail, RailItem } from "@/components/PosterRail";
import type { IconName } from "@/components/Icon";
import { ProfileHeader, type HeaderStat } from "@/components/ProfileHeader";
import { getLevel, levelPoints } from "@/lib/level";
import { WeekStrip, type WeekEntry } from "@/components/WeekStrip";
import { ShowStatsSync, type ShowStat } from "@/components/ShowStatsSync";

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  // ملخّص مجمّع: صف لكل مسلسل بدل صف لكل حلقة (آلاف الصفوف سابقاً).
  // صفوف الحلقات التفصيلية تُقرأ لاحقاً لمسلسل واحد فقط — صاحب «الحلقة التالية».
  const [follows, summary, watchedMovieIds, profile, movieProgress, myRatings, followStats] =
    await Promise.all([
      getFollows(),
      getWatchSummary(),
      getWatchedMovieIds(),
      getProfile(),
      getAllMovieProgress(),
      getMyRatings(),
      getFollowStats(user.id),
    ]);

  const myRatingsCount = myRatings.length;
  const myComments = myRatings.filter((r) => r.review?.trim()).length;

  const tvFollows = follows.filter((f) => f.media_type === "tv");
  const movieFollows = follows.filter((f) => f.media_type === "movie");

  const watchedByShow = new Map<number, number>();
  // المسلسلات مرتّبة من الأحدث مشاهدةً — أساس اختيار «الحلقة التالية» والاقتراحات
  let lastWatchedOrder: number[] = [];

  if (summary) {
    for (const s of summary) {
      watchedByShow.set(s.show_tmdb_id, s.watched);
    }
    lastWatchedOrder = [...summary]
      .sort((a, b) => (b.last_watched ?? "").localeCompare(a.last_watched ?? ""))
      .map((s) => s.show_tmdb_id);
  } else {
    // احتياط قبل تشغيل ملف performance.sql
    const watchedEps = await getAllWatchedEpisodes();
    for (const w of watchedEps) {
      watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
    }
    for (const w of [...watchedEps].sort((a, b) => b.watched_at.localeCompare(a.watched_at))) {
      if (!lastWatchedOrder.includes(w.show_tmdb_id)) lastWatchedOrder.push(w.show_tmdb_id);
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
    const watched = Math.min(watchedByShow.get(row.tmdb_id) ?? 0, aired || Infinity);
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

  // مستخدم بلا مكتبة يذهب لشاشة الانضمام بدل صفحة فارغة
  if (follows.length === 0) redirect("/welcome");

  const empty = false;

  const favGenres = profile?.favorite_genres ?? [];

  // «الرائج» احتياطٌ لمن لا شيء في يده الآن — و TMDB خارجي، فخلله لا يُسقط
  // الصفحة: القائمة ترجع فارغة والقسم لا يُرسم
  const showTrending = empty || continueWatching.length === 0;
  const trend = showTrending ? await trending().catch(() => [] as SearchResult[]) : [];

  const displayName = profile?.nickname || user.email?.split("@")[0] || "";

  // ===== الأيام السبعة القادمة =====
  // نبني التواريخ من كائن زمن واحد: قراءتان منفصلتان للوقت قد تقعان على
  // جانبي منتصف الليل فينزاح التقويم يوماً
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

  // ===== مسلسلاتي: كل ما تتابعه، الأقرب إلى الاستئناف أولاً =====
  const myShows = [...items].sort((a, b) => {
    const rank = (i: typeof a) =>
      i.watched > 0 && (i.aired === 0 || i.watched < i.aired) ? 0 : i.watched === 0 ? 1 : 2;
    const d = rank(a) - rank(b);
    return d !== 0 ? d : b.progress - a.progress;
  });

  // ===== أفلامي: الموضع المحفوظ يصير شريط تقدّم، والمشاهَد يمتلئ =====
  const progressById = new Map(movieProgress.map((m) => [m.movie_tmdb_id, m]));
  const myMovies = movieFollows
    .map((f) => {
      const prog = progressById.get(f.tmdb_id);
      const done = watchedMovieIds.has(f.tmdb_id);
      const pct =
        done
          ? 100
          : prog?.runtime_minutes && prog.runtime_minutes > 0
            ? Math.round((prog.position_minutes / prog.runtime_minutes) * 100)
            : 0;
      return {
        tmdbId: f.tmdb_id,
        title: f.title,
        posterPath: f.poster_path,
        progress: pct,
        badge: done ? "✓" : prog ? t.minuteBadge(prog.position_minutes) : t.typeMovie,
        rank: done ? 2 : prog ? 0 : 1,
      };
    })
    .sort((a, b) => a.rank - b.rank || b.progress - a.progress);

  // ===== المستوى: يقيس ما شوهد فعلاً — حلقة بنقطة والفيلم بنقطتين =====
  const watchedEpisodeTotal = [...watchedByShow.values()].reduce((a, n) => a + n, 0);
  const level = getLevel(levelPoints(watchedEpisodeTotal, watchedMovieIds.size));

  // ===== أرقام الترويسة =====
  // كلها مشتقّة مما قرأناه أصلاً لهذه الصفحة: لا استعلام إضافي لعرضها
  const totalMinutes = (summary ?? []).reduce((a, r) => a + (r.minutes ?? 0), 0);
  const hours = Math.round(totalMinutes / 60);
  const watchTime = hours < 24 ? t.hours(hours) : t.days(Math.floor(hours / 24));

  const headerStats: HeaderStat[] = [
    {
      key: "shows",
      icon: "tv",
      value: String(tvFollows.length),
      label: t.panelShows,
      href: "/library?filter=tv",
    },
    {
      key: "movies",
      icon: "film",
      value: String(movieFollows.length),
      label: t.panelMovies,
      href: "/library?filter=movie",
    },
    { key: "time", icon: "clock", value: watchTime, label: t.statWatchTime, href: "/stats" },
    {
      key: "episodes",
      icon: "check",
      value: String(watchedEpisodeTotal),
      label: t.statsWatchedEpisodes,
      href: "/diary",
    },
    {
      key: "comments",
      icon: "comment",
      value: String(myComments),
      label: t.panelComments,
      href: "/ratings?with=comments",
    },
    {
      key: "ratings",
      icon: "star",
      value: String(myRatingsCount),
      label: t.panelRatings,
      href: "/ratings",
    },
  ];

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
        following={followStats.following}
        verified
        locale={locale}
      />

      {empty && (
        <section className="text-center py-4">
          <p className="text-muted">{t.emptyStart}</p>
        </section>
      )}

      {continueRow.length > 0 && (
        <Section title={t.continueWatching} icon="play" href="/library" seeAll={t.seeAll}>
          {continueRow.map((i) => (
            <ContinueCard
              key={`c-${i.id}`}
              href={`/show/${i.id}`}
              title={i.name}
              posterPath={i.posterPath}
              progress={i.progress}
            />
          ))}
        </Section>
      )}

      <span id="week" className="block scroll-mt-20" />
      <WeekStrip days={weekDays} entries={weekEntries} locale={locale} />

      <span id="watching" className="block scroll-mt-20" />

      {/* ===== مسلسلاتي وأفلامي =====
          صفّان تحت الأسبوع مباشرةً: مكتبتك كلها في متناول اليد من الصفحة
          الأولى. الترتيب يقدّم ما أنت في وسطه ثم ما لم تبدأه ثم ما أنهيته —
          فأول ملصق تراه هو غالباً ما ستفتحه. */}
      {myShows.length > 0 && (
        <Section title={t.myShows} icon="tv" href="/library?filter=tv" seeAll={t.seeAll}>
          {myShows.map((i) => (
            <PosterCard
              key={`ms-${i.id}`}
              href={`/show/${i.id}`}
              title={i.name}
              posterPath={i.posterPath}
              progress={i.progress}
              badge={
                i.watched === 0
                  ? t.notStartedBadge
                  : i.aired > 0 && i.watched >= i.aired
                    ? "✓"
                    : `${i.progress}%`
              }
            />
          ))}
        </Section>
      )}

      {myMovies.length > 0 && (
        <Section title={t.myMovies} icon="film" href="/library?filter=movie" seeAll={t.seeAll}>
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
      )}

      {favGenres.length === 0 && !empty && (
        <Link
          href="/profile/edit"
          className="block text-center text-sm text-muted hover:text-accent border border-dashed border-border rounded-xl py-4 transition"
        >
          {t.pickGenresHint}
        </Link>
      )}

      {showTrending && trend.length > 0 && (
        <Section title={t.trendingWeek} icon="trending">
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
  subtitle,
  href,
  seeAll,
  children,
}: {
  title: string;
  icon?: IconName;
  subtitle?: string;
  href?: string;
  seeAll?: string;
  children: React.ReactNode;
}) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  if (!items.length) return null;
  return (
    <PosterRail title={title} icon={icon} subtitle={subtitle} href={href} seeAllLabel={seeAll}>
      {items.map((child, i) => (
        <RailItem key={i}>{child}</RailItem>
      ))}
    </PosterRail>
  );
}
