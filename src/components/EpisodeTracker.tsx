"use client";

import { useMemo, useState, useTransition } from "react";
import { toggleEpisode, setSeasonWatched, watchUpTo } from "@/lib/actions";
import { episodeKey } from "@/lib/keys";
import { getDict, type Locale } from "@/lib/i18n";

export interface TrackerEpisode {
  episode_number: number;
  name: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
}
export interface TrackerSeason {
  season_number: number;
  name: string;
  episodes: TrackerEpisode[];
}

const today = () => new Date().toISOString().slice(0, 10);

function hasAired(air_date: string | null) {
  return !!air_date && air_date <= today();
}

export function EpisodeTracker({
  showTmdbId,
  seasons,
  initialWatched,
  locale,
}: {
  showTmdbId: number;
  seasons: TrackerSeason[];
  initialWatched: string[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [watched, setWatched] = useState<Set<string>>(new Set(initialWatched));
  const [, start] = useTransition();

  const airedEpisodes = useMemo(
    () => seasons.flatMap((s) => s.episodes.filter((e) => hasAired(e.air_date))),
    [seasons],
  );
  const watchedAired = airedEpisodes.filter((e) =>
    watched.has(episodeKey(seasonOf(seasons, e), e.episode_number)),
  ).length;
  const progress = airedEpisodes.length
    ? Math.round((watchedAired / airedEpisodes.length) * 100)
    : 0;

  // افتح الموسم الذي فيه أول حلقة غير مشاهَدة
  const defaultOpen = useMemo(() => {
    for (const s of seasons) {
      for (const e of s.episodes) {
        if (hasAired(e.air_date) && !watched.has(episodeKey(s.season_number, e.episode_number)))
          return s.season_number;
      }
    }
    return seasons[0]?.season_number ?? 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasons]);

  const [open, setOpen] = useState<number | null>(defaultOpen);

  // كل الحلقات المعروضة مرتّبة زمنياً (موسم ثم رقم حلقة)
  const orderedAired = useMemo(() => {
    const list: { season: number; episode: number; runtime: number | null }[] = [];
    for (const s of [...seasons].sort((a, b) => a.season_number - b.season_number)) {
      for (const e of [...s.episodes].sort((a, b) => a.episode_number - b.episode_number)) {
        if (hasAired(e.air_date))
          list.push({ season: s.season_number, episode: e.episode_number, runtime: e.runtime });
      }
    }
    return list;
  }, [seasons]);

  function toggleOne(season: number, ep: TrackerEpisode) {
    const key = episodeKey(season, ep.episode_number);
    const next = !watched.has(key);

    // عند التأشير: تُعتبر كل الحلقات السابقة مشاهَدة أيضاً
    if (next) {
      const idx = orderedAired.findIndex(
        (o) => o.season === season && o.episode === ep.episode_number,
      );
      const upTo = idx >= 0 ? orderedAired.slice(0, idx + 1) : [];
      const toMark = upTo.filter((o) => !watched.has(episodeKey(o.season, o.episode)));

      setWatched((prev) => {
        const s = new Set(prev);
        for (const o of upTo) s.add(episodeKey(o.season, o.episode));
        return s;
      });

      start(async () => {
        if (toMark.length > 1) {
          await watchUpTo({ showTmdbId, episodes: toMark });
        } else {
          await toggleEpisode({
            showTmdbId,
            season,
            episode: ep.episode_number,
            runtime: ep.runtime,
            watched: true,
          });
        }
      });
      return;
    }

    // عند إلغاء التأشير: تُلغى هذه الحلقة فقط
    setWatched((prev) => {
      const s = new Set(prev);
      s.delete(key);
      return s;
    });
    start(async () => {
      await toggleEpisode({
        showTmdbId,
        season,
        episode: ep.episode_number,
        runtime: ep.runtime,
        watched: false,
      });
    });
  }

  function toggleSeason(s: TrackerSeason, mark: boolean) {
    const aired = s.episodes.filter((e) => hasAired(e.air_date));
    setWatched((prev) => {
      const set = new Set(prev);
      for (const e of aired) {
        const key = episodeKey(s.season_number, e.episode_number);
        if (mark) set.add(key);
        else set.delete(key);
      }
      return set;
    });
    start(async () => {
      await setSeasonWatched({
        showTmdbId,
        episodes: aired.map((e) => ({
          season: s.season_number,
          episode: e.episode_number,
          runtime: e.runtime,
        })),
        watched: mark,
      });
    });
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted">{t.watchedOf(watchedAired, airedEpisodes.length)}</span>
          <span className="font-semibold text-accent-2">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full bg-accent-2 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted mt-2">{t.cascadeHint}</p>
      </div>

      <div className="space-y-3">
        {seasons.map((s) => {
          const aired = s.episodes.filter((e) => hasAired(e.air_date));
          const seasonWatched = aired.filter((e) =>
            watched.has(episodeKey(s.season_number, e.episode_number)),
          ).length;
          const allWatched = aired.length > 0 && seasonWatched === aired.length;
          const isOpen = open === s.season_number;

          return (
            <div
              key={s.season_number}
              className="rounded-xl border border-border bg-surface overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => setOpen(isOpen ? null : s.season_number)}
                  className="flex-1 flex items-center gap-3 text-start"
                >
                  <span className="text-muted">{isOpen ? "▾" : "▸"}</span>
                  <span className="font-semibold">{s.name || t.seasonLabel(s.season_number)}</span>
                  <span className="text-xs text-muted" dir="ltr">
                    {seasonWatched}/{aired.length}
                  </span>
                </button>
                {aired.length > 0 && (
                  <button
                    onClick={() => toggleSeason(s, !allWatched)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      allWatched
                        ? "border-border text-muted hover:text-foreground"
                        : "border-accent-2/50 text-accent-2 hover:bg-accent-2/10"
                    }`}
                  >
                    {allWatched ? t.seasonUndo : t.seasonAll}
                  </button>
                )}
              </div>

              {isOpen && (
                <ul className="divide-y divide-border border-t border-border">
                  {s.episodes.map((e) => {
                    const key = episodeKey(s.season_number, e.episode_number);
                    const isWatched = watched.has(key);
                    const epAired = hasAired(e.air_date);
                    return (
                      <li
                        key={e.episode_number}
                        className={`flex items-center gap-3 px-4 py-3 ${!epAired ? "opacity-50" : ""}`}
                      >
                        <button
                          disabled={!epAired}
                          onClick={() => toggleOne(s.season_number, e)}
                          className={`shrink-0 w-6 h-6 rounded-md border grid place-items-center transition ${
                            isWatched
                              ? "bg-accent-2 border-accent-2 text-[color:var(--on-accent-2)]"
                              : "border-border hover:border-accent-2"
                          } ${!epAired ? "cursor-not-allowed" : ""}`}
                          aria-label={t.markWatchedAria}
                        >
                          {isWatched ? "✓" : ""}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            <span className="text-muted">{e.episode_number}.</span> {e.name}
                          </p>
                          {e.air_date && (
                            <p className="text-xs text-muted">
                              {epAired ? e.air_date : t.airsOn(e.air_date)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function seasonOf(seasons: TrackerSeason[], ep: TrackerEpisode): number {
  for (const s of seasons) if (s.episodes.includes(ep)) return s.season_number;
  return 1;
}
