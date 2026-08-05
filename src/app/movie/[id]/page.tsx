import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  isFollowing,
  isMovieWatched,
  getMyRating,
  getCommunityRating,
  getTitleReviews,
  getMyLists,
  getListsContaining,
} from "@/lib/data";
import { getMovie, getTrailer, getWatchProviders, backdropUrl, posterUrl } from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { RatingBox } from "@/components/RatingBox";
import { CommunityReviews } from "@/components/CommunityReviews";
import { DetailTabs } from "@/components/DetailTabs";
import { SectionTitle } from "@/components/Icon";
import { Trailer } from "@/components/Trailer";
import { WatchChip } from "@/components/WatchChip";
import { TitleActions } from "@/components/TitleActions";
import { DetailTopBar } from "@/components/DetailTopBar";
import { ReadMore } from "@/components/ReadMore";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isFinite(movieId)) notFound();

  // بيانات TMDB وبيانات المستخدم تُطلب معاً: لا شيء منها يعتمد على الآخر،
  // وانتظار الأولى قبل الثانية كان يضيف رحلة كاملة إلى الخادم
  const [movie, following, watched, myRating, community, titleReviews, trailer, watchWhere, myLists, inLists] =
    await Promise.all([
      getMovie(movieId).catch(() => null),
      isFollowing(movieId, "movie"),
      isMovieWatched(movieId),
      getMyRating(movieId, "movie"),
      getCommunityRating(movieId, "movie"),
      getTitleReviews(movieId, "movie"),
      getTrailer("movie", movieId),
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

  const backdrop = backdropUrl(movie.backdrop_path);
  const poster = posterUrl(movie.poster_path, "w342");

  return (
    <div>
      {/* الترويسة: الملصق والعنوان والأزرار فقط — القصة والترايلر والآراء
          انتقلت إلى تبويبات، فالصفحة تبدأ من شاشة واحدة لا من عمود طويل */}
      <div className="relative -mx-4 -mt-6 h-44 sm:h-72 mb-4">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority className="object-cover opacity-45" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/35 to-transparent" />
        <DetailTopBar title={movie.title} locale={locale} />
      </div>

      <div className="flex gap-4 -mt-24 sm:-mt-28 relative px-1">
        <div className="w-28 sm:w-40 shrink-0">
          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden ring-1 ring-white/10 bg-surface-2 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
            {poster && <Image src={poster} alt={movie.title} fill sizes="160px" className="object-cover" />}
          </div>
        </div>

        <div className="flex-1 min-w-0 self-end pb-1">
          <h1 className="text-xl sm:text-3xl font-extrabold leading-tight tracking-tight">
            {movie.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted mt-1.5">
            {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
            {movie.runtime ? (
              <>
                <span aria-hidden>·</span>
                <span>{t.minutesCount(movie.runtime)}</span>
              </>
            ) : null}
            {movie.vote_average > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="text-accent font-semibold tabular-nums">
                  ★ {movie.vote_average.toFixed(1)}
                </span>
              </>
            )}
          </div>

          {/* أين يُبثّ — في الترويسة، وقسم المنصّات في «معلومات» حُذف */}
          {watchWhere && (
            <div className="mt-2.5">
              <WatchChip options={watchWhere.options} />
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
          initialFollowing={following}
          lists={myLists.map((l) => ({ id: l.id, name: l.name }))}
          containing={inLists}
          episodesTotal={null}
          runtime={movie.runtime ?? null}
          initialDone={watched}
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

                {movie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {movie.genres.map((g) => (
                      <span
                        key={g.id}
                        className="text-xs font-medium bg-white/[0.06] border border-white/10 px-3 py-1.5 rounded-full"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}

                {trailer && (
                  <Trailer
                    videoKey={trailer.key}
                    title={movie.title}
                    thumbnail={backdrop}
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
              <div className="space-y-4">
                <RatingBox
                  variant="review"
                  tmdbId={movieId}
                  mediaType="movie"
                  title={movie.title}
                  posterPath={movie.poster_path}
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
            ),
          },
        ]}
      />
    </div>
  );
}
