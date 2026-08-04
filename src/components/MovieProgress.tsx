"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMovieProgress } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * الزمن دائماً بصيغة ساعة:دقيقة.
 *
 * كان ما دون الساعة يُكتب «٢١ د»، فيخرج السطر «الدقيقة ٢١ د من ١:٤٩» —
 * وحدةٌ مكرّرة وصيغتان في جملة واحدة. الآن «٠:٢١ من ١:٤٩».
 */
function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
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
    <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 max-w-xl">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-sm font-bold">{t.whereStopped}</h3>
        <span className="text-xs text-muted">
          {pos > 0 ? (
            <>
              {t.atMinute}{" "}
              <span className="text-accent-2 font-semibold" dir="ltr">
                {fmt(pos)}
              </span>
              {runtime ? t.outOfRemaining(fmt(max), fmt(remaining)) : ""}
            </>
          ) : (
            t.notStartedYet
          )}
        </span>
      </div>

      {/* شريط واحد لا شريطان: كان فوق المنزلق شريطُ تقدّم يعرض الرقم نفسه،
          فيرى المستخدم مؤشّرين متطابقين ويحسب أن أحدهما شيء آخر. المنزلق
          وحده يكفي — تعبئته الملوّنة هي شريط التقدّم. */}
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
        dir="ltr"
        className="w-full h-2 appearance-none rounded-full outline-none cursor-pointer mb-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[color:var(--accent-2)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[color:var(--background)] [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[color:var(--accent-2)] [&::-moz-range-thumb]:border-0"
        style={{
          background: `linear-gradient(to right, var(--accent-2) ${pct}%, var(--surface-2) ${pct}%)`,
        }}
        aria-label={t.positionAria}
      />

      {/* الأزرار الأربعة (-١٠ -٥ +٥ +١٠) حُذفت: المنزلق يصل لأي دقيقة
          بحركة واحدة، وحقل الرقم يضبطها بدقّة — والأزرار كانت صفّاً كاملاً
          لعملٍ يؤدّيه الاثنان أصلاً. */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
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
          <span className="text-xs text-muted">{t.minuteWord}</span>
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
