import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import { getUser, getFollows, getWatchedMovieIds, getMovieProgress } from "@/lib/data";
import { MovieProgress } from "@/components/MovieProgress";
import { getMovie, backdropUrl, posterUrl } from "@/lib/tmdb";
import { FollowButton } from "@/components/FollowButton";
import { MovieWatchedButton } from "@/components/MovieWatchedButton";
import { getT } from "@/lib/locale";

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

  const [follows, watchedIds, mProgress] = await Promise.all([
    getFollows(),
    getWatchedMovieIds(),
    getMovieProgress(movieId),
  ]);
  const following = follows.some((f) => f.tmdb_id === movieId && f.media_type === "movie");
  const watched = watchedIds.has(movieId);

  const backdrop = backdropUrl(movie.backdrop_path);
  const poster = posterUrl(movie.poster_path, "w342");

  return (
    <div>
      <div className="relative -mx-4 -mt-6 h-56 sm:h-72 mb-4">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority className="object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/40 to-transparent" />
      </div>

      <div className="flex flex-col sm:flex-row gap-6 -mt-24 relative px-1">
        <div className="w-32 sm:w-44 shrink-0 mx-auto sm:mx-0">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-border bg-surface-2 shadow-xl">
            {poster && <Image src={poster} alt={movie.title} fill className="object-cover" />}
          </div>
        </div>

        <div className="flex-1 pt-2">
          <h1 className="text-2xl sm:text-3xl font-bold">{movie.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted mt-2">
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
          <div className="flex flex-wrap gap-2 mt-3">
            {movie.genres.map((g) => (
              <span key={g.id} className="text-xs bg-surface-2 border border-border px-2.5 py-1 rounded-full">
                {g.name}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted leading-relaxed mt-4 max-w-2xl">{movie.overview}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <MovieWatchedButton
              movieTmdbId={movieId}
              runtime={movie.runtime}
              initialWatched={watched}
              locale={locale}
            />
            <FollowButton
              tmdbId={movieId}
              mediaType="movie"
              title={movie.title}
              posterPath={movie.poster_path}
              initialFollowing={following}
              locale={locale}
            />
          </div>

          <MovieProgress
            movieTmdbId={movieId}
            runtime={movie.runtime}
            title={movie.title}
            posterPath={movie.poster_path}
            initialPosition={mProgress?.position_minutes ?? 0}
            watched={watched}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
