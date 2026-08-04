"use client";

import { useState, useTransition } from "react";
import { toggleMovieWatched } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";

export function MovieWatchedButton({
  movieTmdbId,
  runtime,
  initialWatched,
  locale,
}: {
  movieTmdbId: number;
  runtime: number | null;
  initialWatched: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [watched, setWatched] = useState(initialWatched);
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !watched;
          setWatched(next);
          try {
            await toggleMovieWatched({ movieTmdbId, runtime, watched: next });
          } catch {
            // فشل الحفظ يرجّع الزرّ لحاله بدل أن يبقى معلَّماً كذباً
            setWatched(!next);
          }
        })
      }
      className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60 ${
        watched
          ? "bg-accent-2 text-[color:var(--on-accent-2)] hover:brightness-110"
          : "bg-surface-2 text-foreground border border-border hover:border-accent-2/60"
      }`}
    >
      {watched ? t.watchedMovie : t.markAsWatched}
    </button>
  );
}
