import Link from "next/link";
import { Suspense } from "react";
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
import { EpisodeTracker, type SeasonSummary } from "@/components/EpisodeTracker";
import { getT } from "@/lib/locale";
import { RatingBox } from "@/components/RatingBox";
import { CommunityReviews } from "@/components/CommunityReviews";
import { DetailTabs } from "@/components/DetailTabs";
import { Icon, SectionTitle } from "@/components/Icon";
import { Trailer } from "@/components/Trailer";
import { WatchChip } from "@/components/WatchChip";
import { TitleActions } from "@/components/TitleActions";
import { DetailTopBar } from "@/components/DetailTopBar";
import { ReadMore } from "@/components/ReadMore";
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

  // بيانات أول رسمة فقط في الموجة الحاسمة — الترايلر والتعليقات تُبثّ
  // لاحقاً عبر Suspense فلا تؤخّر ترويسة الصفحة وتبويب الحلقات
  const [tv, following, watched, watchWhere, myLists, inLists] = await Promise.all([
    getTv(tvId).catch(() => null),
    isFollowing(tvId, "tv"),
    getWatchedForShow(tvId),
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
      <div className="relative -mx-4 -mt-6 h-44 sm:h-72 mb-4">
        {backdrop && (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 1152px"
            className="object-cover opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/35 to-transparent" />
        <DetailTopBar title={tv.name} locale={locale} />
      </div>

      <div className="flex gap-4 -mt-24 sm:-mt-28 relative px-1">
        <div className="w-28 sm:w-40 shrink-0">
          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden ring-1 ring-white/10 bg-surface-2 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
            {poster && <Image src={poster} alt={tv.name} fill sizes="160px" className="object-cover" />}
          </div>
        </div>

        <div className="flex-1 min-w-0 self-end pb-1">
          <h1 className="text-xl sm:text-3xl font-extrabold leading-tight tracking-tight">
            {tv.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted mt-1.5">
            {/* وسم الأنمي: يعرفه المستخدم من الشارة لا من قراءة الأنواع */}
            {isAnime(tv) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent bg-accent/12 border border-accent/35 px-2 py-0.5 rounded-full">
                <Icon name="sparkle-star" size={12} />
                {t.animeBadge}
              </span>
            )}
            {tv.first_air_date && <span>{tv.first_air_date.slice(0, 4)}</span>}
            <span aria-hidden>·</span>
            <span>{t.seasonsCount(tv.number_of_seasons)}</span>
            {tv.vote_average > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="text-accent font-semibold tabular-nums">
                  ★ {tv.vote_average.toFixed(1)}
                </span>
              </>
            )}
          </div>

          {(next?.air_date || watchWhere) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {next && next.air_date && (
                <span className="inline-block text-[11px] text-accent-2 bg-accent-2/10 border border-accent-2/30 px-2.5 py-1 rounded-lg">
                  {t.nextEpisodeOn(formatDate(next.air_date, t))}
                </span>
              )}
              {/* أين يُبثّ — هنا في الترويسة، وقسم المنصّات في «معلومات» حُذف */}
              {watchWhere && <WatchChip options={watchWhere.options} />}
            </div>
          )}
        </div>
      </div>

      {/* الإجراء الرئيسي: أضف لقائمة + دائرة «شاهدتُه كله» — زرّ المتابعة
          الكبير حُذف، فالمتابعة صارت أول صفٍّ داخل ورقة القوائم */}
      <div className="mt-5 px-1">
        <TitleActions
          tmdbId={tvId}
          mediaType="tv"
          title={tv.name}
          posterPath={tv.poster_path}
          locale={locale}
          initialFollowing={following}
          lists={myLists.map((l) => ({ id: l.id, name: l.name }))}
          containing={inLists}
          episodesTotal={airedExact}
          runtime={null}
          initialDone={airedExact > 0 && watched.size >= airedExact}
        />
      </div>

      <DetailTabs
        tabs={[
          {
            key: "episodes",
            label: t.tabEpisodes,
            icon: "list",
            content: (
              /* التقييم صار في تبويب التعليقات والقوائم في زرّ الترويسة —
                 لا شيء يتكرّر مرتين. المتتبّع يعتمد لقطة الخادم داخلياً
                 بلا key: إعادة التركيب كانت تُغلق الموسم المفتوح. */
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
            ),
          },
          {
            key: "info",
            label: t.tabInfo,
            icon: "info",
            content: (
              <div className="space-y-7">
                {tv.overview && (
                  <section>
                    <SectionTitle icon="info" className="mb-2.5">
                      {t.storyTitle}
                    </SectionTitle>
                    <ReadMore text={tv.overview} locale={locale} />
                  </section>
                )}

                {(tv.genres.length > 0 || tv.number_of_episodes > 0) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {tv.number_of_episodes > 0 && (
                      <span className="text-xs font-medium text-muted bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-full tabular-nums">
                        {t.episodesCount(tv.number_of_episodes)}
                      </span>
                    )}
                    {tv.genres.map((g) => (
                      <span
                        key={g.id}
                        className="text-xs font-medium bg-white/[0.06] border border-white/10 px-3 py-1.5 rounded-full"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}

                <Suspense
                  fallback={<div className="skeleton aspect-video rounded-2xl" aria-hidden />}
                >
                  <TrailerSection tvId={tvId} name={tv.name} backdrop={backdrop} locale={locale} />
                </Suspense>
              </div>
            ),
          },
          {
            key: "reviews",
            label: t.tabReviews,
            icon: "comment",
            content: (
              <Suspense
                fallback={
                  <div className="space-y-4" aria-hidden>
                    <div className="skeleton h-44 rounded-2xl" />
                    <div className="skeleton h-24 rounded-2xl" />
                  </div>
                }
              >
                <ReviewsTab
                  tvId={tvId}
                  name={tv.name}
                  posterPath={tv.poster_path}
                  locale={locale}
                />
              </Suspense>
            ),
          },
        ]}
      />
    </div>
  );
}

/** الترايلر يُبثّ بعد أول رسمة — طلبا TMDB المتسلسلان له لا يؤخّران الصفحة */
async function TrailerSection({
  tvId,
  name,
  backdrop,
  locale,
}: {
  tvId: number;
  name: string;
  backdrop: string | null;
  locale: Awaited<ReturnType<typeof getT>>["locale"];
}) {
  const trailer = await getTrailer("tv", tvId);
  if (!trailer) return null;
  return <Trailer videoKey={trailer.key} title={name} thumbnail={backdrop} locale={locale} />;
}

/** تبويب التعليقات: تقييمي وتقييم المجتمع والمراجعات — كلها تُبثّ لاحقاً */
async function ReviewsTab({
  tvId,
  name,
  posterPath,
  locale,
}: {
  tvId: number;
  name: string;
  posterPath: string | null;
  locale: Awaited<ReturnType<typeof getT>>["locale"];
}) {
  const [myRating, community, titleReviews] = await Promise.all([
    getMyRating(tvId, "tv"),
    getCommunityRating(tvId, "tv"),
    getTitleReviews(tvId, "tv"),
  ]);
  return (
    <div className="space-y-4">
      <RatingBox
        variant="review"
        tmdbId={tvId}
        mediaType="tv"
        title={name}
        posterPath={posterPath}
        locale={locale}
        initialRating={myRating?.rating ?? null}
        initialReview={myRating?.review ?? null}
      />
      <CommunityReviews
        tmdbId={tvId}
        mediaType="tv"
        locale={locale}
        avg={community.avg}
        count={community.count}
        reviews={titleReviews}
      />
    </div>
  );
}
