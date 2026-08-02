"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMovieProgress } from "@/lib/actions";

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} د`;
}

export function MovieProgress({
  movieTmdbId,
  runtime,
  title,
  posterPath,
  initialPosition,
  watched,
}: {
  movieTmdbId: number;
  runtime: number | null;
  title: string;
  posterPath: string | null;
  initialPosition: number;
  watched: boolean;
}) {
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
        <h3 className="font-bold">أين توقّفت؟</h3>
        <span className="text-sm text-muted">
          {pos > 0 ? (
            <>
              الدقيقة <span className="text-accent-2 font-semibold">{fmt(pos)}</span>
              {runtime ? ` من ${fmt(max)} · باقي ${fmt(remaining)}` : ""}
            </>
          ) : (
            "لم تبدأ بعد"
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
        aria-label="موضع التوقف بالدقائق"
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[-10, -5, +5, +10].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => bump(d)}
            className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm hover:border-accent transition"
          >
            {d > 0 ? `+${d}` : d} د
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
            aria-label="الدقيقة"
          />
          <span className="text-sm text-muted">دقيقة</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-300 mb-3">تعذّر الحفظ: {error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={pending}
          className="px-5 py-2.5 rounded-xl bg-accent-2 text-[#062015] font-semibold text-sm hover:brightness-110 transition disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ…" : "حفظ موضع التوقف"}
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
            أنهيت الفيلم
          </button>
        )}
        {saved && <span className="text-sm text-accent-2">✓ تم الحفظ</span>}
      </div>
    </div>
  );
}
