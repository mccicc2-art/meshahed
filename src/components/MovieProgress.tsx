"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMovieProgress } from "@/lib/actions";
import { getDict, type Dict, type Locale } from "@/lib/i18n";

function fmt(min: number, t: Dict) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} ${t.minuteShort}`;
}

export function MovieProgress({
  movieTmdbId,
  runtime,
  title,
  posterPath,
  initialPosition,
  watched,
  locale,
}: {
  movieTmdbId: number;
  runtime: number | null;
  title: string;
  posterPath: string | null;
  initialPosition: number;
  watched: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const max = runtime && runtime > 0 ? runtime : 240;
  const [pos, setPos] = useState(Math.min(initialPosition, max));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = max ? Math.round((pos / max) * 100) : 0;
  const remaining = Math.max(0, max - pos);

  function bump(delta: number) {
    setSaved(false);
    setPos((p) => Math.max(0, Math.min(p + delta, max)));
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        await saveMovieProgress({
          movieTmdbId,
          positionMinutes: pos,
          runtimeMinutes: runtime,
          title,
          posterPath,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (watched) return null;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mt-6 max-w-xl">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h3 className="font-bold">{t.whereStopped}</h3>
        <span className="text-sm text-muted">
          {pos > 0 ? (
            <>
              {t.atMinute} <span className="text-accent-2 font-semibold">{fmt(pos, t)}</span>
              {runtime ? t.outOfRemaining(fmt(max, t), fmt(remaining, t)) : ""}
            </>
          ) : (
            t.notStartedYet
          )}
        </span>
      </div>

      <div className="h-2 rounded-full bg-surface-2 overflow-hidden mb-4">
        <div className="h-full bg-accent-2 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={pos}
        onChange={(e) => {
          setPos(Number(e.target.value));
          setSaved(false);
        }}
        className="w-full accent-[color:var(--accent-2)] mb-4"
        aria-label={t.positionAria}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[-10, -5, +5, +10].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => bump(d)}
            className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm hover:border-accent transition"
            dir="ltr"
          >
            {d > 0 ? `+${d}` : d} {t.minuteShort}
          </button>
        ))}
        <div className="flex items-center gap-2 ms-auto">
          <input
            type="number"
            min={0}
            max={max}
            value={pos}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPos(Number.isFinite(v) ? Math.max(0, Math.min(v, max)) : 0);
              setSaved(false);
            }}
            className="w-20 rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-accent"
            aria-label={t.minuteWord}
          />
          <span className="text-sm text-muted">{t.minuteWord}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-300 mb-3">{t.errSave + error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={pending}
          className="px-5 py-2.5 rounded-xl bg-accent-2 text-[color:var(--on-accent-2)] font-semibold text-sm hover:brightness-110 transition disabled:opacity-60"
        >
          {pending ? t.saving : t.saveProgress}
        </button>
        {runtime && (
          <button
            type="button"
            onClick={() => {
              setPos(max);
              setSaved(false);
            }}
            className="text-sm text-muted hover:text-foreground px-3 py-2 rounded-lg hover:bg-surface-2 transition"
          >
            {t.finishedMovie}
          </button>
        )}
        {saved && <span className="text-sm text-accent-2">{t.savedOk}</span>}
      </div>
    </div>
  );
}
