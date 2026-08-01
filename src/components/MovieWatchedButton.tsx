"use client";

import { useState, useTransition } from "react";
import { toggleMovieWatched } from "@/lib/actions";

export function MovieWatchedButton({
  movieTmdbId,
  runtime,
  initialWatched,
}: {
  movieTmdbId: number;
  runtime: number | null;
  initialWatched: boolean;
}) {
  const [watched, setWatched] = useState(initialWatched);
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !watched;
          setWatched(next);
          await toggleMovieWatched({ movieTmdbId, runtime, watched: next });
        })
      }
      className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60 ${
        watched
          ? "bg-accent-2 text-[#062015] hover:brightness-110"
          : "bg-surface-2 text-foreground border border-border hover:border-accent-2/60"
      }`}
    >
      {watched ? "✓ شاهدته" : "وضع كمشاهَد"}
    </button>
  );
}
