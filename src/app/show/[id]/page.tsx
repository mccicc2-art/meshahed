import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  isFollowing,
  getWatchedForShow,
  getMyRating,
  getCommunityRating,
  getTitleReviews,
  getMyLists,
  getListsContaining,
} from "@/lib/data";
import {
  getTv,
  getSeason,
  getTrailer,
  getWatchProviders,
  isAnime,
  backdropUrl,
  posterUrl,
} from "@/lib/tmdb";
import { FollowButton } from "@/components/FollowButton";
import { EpisodeTracker, type SeasonSummary } from "@/components/EpisodeTracker";
import { getT } from "@/lib/locale";
import { RatingBox } from "@/components/RatingBox";
import { CommunityReviews } from "@/components/CommunityReviews";
import { DetailTabs } from "@/components/DetailTabs";
import { Icon, SectionTitle } from "@/components/Icon";
import { Trailer } from "@/components/Trailer";
import { WhereToWatch } from "@/components/WhereToWatch";
import { ListPicker } from "@/components/ListPicker";
import { formatDate } from "@/lib/when";
import { ShowStatsSync } from "@/components/ShowStatsSync";
import { airedEpisodeCount, airedPerSeason } from "@/lib/progress";
import { episodeKey } from "@/lib/keys";

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { id } = await params;
  const tvId = Number(id);
  if (!Number.isFinite(tvId)) notFound();

  // بيانات TMDB وبيانات المستخدم في موجة واحدة — لا شيء منها ينتظر الآخر
  const [
    tv,
    following,
    watched,
    myRating,
    community,
    titleReviews,
    trailer,
    watchWhere,
    myLists,
    inLists,
  ] = await Promise.all([
      getTv(tvId).catch(() => null),
      isFollowing(tvId, "tv"),
      getWatchedForShow(tvId),
      getMyRating(tvId, "tv"),
      getCommunityRating(tvId, "tv"),
      getTitleReviews(tvId, "tv"),
      getTrailer("tv", tvId),
      getWatchProviders("tv", tvId),
      getMyLists(),
      getListsContaining(tvId, "tv"),
    ]);

  if (!tv) {
    return (
      <div className="text-center py-24">
        <p className="text-muted mb-4">{t.showLoadFailed}</p>
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-accent text-[color:var(--on-accent)] text-sm font-semibold"
          >
            {t.navHome}
          </Link>
          <Link
            href="/search"
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted hover:text-foreground transition"
          >
            {t.navSearch}
          </Link>
        </div>
      </div>
    );
  }

  // كانت الصفحة تجلب حلقات كل المواسم دفعة واحدة — مسلسل بثلاثين موسماً يعني
  // ثلاثين طلب TMDB وآلاف الحلقات تُرسل للمتصفح. الآن: رؤوس المواسم فقط،
  // وحلقات موسم واحد (الذي فيه أول حلقة غير مشاهَدة)، والباقي عند الفتح.
  const airedBySeason = airedPerSeason(tv);
  const summaries: SeasonSummary[] = tv.seasons
    .filter((s) => s.season_number >= 1 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map((s) => ({
      season_number: s.season_number,
      name: s.name,
      episode_count: s.episode_count,
      aired_count: airedBySeason.get(s.season_number) ?? 0,
    }));

  // الموسم المفتوح افتراضياً: أول موسم فيه حلقة معروضة لم تُشاهد بعد
  let openSeason = summaries[0]?.season_number ?? null;
  for (const s of summaries) {
    let firstUnwatched = 0;
    for (let e = 1; e <= s.aired_count; e++) {
      if (!watched.has(episodeKey(s.season_number, e))) {
        firstUnwatched = e;
        break;
      }
    }
    if (firstUnwatched) {
      openSeason = s.season_number;
      break;
    }
  }

  const initialEpisodes =
    openSeason != null
      ? ((await getSeason(tvId, openSeason).catch(() => null))?.episodes ?? []).map((e) => ({
          episode_number: e.episode_number,
          name: e.name,
          air_date: e.air_date,
          runtime: e.runtime,
          still_path: e.still_path,
        }))
      : [];

  // نفس الرقم الذي تستخدمه الرئيسية والمكتبة، فلا تختلف النسبة بين الشاشات
  const airedExact = airedEpisodeCount(tv);

  const backdrop = backdropUrl(tv.backdrop_path);
  const poster = posterUrl(tv.poster_path, "w342");
  const next = tv.next_episode_to_air;

  return (
    <div>
      {following && (
        <ShowStatsSync
          stats={[
            {
              tmdbId: tvId,
              total: tv.number_of_episodes ?? airedExact,
              aired: airedExact,
              nextAirDate: next?.air_date ?? null,
            },
          ]}
        />
      )}

      {/* الترويسة مختصرة: القصة والترايلر والمنصّات والآراء في تبويبات،
          فلا يمرّ من يريد الحلقات على أربعة أقسام قبلها */}
      <div className="relative -mx-4 -mt-6 h-40 sm:h-64 mb-4">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority className="object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/40 to-transparent" />
      </div>

      <div className="flex gap-4 -mt-20 sm:-mt-24 relative px-1">
        <div className="w-24 sm:w-40 shrink-0">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-border bg-surface-2 shadow-xl">
            {poster && <Image src={poster} alt={tv.name} fill sizes="160px" className="object-cover" />}
          </div>
        </div>

        <div className="flex-1 min-w-0 self-end pb-1">
          <h1 className="text-lg sm:text-2xl font-bold leading-tight">{tv.name}</h1>
          <div className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-muted mt-1">
            {/* وسم الأنمي: يعرفه المستخدم من الشارة لا من قراءة الأنواع */}
            {isAnime(tv) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent bg-accent/12 border border-accent/35 px-2 py-0.5 rounded-full">
                <Icon name="sparkle-star" size={12} />
                {t.animeBadge}
              </span>
            )}
            {tv.first_air_date && <span>{tv.first_air_date.slice(0, 4)}</span>}
            <span>·</span>
            <span>{t.seasonsCount(tv.number_of_seasons)}</span>
            {tv.vote_average > 0 && (
              <>
                <span>·</span>
                <span className="text-accent">★ {tv.vote_average.toFixed(1)}</span>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FollowButton
              tmdbId={tvId}
              mediaType="tv"
              title={tv.name}
              posterPath={tv.poster_path}
              initialFollowing={following}
              locale={locale}
            />
            {next && next.air_date && (
              <span className="text-[11px] text-accent-2 bg-accent-2/10 border border-accent-2/30 px-2.5 py-1.5 rounded-lg">
                {t.nextEpisodeOn(formatDate(next.air_date, t))}
              </span>
            )}
          </div>
        </div>
      </div>

      <DetailTabs
        tabs={[
          {
            key: "episodes",
            label: t.tabEpisodes,
            icon: "list",
            content: (
              <div className="space-y-4">
                <EpisodeTracker
                  showTmdbId={tvId}
                  summaries={summaries}
                  initialSeason={openSeason}
                  initialEpisodes={initialEpisodes}
                  airedTotal={airedExact}
                  defaultRuntime={tv.episode_run_time?.[0] ?? null}
                  initialWatched={[...watched]}
                  locale={locale}
                />
                <RatingBox
                  tmdbId={tvId}
                  mediaType="tv"
                  title={tv.name}
                  posterPath={tv.poster_path}
                  locale={locale}
                  initialRating={myRating?.rating ?? null}
                  initialReview={myRating?.review ?? null}
                />
                <ListPicker
                  lists={myLists.map((l) => ({ id: l.id, name: l.name }))}
                  containing={inLists}
                  tmdbId={tvId}
                  mediaType="tv"
                  title={tv.name}
                  posterPath={tv.poster_path}
                  locale={locale}
                />
              </div>
            ),
          },
          {
            key: "info",
            label: t.tabInfo,
            icon: "info",
            content: (
              <div className="space-y-6">
                {tv.overview && (
                  <section>
                    <SectionTitle icon="info" className="mb-2">
                      {t.storyTitle}
                    </SectionTitle>
                    <p className="text-sm text-muted leading-relaxed">{tv.overview}</p>
                  </section>
                )}

                <p className="text-xs text-muted">{t.episodesCount(tv.number_of_episodes)}</p>

                {tv.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tv.genres.map((g) => (
                      <span
                        key={g.id}
                        className="text-xs bg-surface-2 border border-border px-2.5 py-1 rounded-full"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}

                {trailer && (
                  <Trailer
                    videoKey={trailer.key}
                    title={tv.name}
                    thumbnail={backdrop}
                    locale={locale}
                  />
                )}

                {watchWhere && (
                  <WhereToWatch
                    region={watchWhere.region}
                    options={watchWhere.options}
                    locale={locale}
                  />
                )}
              </div>
            ),
          },
          {
            key: "reviews",
            label: t.tabReviews,
            icon: "comment",
            content: (
              <CommunityReviews
                locale={locale}
                avg={community.avg}
                count={community.count}
                reviews={titleReviews}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
