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
  getFollowStats,
  getMyRatings,
} from "@/lib/data";
import {
  getTv,
  getMovie,
  getSeason,
  trending,
  discoverByGenres,
  recommendationsFor,
  titleOf,
  yearOf,
  type TvDetails,
  type SearchResult,
} from "@/lib/tmdb";
import { backdropUrl } from "@/lib/media";
import { getT } from "@/lib/locale";
import { blendRecommendations, type Candidate } from "@/lib/recommend";
import { whenLabel } from "@/lib/when";
import { airedEpisodeCount, airedPerSeason, percentOf, nextUnwatchedEpisode } from "@/lib/progress";
import { episodeKey } from "@/lib/keys";
import { PosterCard } from "@/components/PosterCard";
import { HeroNextUp, type NextEpisode } from "@/components/HeroNextUp";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { ActionPanel, type PanelItem } from "@/components/ActionPanel";
import { ProfileHeader } from "@/components/ProfileHeader";
import { ShowStatsSync, type ShowStat } from "@/components/ShowStatsSync";

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  // ملخّص مجمّع: صف لكل مسلسل بدل صف لكل حلقة (آلاف الصفوف سابقاً).
  // صفوف الحلقات التفصيلية تُقرأ لاحقاً لمسلسل واحد فقط — صاحب «الحلقة التالية».
  const [follows, summary, watchedMovieIds, profile, movieProgress, social, myRatings] =
    await Promise.all([
      getFollows(),
      getWatchSummary(),
      getWatchedMovieIds(),
      getProfile(),
      getAllMovieProgress(),
      getFollowStats(user.id),
      getMyRatings(),
    ]);

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

  // «أكمل المشاهدة» صار للمبدوء فعلاً فقط. ما لم يُبدأ له قسمه الخاص
  // «جاهز تشوفه» — خلط الاثنين كان يخفي ما اخترته ولم تفتحه بعد وسط
  // ما أنت في منتصفه.
  const continueWatching = unfinished.filter((i) => i.watched > 0);
  const notStartedShows = unfinished.filter((i) => i.watched === 0);
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

  // الأفلام المكتملة لا تظهر في الرئيسية
  const pausedMovies = movieProgress.filter((m) => !watchedMovieIds.has(m.movie_tmdb_id));

  // مستخدم بلا مكتبة يذهب لشاشة الانضمام بدل صفحة فارغة
  if (follows.length === 0) redirect("/welcome");

  const empty = false;

  // TMDB خارجي — أي خلل فيه يجب ألا يُسقط الصفحة الرئيسية بالكامل
  const favGenres = profile?.favorite_genres ?? [];
  const followedIds = new Set(follows.map((f) => f.tmdb_id));

  // ===== بذور محرّك الاقتراحات =====
  const titleById = new Map<number, string>(follows.map((f) => [f.tmdb_id, f.title]));
  const recentShowIds = lastWatchedOrder.slice(0, 2);

  // ما تتابعه: أحدث ما أضفته ولم يدخل ضمن "آخر ما شاهدت"
  const followSeeds = follows.filter((f) => !recentShowIds.includes(f.tmdb_id)).slice(0, 3);

  // تقييماتك: ما أعطيته ٤ أو ٥ نجوم يصير بذرة، وما أعطيته نجمة أو نجمتين يُستبعد
  const lovedSeeds = myRatings
    .filter((r) => r.rating >= 4)
    .sort((a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3);
  const dislikedIds = myRatings.filter((r) => r.rating <= 2).map((r) => r.tmdb_id);

  const [trend, genreDiscover, followRecs, recentRecs, ratedRecs] = await Promise.all([
    trending().catch(() => [] as SearchResult[]),
    favGenres.length
      ? discoverByGenres(favGenres, "tv").catch(() => [] as SearchResult[])
      : Promise.resolve([] as SearchResult[]),
    Promise.all(
      followSeeds.map((f) =>
        recommendationsFor(f.media_type, f.tmdb_id)
          .then((rs) => ({ seed: f.title, rs }))
          .catch(() => ({ seed: f.title, rs: [] as SearchResult[] })),
      ),
    ),
    Promise.all(
      recentShowIds.map((id) =>
        recommendationsFor("tv", id)
          .then((rs) => ({ seed: titleById.get(id) ?? "", rs }))
          .catch(() => ({ seed: titleById.get(id) ?? "", rs: [] as SearchResult[] })),
      ),
    ),
    Promise.all(
      lovedSeeds.map((r) =>
        recommendationsFor(r.media_type, r.tmdb_id)
          .then((rs) => ({ seed: r.title ?? "", rs }))
          .catch(() => ({ seed: r.title ?? "", rs: [] as SearchResult[] })),
      ),
    ),
  ]);

  const candidates: Candidate[] = [];
  for (const { seed, rs } of ratedRecs)
    rs.forEach((r, i) => candidates.push({ result: r, source: "rated", seedTitle: seed, rank: i }));
  for (const { seed, rs } of followRecs)
    rs.forEach((r, i) => candidates.push({ result: r, source: "follows", seedTitle: seed, rank: i }));
  for (const { seed, rs } of recentRecs)
    rs.forEach((r, i) => candidates.push({ result: r, source: "recent", seedTitle: seed, rank: i }));
  genreDiscover.forEach((r, i) => candidates.push({ result: r, source: "genres", rank: i }));

  // ما قيّمته بنجمة أو نجمتين لا يُقترح عليك مرة أخرى
  const excluded = new Set<number>([...followedIds, ...watchedMovieIds, ...dislikedIds]);
  const suggested = blendRecommendations(candidates, { exclude: excluded, limit: 12 });
  const showTrending = empty || (!suggested.length && continueWatching.length === 0);

  const displayName = profile?.nickname || user.email?.split("@")[0] || "";

  // ===== جاهز تشوفه: في المفضلة ولا بعد بدأته =====
  // الفيلم يخرج من هنا لحظة تأشيره مشاهَداً فيبقى في المكتبة وحدها،
  // والمسلسل يخرج لحظة تأشير أول حلقة فينتقل إلى «أكمل المشاهدة».
  const startedMovieIds = new Set(movieProgress.map((m) => m.movie_tmdb_id));
  const readyMovies = movieFollows.filter(
    (f) => !watchedMovieIds.has(f.tmdb_id) && !startedMovieIds.has(f.tmdb_id),
  );

  const readyCount = notStartedShows.length + readyMovies.length;

  const panel: PanelItem[] = [
    {
      key: "waiting",
      href: "#waiting",
      count: waitingForYou.length,
      label: t.panelWaiting,
      sub: t.panelWaitingSub,
      emoji: "🔔",
      tone: "waiting",
    },
    {
      key: "watching",
      href: "#watching",
      count: continueWatching.length + pausedMovies.length,
      label: t.panelStarted,
      sub: t.panelStartedSub,
      emoji: "▶️",
      tone: "watching",
    },
    {
      key: "ready",
      href: "#ready",
      count: readyCount,
      label: t.panelReady,
      sub: t.panelReadySub,
      emoji: "🍿",
      tone: "ready",
    },
    {
      key: "soon",
      href: "#soon",
      count: upcoming.length,
      label: t.panelSoon,
      sub: t.panelSoonSub,
      emoji: "🗓",
      tone: "soon",
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-10">
      <ShowStatsSync stats={statsToCache} />

      {/* الترويسة وشريط الأعداد كتلة واحدة بفاصل ضيّق — الفاصل الافتراضي
          بينهما كان يضيف ٣٢ بكسل بلا داعٍ فوق ما يشغلانه أصلاً */}
      <div className="space-y-3">
        <ProfileHeader
          displayName={displayName}
          username={profile?.username ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          coverUrl={profile?.cover_url ?? null}
          followers={social.followers}
          following={social.following}
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

      <span id="waiting" className="block scroll-mt-20" />

      {waitingForYou.length > 0 && (
        <Section title={t.waitingForYou} href="/library" seeAll={t.seeAll}>
          {waitingForYou.map(({ tv, progress, pending }) => (
            <PosterCard
              key={`w-${tv.id}`}
              href={`/show/${tv.id}`}
              title={tv.name}
              posterPath={tv.poster_path}
              progress={progress}
              badge={t.episodesBadge(pending)}
              tone="waiting"
            />
          ))}
        </Section>
      )}

      <span id="watching" className="block scroll-mt-20" />

      {continueWatching.length > 0 && (
        <Section title={t.continueWatching} href="/library" seeAll={t.seeAll}>
          {continueWatching.map(({ tv, progress }) => (
            <PosterCard
              key={tv.id}
              href={`/show/${tv.id}`}
              title={tv.name}
              posterPath={tv.poster_path}
              progress={progress}
              badge={`${progress}%`}
            />
          ))}
        </Section>
      )}

      {pausedMovies.length > 0 && (
        <Section title={t.pausedMovies} href="/library" seeAll={t.seeAll}>
          {pausedMovies.map((m) => {
            const pct =
              m.runtime_minutes && m.runtime_minutes > 0
                ? Math.round((m.position_minutes / m.runtime_minutes) * 100)
                : 0;
            return (
              <PosterCard
                key={`mp-${m.movie_tmdb_id}`}
                href={`/movie/${m.movie_tmdb_id}`}
                title={m.title ?? t.typeMovie}
                posterPath={m.poster_path}
                progress={pct}
                badge={t.minuteBadge(m.position_minutes)}
              />
            );
          })}
        </Section>
      )}

      {/* ===== جاهز تشوفه =====
          كل ما في مفضلتك ولم تبدأه — مسلسلات وأفلام معاً. كان الفيلم الذي
          تحفظه لا يظهر في الرئيسية إطلاقاً حتى تفتحه، فيُنسى في المكتبة. */}
      <span id="ready" className="block scroll-mt-20" />

      {readyCount > 0 && (
        <Section
          title={t.readyToWatch}
          subtitle={t.readyToWatchSub}
          href="/library"
          seeAll={t.seeAll}
        >
          {[
            ...notStartedShows.map(({ tv }) => (
              <PosterCard
                key={`r-tv-${tv.id}`}
                href={`/show/${tv.id}`}
                title={tv.name}
                posterPath={tv.poster_path}
                badge={t.notStartedBadge}
              />
            )),
            ...readyMovies.map((f) => (
              <PosterCard
                key={`r-mv-${f.tmdb_id}`}
                href={`/movie/${f.tmdb_id}`}
                title={f.title}
                posterPath={f.poster_path}
                badge={t.typeMovie}
              />
            )),
          ]}
        </Section>
      )}

      <span id="soon" className="block scroll-mt-20" />

      {upcoming.length > 0 && (
        <Section title={t.comingSoon} href="/library" seeAll={t.seeAll}>
          {upcoming.map((u) => (
            <PosterCard
              key={u.key}
              href={u.href}
              title={u.title}
              posterPath={u.posterPath}
              year={whenLabel(u.date, t)}
              badge={u.badge}
            />
          ))}
        </Section>
      )}

      {suggested.length > 0 && (
        <PosterRail title={t.suggestedForYou} subtitle={t.suggestedSubtitle}>
          {suggested.map((s) => (
            <RailItem key={`sug-${s.result.media_type}-${s.result.id}`}>
              <PosterCard
                href={`/${s.result.media_type === "movie" ? "movie" : "show"}/${s.result.id}`}
                title={titleOf(s.result)}
                posterPath={s.result.poster_path}
                year={yearOf(s.result)}
                note={
                  s.source === "rated" && s.seedTitle
                    ? t.recoBecauseRated(s.seedTitle)
                    : s.source === "follows" && s.seedTitle
                    ? t.recoBecauseFollow(s.seedTitle)
                    : s.source === "recent" && s.seedTitle
                      ? t.recoBecauseWatched(s.seedTitle)
                      : t.recoBecauseGenre
                }
              />
            </RailItem>
          ))}
        </PosterRail>
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
        <Section title={t.trendingWeek}>
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
  subtitle,
  href,
  seeAll,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  seeAll?: string;
  children: React.ReactNode;
}) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  if (!items.length) return null;
  return (
    <PosterRail title={title} subtitle={subtitle} href={href} seeAllLabel={seeAll}>
      {items.map((child, i) => (
        <RailItem key={i}>{child}</RailItem>
      ))}
    </PosterRail>
  );
}
