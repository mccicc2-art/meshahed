import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  getFollows,
  getWatchedMovieIds,
  getMovieProgress,
  getMyRating,
  getCommunityRating,
  getTitleReviews,
  getMyLists,
  getListsContaining,
} from "@/lib/data";
import { MovieProgress } from "@/components/MovieProgress";
import { getMovie, getTrailer, getWatchProviders, backdropUrl, posterUrl } from "@/lib/tmdb";
import { FollowButton } from "@/components/FollowButton";
import { MovieWatchedButton } from "@/components/MovieWatchedButton";
import { getT } from "@/lib/locale";
import { RatingBox } from "@/components/RatingBox";
import { CommunityReviews } from "@/components/CommunityReviews";
import { DetailTabs } from "@/components/DetailTabs";
import { SectionTitle } from "@/components/Icon";
import { Trailer } from "@/components/Trailer";
import { WhereToWatch } from "@/components/WhereToWatch";
import { ListPicker } from "@/components/ListPicker";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isFinite(movieId)) notFound();

  const movie = await getMovie(movieId).catch(() => null);
  if (!movie) {
    return (
      <p className="text-center text-muted py-24">{t.movieLoadFailed}</p>
    );
  }

  const [
    follows,
    watchedIds,
    mProgress,
    myRating,
    community,
    titleReviews,
    trailer,
    watchWhere,
    myLists,
    inLists,
  ] = await Promise.all([
      getFollows(),
      getWatchedMovieIds(),
      getMovieProgress(movieId),
      getMyRating(movieId, "movie"),
      getCommunityRating(movieId, "movie"),
      getTitleReviews(movieId, "movie"),
      getTrailer("movie", movieId),
      getWatchProviders("movie", movieId),
      getMyLists(),
      getListsContaining(movieId, "movie"),
    ]);
  const following = follows.some((f) => f.tmdb_id === movieId && f.media_type === "movie");
  const watched = watchedIds.has(movieId);

  const backdrop = backdropUrl(movie.backdrop_path);
  const poster = posterUrl(movie.poster_path, "w342");

  return (
    <div>
      {/* الترويسة: الملصق والعنوان والأزرار فقط — القصة والترايلر والآراء
          انتقلت إلى تبويبات، فالصفحة تبدأ من شاشة واحدة لا من عمود طويل */}
      <div className="relative -mx-4 -mt-6 h-40 sm:h-64 mb-4">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority className="object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/40 to-transparent" />
      </div>

      <div className="flex gap-4 -mt-20 sm:-mt-24 relative px-1">
        <div className="w-24 sm:w-40 shrink-0">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-border bg-surface-2 shadow-xl">
            {poster && <Image src={poster} alt={movie.title} fill sizes="160px" className="object-cover" />}
          </div>
        </div>

        <div className="flex-1 min-w-0 self-end pb-1">
          <h1 className="text-lg sm:text-2xl font-bold leading-tight">{movie.title}</h1>
          <div className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-muted mt-1">
            {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
            {movie.runtime ? (
              <>
                <span>·</span>
                <span>{t.minutesCount(movie.runtime)}</span>
              </>
            ) : null}
            {movie.vote_average > 0 && (
              <>
                <span>·</span>
                <span className="text-accent">★ {movie.vote_average.toFixed(1)}</span>
              </>
            )}
          </div>

          <div className="mt-3">
            <FollowButton
              tmdbId={movieId}
              mediaType="movie"
              title={movie.title}
              posterPath={movie.poster_path}
              initialFollowing={following}
              locale={locale}
            />
          </div>
        </div>
      </div>

      <DetailTabs
        tabs={[
          {
            key: "track",
            label: t.tabTrack,
            icon: "check",
            content: (
              <div className="space-y-4">
                <MovieWatchedButton
                  movieTmdbId={movieId}
                  runtime={movie.runtime}
                  initialWatched={watched}
                  locale={locale}
                />
                <MovieProgress
                  movieTmdbId={movieId}
                  runtime={movie.runtime}
                  title={movie.title}
                  posterPath={movie.poster_path}
                  initialPosition={mProgress?.position_minutes ?? 0}
                  watched={watched}
                  locale={locale}
                />
                <RatingBox
                  tmdbId={movieId}
                  mediaType="movie"
                  title={movie.title}
                  posterPath={movie.poster_path}
                  locale={locale}
                  initialRating={myRating?.rating ?? null}
                  initialReview={myRating?.review ?? null}
                />
                <ListPicker
                  lists={myLists.map((l) => ({ id: l.id, name: l.name }))}
                  containing={inLists}
                  tmdbId={movieId}
                  mediaType="movie"
                  title={movie.title}
                  posterPath={movie.poster_path}
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
                {movie.overview && (
                  <section>
                    <SectionTitle icon="info" className="mb-2">
                      {t.storyTitle}
                    </SectionTitle>
                    <p className="text-sm text-muted leading-relaxed">{movie.overview}</p>
                  </section>
                )}

                {movie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {movie.genres.map((g) => (
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
                    title={movie.title}
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
