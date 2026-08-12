import Link from "next/link";
import { HeroRatings, HeroRatingsSkeleton } from "@/components/HeroRatings";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  getFollowState,
  getWatchedForShow,
  getEpisodeRatings,
  getMyRating,
  getCommunityRating,
  getTitleReviews,
  getTitleReplies,
  getMyLists,
  getListsContaining,
  getTitleCircle,
  getMyArtFor,
  getMyFavorites,
  artKey,
} from "@/lib/data";
import {
  getTv,
  getTrailer,
  getWatchProviders,
  isAnime,
  backdropUrl,
  posterUrl,
} from "@/lib/tmdb";
import { animeExtras } from "@/lib/anilist";
import { displayWorkTitle } from "@/lib/wikidata";
import { EpisodeTracker, type SeasonSummary } from "@/components/EpisodeTracker";
import { getT, getWatchRegion } from "@/lib/locale";
import { RatingBox } from "@/components/RatingBox";
import { CommunityReviews } from "@/components/CommunityReviews";
import { DetailTabs } from "@/components/DetailTabs";
import { TitleRoomTab } from "@/components/TitleRoomTab";
import { RelatedTitles } from "@/components/RelatedTitles";
import { CastRail } from "@/components/CastRail";
import { Icon, SectionTitle } from "@/components/Icon";
import { Trailer } from "@/components/Trailer";
import { WatchChip } from "@/components/WatchChip";
import { TitleActions } from "@/components/TitleActions";
import { DetailTopBar } from "@/components/DetailTopBar";
import { CircleNote } from "@/components/CircleNote";
import { ReadMore } from "@/components/ReadMore";
import { formatDate } from "@/lib/when";
import { ShowStatsSync } from "@/components/ShowStatsSync";
import { airedEpisodeCount, airedPerSeason } from "@/lib/progress";
import { episodeKey } from "@/lib/keys";
import { buttonClass } from "@/components/ui/Button";

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { id } = await params;
  const tvId = Number(id);
  if (!Number.isFinite(tvId)) notFound();

  // بيانات أول رسمة فقط في الموجة الحاسمة — الترايلر والتعليقات تُبثّ
  // لاحقاً عبر Suspense فلا تؤخّر ترويسة الصفحة وتبويب الحلقات
  const userRegion = await getWatchRegion();
  const [tv, followState, watched, watchWhere, myLists, inLists, circle, epRatings, myArt, favs] =
    await Promise.all([
    getTv(tvId).catch(() => null),
    getFollowState(tvId, "tv"),
    getWatchedForShow(tvId),
    getWatchProviders("tv", tvId),
    getMyLists(),
    getListsContaining(tvId, "tv"),
    /* نشاط دائرتك (D-127) — نداء definer واحد داخل الموجة نفسها لا خلف
       Suspense: كلفتُه استعلامٌ محليّ (~50ms من الرياض) والصفحة تنتظر
       TMDB على كل حال، فحاجزُ تعليقٍ ثانٍ يشتري وميضاً لا سرعة */
    getTitleCircle(tvId, "tv"),
    /* تقييماتي للحلقات (D-139) — في الموجة نفسها لا خلف حاجز: نداء
       definer واحد على فهرسٍ يخدمه المفتاح الأوّليّ، والصفحة تنتظر TMDB
       على كل حال */
    getEpisodeRatings(tvId),
    /* غلافي المختار لهذا العمل (D-131) — قراءةٌ من خريطةٍ مخبّأة لكل طلب */
    getMyArtFor(tvId, "tv"),
    /* مفضّلاتي (D-130) — نداءٌ واحد مخبّأ للطلب، لا سؤالٌ لكل عمل */
    getMyFavorites(),
  ]);
  const following = followState.following;

  if (!tv) {
    return (
      <div className="text-center py-24">
        <p className="text-muted mb-4">{t.showLoadFailed}</p>
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/"
            className={buttonClass({ size: "sm" })}
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

  /* العنوان بالعربية إن لم تترجمه TMDB (D-176) — ويكي‑بيانات، بنفس شرطَي
     `displayPersonName`: واجهةٌ عربية وعنوانٌ ليس عربياً أصلاً، فصفرُ طلباتٍ
     في الحالة الغالبة. وبعد حارس `!tv` لا قبله: لا يُسأل عن عملٍ لم يُجلب.
     والفشل صامتٌ فيبقى عنوان TMDB. */
  const title = await displayWorkTitle(tvId, "tv", tv.name, locale);

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

  // لا انتظار لحلقات الموسم هنا: كانت رحلة TMDB تسلسلية ثانية تؤخّر أول
  // بايت من أسخن صفحة (~150–400ms عند فوات الكاش). المتتبّع يحمّلها بنفسه
  // عبر /api/season ويعرض هيكلاً في أثنائها — الترويسة والتبويبات ترسم فوراً

  // نفس الرقم الذي تستخدمه الرئيسية والمكتبة، فلا تختلف النسبة بين الشاشات
  const airedExact = airedEpisodeCount(tv);

  /* غلافي المختار (D-131) يسبق غلاف TMDB — **في صفحتي أنا وحدها**
     (ق٨). النقطة واحدة هنا فلا تتفرّق على البطاقات. */
  const backdrop = backdropUrl(myArt?.backdrop_path ?? tv.backdrop_path);
  const poster = posterUrl(myArt?.poster_path ?? tv.poster_path, "w342");
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
        <DetailTopBar
          title={title}
          locale={locale}
          tmdbId={tvId}
          mediaType="tv"
          posterPath={tv.poster_path}
          initialDropped={followState.dropped}
          art={myArt}
        />
      </div>

      <div className="flex gap-4 -mt-24 sm:-mt-28 relative px-1">
        <div className="w-28 sm:w-40 shrink-0">
          <div className="relative aspect-[2/3] rounded-poster overflow-hidden ring-1 ring-white/10 bg-surface-2 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
            {poster && <Image src={poster} alt={title} fill sizes="160px" className="object-cover" />}
          </div>
        </div>

        {/* العنوان من قمّة الملصق لا من قاعه — نفس نقلة صفحة الفيلم
            (طلب المالك)، والأنواع صعدت إلى المساحة تحته */}
        <div className="flex-1 min-w-0 self-start pt-0.5">
          <h1 className="text-xl sm:text-3xl font-extrabold leading-tight tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
            {title}
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
          </div>

          {/* المصدر والاستوديو من AniList (D-173) — لِما ثبت أنه أنمي وحده،
              وخلف Suspense خاصّته: السلسلة نداءان إلى خدمتين لا نملكهما،
              فلا تُرهن بهما ترويسةُ الصفحة (D-071). وغيابُهما لا يترك فراغاً
              محجوزاً — السطر إمّا يُرسم كاملاً أو لا يوجد أصلاً. */}
          {isAnime(tv) && (
            <Suspense fallback={null}>
              <AnimeFacts tmdbId={tvId} t={t} />
            </Suspense>
          )}

          {/* التقييم سطرٌ مستقلّ تحت البيانات، بشعارَي IMDb وطماطم لا
              بأسمائهما، ومن هذين المصدرين فقط — لا نجمة TMDB (قرار أحمد
              ٨ أغسطس، يُتمّ نقض D-027) */}
          <Suspense fallback={<HeroRatingsSkeleton />}>
            <HeroRatings tvId={tvId} />
          </Suspense>

          {/* «٣ ممن تتابعهم شاهدوه» (D-127) — تحت تقييم العالم مباشرة:
              الرأي العام أولاً ثم رأي من تثق بهم. ولا يُرسم شيء تحت
              الثلاثة — الكتم في SQL لا هنا */}
          <CircleNote circle={circle} locale={locale} />

          {/* الأنواع صعدت من «معلومات» إلى جنب الملصق — كصفحة الفيلم */}
          {tv.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tv.genres.slice(0, 4).map((g) => (
                <span
                  key={g.id}
                  className="text-[11px] font-medium bg-surface-2 border border-border px-2.5 py-1 rounded-full"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {(next?.air_date || watchWhere) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {next && next.air_date && (
                <span className="inline-block text-[11px] text-accent-2 bg-accent-2/10 border border-accent-2/30 px-2.5 py-1 rounded-lg">
                  {t.nextEpisodeOn(formatDate(next.air_date, t))}
                </span>
              )}
              {/* أين يُبثّ — هنا في الترويسة، وقسم المنصّات في «معلومات» حُذف */}
              {watchWhere && <WatchChip
                options={watchWhere.options}
                region={watchWhere.region}
                userRegion={userRegion}
                locale={locale}
              />}
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
          initialFavorite={favs.has(artKey("tv", tvId))}
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
                airedTotal={airedExact}
                defaultRuntime={tv.episode_run_time?.[0] ?? null}
                initialWatched={[...watched]}
                initialEpisodeRatings={[...epRatings.values()]}
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
                {/* **«أين أشاهده» حُذف من هنا كاملاً** (D-190، طلب أحمد).
                    الشارةُ في الترويسة صارت الجوابَ الوحيد: رموزُ منصّات
                    الطبقة الأولى بلا أسماء، والضغطُ يفتح JustWatch بكلّ
                    التفاصيل. **وثلاثةُ صفوفٍ تقول اشتراك/تأجير/شراء كانت
                    تجيب سؤالاً لم يُسأل** — من يفتح صفحة عملٍ يريد أن يعرف
                    «أقدر أشاهده؟» لا جدولَ أسعارٍ لا نملكه أصلاً (D-150). */}
                {tv.overview && (
                  <section>
                    <SectionTitle icon="info" className="mb-2.5">
                      {t.storyTitle}
                    </SectionTitle>
                    <ReadMore text={tv.overview} locale={locale} />
                  </section>
                )}

                {/* الأنواع صعدت إلى الترويسة جنب الملصق — بقي عدّ الحلقات */}
                {tv.number_of_episodes > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted bg-surface-2 border border-border px-3 py-1.5 rounded-full tabular-nums">
                      {t.episodesCount(tv.number_of_episodes)}
                    </span>
                  </div>
                )}

                <Suspense
                  fallback={<div className="skeleton aspect-video rounded-2xl" aria-hidden />}
                >
                  <TrailerSection tvId={tvId} name={title} backdrop={backdrop} locale={locale} />
                </Suspense>
              </div>
            ),
          },
          {
            /* **تبويبُ المجتمع — الغرفةُ نفسها لا رابطٌ إليها** (D-191،
               طلب أحمد: «تبويب اسمه كوميونيتي مربوط بغرفة الكوميونيتي
               الخاصة فيه»). وموضعُه **ثالثاً** كما طلب: الحديثُ عن العمل
               أقربُ إلى العمل من «مشابه»، وغرفُ الأعمال (D-140) كانت أثمنَ
               ما في المجتمع وأخفاه — سطراً في تبويبٍ رابع.
               والسطرُ القديم (`TitleRoomLink`) حُذف من «التعليقات» مع
               النقل: **لا بابان لغرفةٍ واحدة.** */
            key: "community",
            label: t.tabCommunity,
            icon: "people",
            content: (
              <Suspense
                fallback={<div className="skeleton h-64 rounded-2xl" aria-hidden />}
              >
                <TitleRoomTab tmdbId={tvId} mediaType="tv" locale={locale} />
              </Suspense>
            ),
          },
          {
            key: "cast",
            label: t.tabCast,
            icon: "people",
            /* الطاقم تبويبٌ مستقلّ كصفحة الفيلم تماماً — الجلسة السابقة
               بنته للأفلام وحدها فبقي المسلسل داخل «معلومات» (تنبيه أحمد):
               تبويبٌ واحد بمعنى واحد في الصفحتين */
            content: (
              <Suspense fallback={null}>
                <CastRail mediaType="tv" tmdbId={tvId} locale={locale} />
              </Suspense>
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

      {/* الأعمال المرتبطة خارج التبويبات — كصفحة الفيلم. ولا «أجزاء»
          للمسلسلات: `belongs_to_collection` حقلُ أفلامٍ عند TMDB وحدها */}
      <Suspense fallback={null}>
        <RelatedTitles mediaType="tv" tmdbId={tvId} locale={locale} />
      </Suspense>
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
  const [myRating, community, titleReviews, titleReplies] = await Promise.all([
    getMyRating(tvId, "tv"),
    getCommunityRating(tvId, "tv"),
    getTitleReviews(tvId, "tv"),
    /* الردودُ مع الآراء في نفس الدفعة (D-193): نداءٌ ثانٍ متسلسلٌ كان
       يضيف رحلةً كاملة إلى تبويبٍ يُبثّ أصلاً */
    getTitleReplies(tvId, "tv"),
  ]);
  return (
    <div className="space-y-4">
      {/* غرفة النقاش قبل التقييم: التقييم رأيٌ تكتبه وحدك، والغرفة حديثٌ
          مع غيرك — ومن فتح تبويب التعليقات جاء للناس أوّلاً (D-140) */}
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
        replies={titleReplies}
      />
    </div>
  );
}

/**
 * سطرُ «عن مانغا · استوديو MAPPA» — أو لا شيء (D-173).
 *
 * مكوّن خادمٍ صغير لأن `animeExtras` تنادي خدمتين خارجيتين، ووضعُه خلف
 * `Suspense` يُخرجهما من المسار الحرج للترويسة.
 */
async function AnimeFacts({
  tmdbId,
  t,
}: {
  tmdbId: number;
  t: Awaited<ReturnType<typeof getT>>["t"];
}) {
  const extras = await animeExtras(tmdbId, "tv");
  if (!extras) return null;
  const parts = [
    extras.source ? t.animeSourceLabel(extras.source) : "",
    extras.studio ? t.animeStudioLabel(extras.studio) : "",
  ].filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted mt-1">
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          <span>{p}</span>
        </span>
      ))}
    </div>
  );
}
