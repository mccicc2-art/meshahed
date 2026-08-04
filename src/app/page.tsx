import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchSummary,
  getWatchedForShow,
  getWatchedMovieIds,
  getProfile,
  getAllMovieProgress,
  getMyRatings,
} from "@/lib/data";
import {
  getTv,
  getMovie,
  getSeason,
  trending,
  titleOf,
  yearOf,
  type TvDetails,
  type SearchResult,
} from "@/lib/tmdb";
import { backdropUrl } from "@/lib/media";
import { getT } from "@/lib/locale";
import { airedEpisodeCount, airedPerSeason, percentOf, nextUnwatchedEpisode } from "@/lib/progress";
import { episodeKey } from "@/lib/keys";
import { PosterCard } from "@/components/PosterCard";
import { HeroNextUp, type NextEpisode } from "@/components/HeroNextUp";
import { PosterRail, RailItem } from "@/components/PosterRail";
import type { IconName } from "@/components/Icon";
import { ActionPanel, type PanelItem } from "@/components/ActionPanel";
import { ProfileHeader } from "@/components/ProfileHeader";
import { getLevel, levelPoints } from "@/lib/level";
import { WeekStrip, type WeekEntry } from "@/components/WeekStrip";
import { ShowStatsSync, type ShowStat } from "@/components/ShowStatsSync";

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  // ملخّص مجمّع: صف لكل مسلسل بدل صف لكل حلقة (آلاف الصفوف سابقاً).
  // صفوف الحلقات التفصيلية تُقرأ لاحقاً لمسلسل واحد فقط — صاحب «الحلقة التالية».
  const [follows, summary, watchedMovieIds, profile, movieProgress, myRatings] =
    await Promise.all([
      getFollows(),
      getWatchSummary(),
      getWatchedMovieIds(),
      getProfile(),
      getAllMovieProgress(),
      getMyRatings(),
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

  const [tvDetails, movieDetails] = await Promise.all([
    Promise.all(tvFollows.map((f) => getTv(f.tmdb_id).catch(() => null))),
    Promise.all(movieFollows.map((f) => getMovie(f.tmdb_id).catch(() => null))),
  ]);

  interface UpcomingItem {
    key: string;
    href: string;
    title: string;
    posterPath: string | null;
    date: string;
    badge?: string;
  }

  type Item = { tv: TvDetails; watched: number; aired: number; progress: number };
  const items: Item[] = [];
  const upcoming: UpcomingItem[] = [];
  const statsToCache: ShowStat[] = [];

  for (const tv of tvDetails) {
    if (!tv) continue;
    const row = tvFollows.find((f) => f.tmdb_id === tv.id);

    // المقام موحّد عبر كل الشاشات: الحلقات التي عُرضت فعلاً.
    // العدد المخزّن أدقّ (محسوب من تواريخ الحلقات نفسها في صفحة المسلسل)،
    // فيُقدَّم على الاشتقاق من `last_episode_to_air`.
    const aired = row?.aired_episodes ?? airedEpisodeCount(tv);
    // لا تتجاوز المشاهَد ما عُرض، وإلا خرجت نسبة فوق ١٠٠٪
    const watched = Math.min(watchedByShow.get(tv.id) ?? 0, aired || Infinity);
    items.push({ tv, watched, aired, progress: percentOf(watched, aired) });

    const next = tv.next_episode_to_air;
    const nextDate = next?.air_date ?? null;

    // تُكتب الإحصاءات في حالتين فقط، فلا كتابة في كل زيارة:
    // (١) لا يوجد رقم مخزّن بعد — تهيئة أولى،
    // (٢) تغيّر موعد الحلقة القادمة — أي أن حلقة جديدة نزلت.
    // خارج هاتين الحالتين لا نلمس القيمة، حتى لا يُستبدل العدد الدقيق
    // القادم من صفحة المسلسل بالعدد المشتقّ هنا.
    const needsBootstrap = row && row.aired_episodes == null;
    const scheduleMoved = row && (row.next_air_date ?? null) !== nextDate;
    if (row && (needsBootstrap || scheduleMoved)) {
      statsToCache.push({
        tmdbId: tv.id,
        total: tv.number_of_episodes ?? 0,
        aired: airedEpisodeCount(tv),
        nextAirDate: nextDate,
      });
    }

    if (nextDate) {
      upcoming.push({
        key: `tv-${tv.id}`,
        href: `/show/${tv.id}`,
        title: tv.name,
        posterPath: tv.poster_path,
        date: nextDate,
        badge: `S${next?.season_number} · E${next?.episode_number}`,
      });
    } else if (tv.first_air_date && tv.first_air_date > today) {
      // مسلسل في المفضلة لم يُعرض بعد
      upcoming.push({
        key: `tv-${tv.id}`,
        href: `/show/${tv.id}`,
        title: tv.name,
        posterPath: tv.poster_path,
        date: tv.first_air_date,
        badge: t.typeSeries,
      });
    }
  }

  // الأفلام التي تتابعها ولم تُطرح بعد تظهر أيضاً في «القادم قريباً»
  for (const m of movieDetails) {
    if (!m?.release_date || m.release_date < today) continue;
    upcoming.push({
      key: `movie-${m.id}`,
      href: `/movie/${m.id}`,
      title: m.title,
      posterPath: m.poster_path,
      date: m.release_date,
      badge: t.typeMovie,
    });
  }

  // كل ما لم يكتمل — يُقسم بعدها إلى «بدأته» و«ما بدأته»
  const unfinished = items
    .filter((i) => i.aired === 0 || i.watched < i.aired)
    .sort((a, b) => {
      if (a.watched > 0 !== b.watched > 0) return a.watched > 0 ? -1 : 1;
      return b.progress - a.progress;
    });

  // ما بدأته فعلاً — يُستخدم في اختيار بطاقة «الحلقة التالية» وفي ترتيب
  // صفّ مسلسلاتي
  const continueWatching = unfinished.filter((i) => i.watched > 0);
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  // «ينتظرك»: بدأته وفيه حلقات معروضة لم تُشاهد — أهم من مجرّد «جارٍ»
  const waitingForYou = continueWatching
    .filter((i) => i.watched > 0 && i.aired > i.watched)
    .map((i) => ({ ...i, pending: i.aired - i.watched }))
    .sort((a, b) => b.pending - a.pending);

  // ===== بطاقة «الحلقة التالية»: آخر مسلسل تابعته وله حلقة معروضة لم تُشاهد =====
  const nextUpCandidates = [...continueWatching].sort((a, b) => {
    const ai = lastWatchedOrder.indexOf(a.tv.id);
    const bi = lastWatchedOrder.indexOf(b.tv.id);
    return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
  });

  let nextUp: { tv: TvDetails; queue: NextEpisode[] } | null = null;

  for (const cand of nextUpCandidates.slice(0, 3)) {
    // صفوف الحلقات التفصيلية تُقرأ لهذا المسلسل وحده، لا لكل المكتبة
    const keys = await getWatchedForShow(cand.tv.id);
    const ep = nextUnwatchedEpisode(cand.tv, keys);
    if (!ep) continue;

    // طلب واحد فقط لجلب أسماء الحلقات وصورها — نأخذ الحلقة وما بعدها
    // في نفس الموسم حتى تتقدّم البطاقة بلا انتظار الخادم.
    const season = await getSeason(cand.tv.id, ep.season).catch(() => null);
    const airedCap = airedPerSeason(cand.tv).get(ep.season) ?? 0;

    const queue: NextEpisode[] = [];
    for (let n = ep.episode; n <= airedCap && queue.length < 6; n++) {
      if (keys.has(episodeKey(ep.season, n))) continue;
      const d = season?.episodes.find((e) => e.episode_number === n) ?? null;
      queue.push({
        season: ep.season,
        episode: n,
        name: d?.name ?? null,
        stillUrl: backdropUrl(d?.still_path ?? cand.tv.backdrop_path, "w780"),
        runtime: d?.runtime ?? cand.tv.episode_run_time?.[0] ?? null,
      });
    }
    if (!queue.length) continue;

    nextUp = { tv: cand.tv, queue };
    break;
  }

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
      label: u.badge ?? "",
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

  const panel: PanelItem[] = [
    {
      key: "shows",
      href: "/library?filter=tv",
      count: tvFollows.length,
      label: t.panelShows,
      icon: "tv" as const,
    },
    {
      key: "movies",
      href: "/library?filter=movie",
      count: movieFollows.length,
      label: t.panelMovies,
      icon: "film" as const,
    },
    {
      key: "comments",
      href: "/ratings?with=comments",
      count: myComments,
      label: t.panelComments,
      icon: "comment" as const,
    },
    {
      key: "ratings",
      href: "/ratings",
      count: myRatingsCount,
      label: t.panelRatings,
      icon: "star" as const,
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-10">
      <ShowStatsSync stats={statsToCache} />

      {/* الترويسة وشريط الأعداد كتلة واحدة بفاصل ضيّق — الفاصل الافتراضي
          بينهما كان يضيف ٣٢ بكسل بلا داعٍ فوق ما يشغلانه أصلاً */}
      <div className="space-y-2.5">
        <ProfileHeader
          displayName={displayName}
          username={profile?.username ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          coverUrl={profile?.cover_url ?? null}
          level={level}
          alerts={waitingForYou.length}
          locale={locale}
        />
        <ActionPanel items={panel} />
      </div>

      {empty && (
        <section className="text-center py-4">
          <p className="text-muted">{t.emptyStart}</p>
        </section>
      )}

      {nextUp && (
        <HeroNextUp
          showTmdbId={nextUp.tv.id}
          showName={nextUp.tv.name}
          queue={nextUp.queue}
          locale={locale}
        />
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
              key={`ms-${i.tv.id}`}
              href={`/show/${i.tv.id}`}
              title={i.tv.name}
              posterPath={i.tv.poster_path}
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
