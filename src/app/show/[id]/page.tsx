import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  getFollows,
  getWatchedForShow,
  getMyRating,
  getCommunityRating,
} from "@/lib/data";
import { getTv, getSeason, backdropUrl, posterUrl } from "@/lib/tmdb";
import { FollowButton } from "@/components/FollowButton";
import { EpisodeTracker, type SeasonSummary } from "@/components/EpisodeTracker";
import { getT } from "@/lib/locale";
import { RatingBox } from "@/components/RatingBox";
import { CommunityReviews } from "@/components/CommunityReviews";
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

  const tv = await getTv(tvId).catch(() => null);
  if (!tv) {
    return (
      <p className="text-center text-muted py-24">{t.showLoadFailed}</p>
    );
  }

  const [follows, watched, myRating, community] = await Promise.all([
    getFollows(),
    getWatchedForShow(tvId),
    getMyRating(tvId, "tv"),
    getCommunityRating(tvId, "tv"),
  ]);
  const following = follows.some((f) => f.tmdb_id === tvId && f.media_type === "tv");

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

      <div className="relative -mx-4 -mt-6 h-56 sm:h-72 mb-4">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority className="object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/40 to-transparent" />
      </div>

      <div className="flex flex-col sm:flex-row gap-6 -mt-24 relative px-1">
        <div className="w-32 sm:w-44 shrink-0 mx-auto sm:mx-0">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-border bg-surface-2 shadow-xl">
            {poster && <Image src={poster} alt={tv.name} fill className="object-cover" />}
          </div>
        </div>

        <div className="flex-1 pt-2">
          <h1 className="text-2xl sm:text-3xl font-bold">{tv.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted mt-2">
            {tv.first_air_date && <span>{tv.first_air_date.slice(0, 4)}</span>}
            <span>·</span>
            <span>{t.seasonsCount(tv.number_of_seasons)}</span>
            <span>·</span>
            <span>{t.episodesCount(tv.number_of_episodes)}</span>
            {tv.vote_average > 0 && (
              <>
                <span>·</span>
                <span className="text-accent">★ {tv.vote_average.toFixed(1)}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {tv.genres.map((g) => (
              <span key={g.id} className="text-xs bg-surface-2 border border-border px-2.5 py-1 rounded-full">
                {g.name}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted leading-relaxed mt-4 max-w-2xl">{tv.overview}</p>

          <div className="mt-5 flex items-center gap-3">
            <FollowButton
              tmdbId={tvId}
              mediaType="tv"
              title={tv.name}
              posterPath={tv.poster_path}
              initialFollowing={following}
              locale={locale}
            />
            {next && next.air_date && (
              <span className="text-xs text-accent-2 bg-accent-2/10 border border-accent-2/30 px-3 py-2 rounded-lg">
                {t.nextEpisodeOn(formatDate(next.air_date, t))}
              </span>
            )}
          </div>
        </div>
      </div>

      <RatingBox
        tmdbId={tvId}
        mediaType="tv"
        title={tv.name}
        posterPath={tv.poster_path}
        locale={locale}
        initialRating={myRating?.rating ?? null}
        initialReview={myRating?.review ?? null}
      />

      <CommunityReviews locale={locale} avg={community.avg} count={community.count} reviews={community.reviews} />

      <div className="mt-10">
        <h2 className="text-lg font-bold mb-4">{t.episodesHeading}</h2>
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
      </div>
    </div>
  );
}
