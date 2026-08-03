"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleEpisode } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";

export interface NextEpisode {
  season: number;
  episode: number;
  name: string | null;
  stillUrl: string | null;
  runtime: number | null;
}

/**
 * بطاقة «الحلقة التالية» البطلة.
 *
 * تتقدّم في مكانها: بعد التأشير تنتقل فوراً للحلقة التي بعدها بلا إعادة
 * تحميل، فثلاث حلقات = ثلاث ضغطات. ومعها تراجع لخمس ثوانٍ، لأن الضغط
 * بالخطأ كان يعني رحلة كاملة لصفحة المسلسل لإلغائه.
 */
export function HeroNextUp({
  showTmdbId,
  showName,
  queue,
  locale,
}: {
  showTmdbId: number;
  showName: string;
  /** الحلقة التالية وما بعدها — تكفي للتقدّم بلا انتظار الخادم */
  queue: NextEpisode[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [undoFor, setUndoFor] = useState<NextEpisode | null>(null);
  const [, start] = useTransition();

  const current = queue[index];
  if (!current) return null;

  function mark() {
    const ep = queue[index];
    setIndex((i) => i + 1);
    setUndoFor(ep);
    window.setTimeout(() => setUndoFor((u) => (u === ep ? null : u)), 5000);

    // اهتزاز خفيف يعطي تأكيداً فورياً على الجوال
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);

    start(async () => {
      try {
        await toggleEpisode({
          showTmdbId,
          season: ep.season,
          episode: ep.episode,
          runtime: ep.runtime,
          watched: true,
        });
      } catch {
        setIndex((i) => Math.max(0, i - 1));
        setUndoFor(null);
      }
    });
  }

  function undo() {
    const ep = undoFor;
    if (!ep) return;
    setUndoFor(null);
    setIndex((i) => Math.max(0, i - 1));
    start(async () => {
      try {
        await toggleEpisode({
          showTmdbId,
          season: ep.season,
          episode: ep.episode,
          runtime: ep.runtime,
          watched: false,
        });
        router.refresh();
      } catch {
        setIndex((i) => i + 1);
      }
    });
  }

  return (
    <section aria-labelledby="next-up-heading" className="relative">
      <h2 id="next-up-heading" className="sr-only">
        {t.nextUpTitle}
      </h2>

      <div className="relative rounded-2xl overflow-hidden border border-border min-h-[190px] sm:min-h-[230px]">
        {current.stillUrl ? (
          <Image
            src={current.stillUrl}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1152px"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, var(--surface-2), var(--surface) 60%, var(--background))",
            }}
          />
        )}

        {/* تعتيم متدرّج حتى يبقى النص مقروءاً مهما كانت الصورة */}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/70 to-transparent" />

        <div className="relative p-4 sm:p-5 flex flex-col justify-end min-h-[190px] sm:min-h-[230px]">
          <span className="text-[11px] font-bold text-accent">{t.heroKicker}</span>

          <Link
            href={`/show/${showTmdbId}`}
            prefetch={false}
            className="text-xl sm:text-2xl font-extrabold leading-tight mt-1 hover:text-accent transition"
          >
            {showName}
          </Link>

          <span className="text-sm font-bold text-accent-2 mt-1">
            {t.nextUpEpisode(current.season, current.episode)}
          </span>

          {(current.name || current.runtime) && (
            <span className="text-xs text-muted mt-0.5 truncate">
              {current.name}
              {current.name && current.runtime ? " · " : ""}
              {current.runtime ? t.runtimeMin(current.runtime) : ""}
            </span>
          )}

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button
              onClick={mark}
              className="px-5 py-2.5 rounded-xl bg-accent-2 text-[color:var(--on-accent-2)] font-extrabold text-sm hover:brightness-110 active:scale-[0.98] transition"
            >
              {t.nextUpMark}
            </button>
            <Link
              href={`/show/${showTmdbId}`}
              prefetch={false}
              className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-foreground transition"
            >
              {t.detailsBtn}
            </Link>
          </div>
        </div>
      </div>

      {undoFor && (
        <div
          role="status"
          className="mt-2 flex items-center justify-between gap-3 bg-surface border border-accent-2/40 rounded-xl px-4 py-2.5"
        >
          <span className="text-sm">
            <span className="text-accent-2 font-bold">✓ {t.markedOne}</span>
            <span className="text-muted">
              {" "}
              — {t.nextUpEpisode(undoFor.season, undoFor.episode)}
            </span>
          </span>
          <button
            onClick={undo}
            className="text-sm font-bold text-accent hover:brightness-110 shrink-0"
          >
            {t.undo}
          </button>
        </div>
      )}
    </section>
  );
}
