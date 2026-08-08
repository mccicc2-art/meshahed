import Link from "next/link";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  getFollowState,
  isMovieWatched,
  getMyRating,
  getCommunityRating,
  getTitleReviews,
  getMyLists,
  getListsContaining,
  getPublicListsContaining,
} from "@/lib/data";
import { getMovie, getTrailer, getWatchProviders, backdropUrl, posterUrl } from "@/lib/tmdb";
import { universeOf } from "@/lib/universes";
import { getT, getWatchRegion } from "@/lib/locale";
import { type Locale } from "@/lib/i18n";
import { AddWorksToList } from "@/components/AddWorksToList";
import { PublicListsRail } from "@/components/PublicListsRail";
import { HeroRatings, TmdbStar } from "@/components/HeroRatings";
import { RatingBox } from "@/components/RatingBox";
import { CommunityReviews } from "@/components/CommunityReviews";
import { DetailTabs } from "@/components/DetailTabs";
import { RelatedTitles } from "@/components/RelatedTitles";
import { CastRail } from "@/components/CastRail";
import { SectionTitle } from "@/components/Icon";
import { Trailer } from "@/components/Trailer";
import { WatchChip } from "@/components/WatchChip";
import { TitleActions } from "@/components/TitleActions";
import { DetailTopBar } from "@/components/DetailTopBar";
import { ReadMore } from "@/components/ReadMore";
import { buttonClass } from "@/components/ui/Button";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isFinite(movieId)) notFound();

  // بيانات TMDB وبيانات المستخدم تُطلب معاً: لا شيء منها يعتمد على الآخر،
  // وانتظار الأولى قبل الثانية كان يضيف رحلة كاملة إلى الخادم
  // بيانات أول رسمة فقط — الترايلر والتعليقات تُبثّ لاحقاً عبر Suspense
  const userRegion = await getWatchRegion();
  const [movie, followState, watched, watchWhere, myLists, inLists] = await Promise.all([
    getMovie(movieId).catch(() => null),
    getFollowState(movieId, "movie"),
    isMovieWatched(movieId),
    getWatchProviders("movie", movieId),
    getMyLists(),
    getListsContaining(movieId, "movie"),
  ]);

  if (!movie) {
    return (
      <div className="text-center py-24">
        <p className="text-muted mb-4">{t.movieLoadFailed}</p>
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

  const backdrop = backdropUrl(movie.backdrop_path);
  const poster = posterUrl(movie.poster_path, "w342");
  /* العالم فحصٌ محليّ في القاموس — زرّه صعد إلى الترويسة (طلب المالك) */
  const universe = universeOf(movieId);

  return (
    <div>
      {/* الترويسة: الملصق والعنوان والأزرار فقط — القصة والترايلر والآراء
          انتقلت إلى تبويبات، فالصفحة تبدأ من شاشة واحدة لا من عمود طويل */}
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
          title={movie.title}
          locale={locale}
          tmdbId={movieId}
          mediaType="movie"
          posterPath={movie.poster_path}
          initialDropped={followState.dropped}
        />
      </div>

      <div className="flex gap-4 -mt-24 sm:-mt-28 relative px-1">
        <div className="w-32 sm:w-44 shrink-0">
          <div className="relative aspect-[2/3] rounded-poster overflow-hidden ring-1 ring-white/10 bg-surface-2 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
            {poster && <Image src={poster} alt={movie.title} fill sizes="176px" className="object-cover" />}
          </div>
        </div>

        {/* ===== عمود البيانات — من قمّة الملصق لا من قاعه (طلب المالك) =====
            كان `self-end` يلصق العنوان بأسفل الملصق ويترك المساحة جنبه
            فارغة. الآن العنوان يوازي بداية الملصق، والمساحة تحته تحمل
            البيانات كلّها: السنة والمدّة والتقييم، فالأنواع، فالمنصّة،
            فأزرار السلسلة والعالم — التي كانت تسكن ذيل الصفحة. */}
        <div className="flex-1 min-w-0 self-start pt-0.5">
          <h1 className="text-xl sm:text-3xl font-extrabold leading-tight tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
            {movie.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted mt-1">
            {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
            {movie.runtime ? (
              <>
                <span aria-hidden>·</span>
                <span>{t.minutesCount(movie.runtime)}</span>
              </>
            ) : null}
            {/* IMDb وطماطم بدل نجمة TMDB (طلب أحمد — ينقض D-027)؛
                النجمة القديمة هيكلُ الانتظار واحتياطُ غياب المفتاح */}
            <Suspense fallback={<TmdbStar vote={movie.vote_average} />}>
              <HeroRatings imdbId={movie.imdb_id} tmdbVote={movie.vote_average} />
            </Suspense>
          </div>

          {/* الأنواع صعدت من تبويب «معلومات» إلى جنب الملصق (طلب المالك):
              هوية الفيلم تُقرأ قبل قصّته لا بعدها */}
          {movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {movie.genres.slice(0, 3).map((g) => (
                <span
                  key={g.id}
                  className="text-[11px] font-medium bg-surface-2 border border-border px-2.5 py-1 rounded-full"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* أين يُبثّ — في الترويسة، وقسم المنصّات في «معلومات» حُذف */}
          {watchWhere && (
            <div className="mt-2">
              <WatchChip
                options={watchWhere.options}
                region={watchWhere.region}
                userRegion={userRegion}
                locale={locale}
              />
            </div>
          )}

          {/* زرّا السلسلة والعالم (D-052/D-074) — هنا لا في ذيل الصفحة
              (طلب المالك): المساحة جنب الملصق هي بيت «الإضافات»، والصفّان
              في الأسفل بقيا للتصفّح بلا أزرارٍ مكرّرة (بابٌ واحد لكل فعل) */}
          {(movie.belongs_to_collection || universe) && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {movie.belongs_to_collection && (
                <AddWorksToList
                  source="collection"
                  id={movie.belongs_to_collection.id}
                  locale={locale}
                />
              )}
              {universe && (
                <AddWorksToList source="universe" id={universe.slug} locale={locale} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* الإجراء الرئيسي: أضف لقائمة + دائرة «شاهدتُه» — نفس لغة صفحة المسلسل */}
      <div className="mt-5 px-1">
        <TitleActions
          tmdbId={movieId}
          mediaType="movie"
          title={movie.title}
          posterPath={movie.poster_path}
          locale={locale}
          initialFollowing={followState.following}
          lists={myLists.map((l) => ({ id: l.id, name: l.name }))}
          containing={inLists}
          episodesTotal={null}
          runtime={movie.runtime ?? null}
          initialDone={watched}
          collectionId={movie.belongs_to_collection?.id ?? null}
        />
      </div>

      {/* تبويب «تتبّع» حُذف من الأفلام: الفيلم إمّا شوهد أو لم يُشاهَد،
          ودائرة ✓ في الترويسة تقول ذلك وتقلبه — لا يحتاج تبويباً كاملاً */}
      <DetailTabs
        tabs={[
          {
            key: "info",
            label: t.tabInfo,
            icon: "info",
            content: (
              <div className="space-y-7">
                {movie.overview && (
                  <section>
                    <SectionTitle icon="info" className="mb-2.5">
                      {t.storyTitle}
                    </SectionTitle>
                    <ReadMore text={movie.overview} locale={locale} />
                  </section>
                )}

                {/* الأنواع صعدت إلى الترويسة جنب الملصق — لا نسخة ثانية هنا */}

                <Suspense
                  fallback={<div className="skeleton aspect-video rounded-2xl" aria-hidden />}
                >
                  <MovieTrailerSection
                    movieId={movieId}
                    title={movie.title}
                    backdrop={backdrop}
                    locale={locale}
                  />
                </Suspense>
              </div>
            ),
          },
          {
            key: "cast",
            label: t.tabCast,
            icon: "people",
            /* الطاقم صار تبويبه (طلب أحمد بعد أن طالت «معلومات») — كان
               داخلها منذ D-080؛ المحتوى نفسه، بابه وحده تغيّر */
            content: (
              <Suspense fallback={null}>
                <CastRail mediaType="movie" tmdbId={movieId} locale={locale} />
              </Suspense>
            ),
          },
          {
            key: "similar",
            label: t.tabSimilar,
            icon: "grid",
            content: (
              <div className="space-y-7">
                <Suspense fallback={null}>
                  <RelatedTitles
                    mediaType="movie"
                    tmdbId={movieId}
                    collectionId={movie.belongs_to_collection?.id ?? null}
                    locale={locale}
                  />
                </Suspense>
                {/* القوائم التي تضمّ هذا الفيلم — طريقُ «أعجبك؟ خذ عشرته» */}
                <Suspense fallback={null}>
                  <ListsWithMovie movieId={movieId} locale={locale} />
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
                <MovieReviewsTab
                  movieId={movieId}
                  title={movie.title}
                  posterPath={movie.poster_path}
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

/** القوائم العامة التي تضمّ هذا الفيلم — داخل تبويب «مشابه» */
async function ListsWithMovie({ movieId, locale }: { movieId: number; locale: Locale }) {
  const lists = await getPublicListsContaining(movieId, "movie", 10);
  if (!lists.length) return null;
  return <PublicListsRail lists={lists} locale={locale} />;
}

/** الترايلر يُبثّ بعد أول رسمة */
async function MovieTrailerSection({
  movieId,
  title,
  backdrop,
  locale,
}: {
  movieId: number;
  title: string;
  backdrop: string | null;
  locale: Awaited<ReturnType<typeof getT>>["locale"];
}) {
  const trailer = await getTrailer("movie", movieId);
  if (!trailer) return null;
  return <Trailer videoKey={trailer.key} title={title} thumbnail={backdrop} locale={locale} />;
}

/** تبويب التعليقات يُبثّ لاحقاً — لا يؤخّر الترويسة */
async function MovieReviewsTab({
  movieId,
  title,
  posterPath,
  locale,
}: {
  movieId: number;
  title: string;
  posterPath: string | null;
  locale: Awaited<ReturnType<typeof getT>>["locale"];
}) {
  const [myRating, community, titleReviews] = await Promise.all([
    getMyRating(movieId, "movie"),
    getCommunityRating(movieId, "movie"),
    getTitleReviews(movieId, "movie"),
  ]);
  return (
    <div className="space-y-4">
      <RatingBox
        variant="review"
        tmdbId={movieId}
        mediaType="movie"
        title={title}
        posterPath={posterPath}
        locale={locale}
        initialRating={myRating?.rating ?? null}
        initialReview={myRating?.review ?? null}
      />
      <CommunityReviews
        tmdbId={movieId}
        mediaType="movie"
        locale={locale}
        avg={community.avg}
        count={community.count}
        reviews={titleReviews}
      />
    </div>
  );
}
