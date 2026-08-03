"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useState, useTransition } from "react";
import { toggleEpisode, setSeasonWatched, watchUpTo } from "@/lib/actions";
import { episodeKey } from "@/lib/keys";
import { getDict, type Dict, type Locale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/when";
import { IMG } from "@/lib/media";

export interface TrackerEpisode {
  episode_number: number;
  name: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
}

/** رأس الموسم — يصل مع الصفحة بلا حلقاته، فالحلقات تُطلب عند الفتح */
export interface SeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  aired_count: number;
}

const today = () => new Date().toISOString().slice(0, 10);

function hasAired(air_date: string | null) {
  return !!air_date && air_date <= today();
}

/** «1 يونيو · 52 د» — سطر البيانات المساعد للحلقة */
function metaLine(e: TrackerEpisode, aired: boolean, t: Dict): string {
  const parts: string[] = [];
  if (e.air_date) {
    const d = formatDateShort(e.air_date, t);
    parts.push(aired ? d : t.airsOn(d));
  }
  if (e.runtime) parts.push(t.runtimeMin(e.runtime));
  return parts.join(" · ");
}

export function EpisodeTracker({
  showTmdbId,
  summaries,
  initialSeason,
  initialEpisodes,
  airedTotal,
  defaultRuntime,
  initialWatched,
  locale,
}: {
  showTmdbId: number;
  summaries: SeasonSummary[];
  /** الموسم الذي جاء محمّلاً مع الصفحة (فيه أول حلقة غير مشاهَدة) */
  initialSeason: number | null;
  initialEpisodes: TrackerEpisode[];
  /** إجمالي الحلقات المعروضة — نفس الرقم المستخدم في الرئيسية والمكتبة */
  airedTotal: number;
  defaultRuntime: number | null;
  initialWatched: string[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [watched, setWatched] = useState<Set<string>>(new Set(initialWatched));
  const [, start] = useTransition();

  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, TrackerEpisode[]>>(
    initialSeason != null ? { [initialSeason]: initialEpisodes } : {},
  );
  const [loading, setLoading] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(initialSeason);

  // نفس قاعدة الرئيسية والمكتبة: ما أشّرته ÷ ما عُرض
  const watchedAired = Math.min(watched.size, airedTotal || watched.size);
  const progress = airedTotal ? Math.round((watchedAired / airedTotal) * 100) : 0;

  const loadSeason = useCallback(
    async (n: number): Promise<TrackerEpisode[]> => {
      const have = episodesBySeason[n];
      if (have) return have;
      setLoading(n);
      try {
        const res = await fetch(`/api/season?tv=${showTmdbId}&s=${n}`);
        const json = (await res.json()) as { episodes: TrackerEpisode[] };
        const eps = json.episodes ?? [];
        setEpisodesBySeason((prev) => ({ ...prev, [n]: eps }));
        return eps;
      } catch {
        return [];
      } finally {
        setLoading(null);
      }
    },
    [episodesBySeason, showTmdbId],
  );

  function toggleOpen(n: number) {
    if (open === n) {
      setOpen(null);
      return;
    }
    setOpen(n);
    if (!episodesBySeason[n]) void loadSeason(n);
  }

  /**
   * كل الحلقات المعروضة حتى حلقة معيّنة، مرتّبة زمنياً.
   * المواسم السابقة تُشتقّ من عدد حلقاتها المعروضة (بلا تحميل)، والموسم
   * الحالي من حلقاته المحمّلة فعلاً.
   */
  const airedUpTo = useCallback(
    (season: number, episode: number) => {
      const list: { season: number; episode: number; runtime: number | null }[] = [];
      for (const s of summaries) {
        if (s.season_number > season) break;
        const loaded = episodesBySeason[s.season_number];
        const limit =
          s.season_number === season ? episode : Math.min(s.aired_count, s.episode_count);
        for (let e = 1; e <= limit; e++) {
          const ep = loaded?.find((x) => x.episode_number === e);
          if (s.season_number === season && ep && !hasAired(ep.air_date)) continue;
          list.push({ season: s.season_number, episode: e, runtime: ep?.runtime ?? defaultRuntime });
        }
      }
      return list;
    },
    [summaries, episodesBySeason, defaultRuntime],
  );

  function toggleOne(season: number, ep: TrackerEpisode) {
    const key = episodeKey(season, ep.episode_number);
    const next = !watched.has(key);

    // عند التأشير: تُعتبر كل الحلقات السابقة مشاهَدة أيضاً
    if (next) {
      const upTo = airedUpTo(season, ep.episode_number);
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

  function toggleSeason(s: SeasonSummary, mark: boolean) {
    start(async () => {
      const eps = await loadSeason(s.season_number);
      const aired = eps.filter((e) => hasAired(e.air_date));
      setWatched((prev) => {
        const set = new Set(prev);
        for (const e of aired) {
          const key = episodeKey(s.season_number, e.episode_number);
          if (mark) set.add(key);
          else set.delete(key);
        }
        return set;
      });
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

  const watchedPerSeason = useMemo(() => {
    const m = new Map<number, number>();
    for (const key of watched) {
      const s = Number(key.split(":")[0]);
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [watched]);

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted">{t.watchedOf(watchedAired, airedTotal)}</span>
          <span className="font-semibold text-accent-2">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full bg-accent-2 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted mt-2">{t.cascadeHint}</p>
      </div>

      <div className="space-y-3">
        {summaries.map((s) => {
          const isOpen = open === s.season_number;
          const episodes = episodesBySeason[s.season_number];
          const seasonWatched = Math.min(
            watchedPerSeason.get(s.season_number) ?? 0,
            s.aired_count || s.episode_count,
          );
          const allWatched = s.aired_count > 0 && seasonWatched >= s.aired_count;

          return (
            <div
              key={s.season_number}
              className="rounded-xl border border-border bg-surface overflow-hidden"
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <button
                  onClick={() => toggleOpen(s.season_number)}
                  aria-expanded={isOpen}
                  aria-label={t.seasonToggleAria(s.season_number)}
                  className="flex-1 flex items-center gap-3 text-start"
                >
                  <span className="text-muted" aria-hidden>
                    {isOpen ? "▾" : "▸"}
                  </span>
                  <span className="font-semibold">{s.name || t.seasonLabel(s.season_number)}</span>
                  <span className="text-xs text-muted" dir="ltr">
                    {seasonWatched}/{s.aired_count}
                  </span>
                  {loading === s.season_number && (
                    <span className="text-xs text-muted">{t.loadingLabel}</span>
                  )}
                </button>
                {s.aired_count > 0 && (
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
                <>
                  {!episodes ? (
                    <ul className="divide-y divide-border border-t border-border">
                      {Array.from({ length: Math.min(s.episode_count, 6) }, (_, i) => (
                        <li key={i} className="flex items-center gap-2.5 px-3 py-2">
                          <span className="skeleton shrink-0 w-6 h-6 rounded-md" />
                          <span className="skeleton shrink-0 w-12 sm:w-[72px] aspect-video rounded-md" />
                          <span className="skeleton h-3 flex-1 rounded" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="divide-y divide-border border-t border-border">
                      {episodes.map((e) => {
                        const key = episodeKey(s.season_number, e.episode_number);
                        const isWatched = watched.has(key);
                        const epAired = hasAired(e.air_date);
                        return (
                          <li
                            key={e.episode_number}
                            className={`flex items-center gap-2.5 px-3 py-2 ${!epAired ? "opacity-50" : ""}`}
                          >
                            <button
                              disabled={!epAired}
                              onClick={() => toggleOne(s.season_number, e)}
                              className={`shrink-0 w-5 h-5 rounded-md border grid place-items-center text-xs transition ${
                                isWatched
                                  ? "bg-accent-2 border-accent-2 text-[color:var(--on-accent-2)]"
                                  : "border-border hover:border-accent-2"
                              } ${!epAired ? "cursor-not-allowed" : ""}`}
                              aria-pressed={isWatched}
                              aria-label={`${t.markWatchedAria} — ${e.episode_number}. ${e.name}`}
                            >
                              {isWatched ? "✓" : ""}
                            </button>

                            {/* صورة أصغر: كانت ٦٤ بكسلاً عرضاً فيصير الصف ١٢٦ بكسلاً،
                                واثنتا عشرة حلقة = ألف ونصف بكسل من التمرير.
                                المصغّرة هنا للتعرّف لا للمشاهدة. */}
                            <span className="shrink-0 w-12 sm:w-[72px] aspect-video rounded-md overflow-hidden bg-surface-2 border border-border">
                              {e.still_path ? (
                                <img
                                  src={`${IMG}/w185${e.still_path}`}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span
                                  className="w-full h-full grid place-items-center text-muted text-sm"
                                  aria-hidden
                                >
                                  🎬
                                </span>
                              )}
                            </span>

                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium truncate leading-tight">
                                <span className="text-muted">{e.episode_number}.</span> {e.name}
                              </p>
                              <p className="text-[11px] text-muted mt-0.5 truncate sm:hidden">
                                {metaLine(e, epAired, t)}
                              </p>
                            </div>

                            <span className="hidden sm:block shrink-0 text-xs text-muted text-end tabular-nums">
                              {metaLine(e, epAired, t)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
