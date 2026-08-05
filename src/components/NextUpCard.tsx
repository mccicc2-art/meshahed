"use client";

import Link from "next/link";
import { flashError } from "@/lib/flash";
import { coalescedRefresh } from "@/lib/refresh";
import { Logo } from "./Logo";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runOrQueue } from "@/lib/offline";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * أبرز ما يميّز تطبيقات المتابعة: الحلقة التالية بنقرة واحدة.
 * بدل: الرئيسية ← المسلسل ← الموسم ← الحلقة ← تأشير.
 */
export function NextUpCard({
  showTmdbId,
  showName,
  season,
  episode,
  episodeName,
  stillUrl,
  runtime,
  locale,
}: {
  showTmdbId: number;
  showName: string;
  season: number;
  episode: number;
  episodeName: string | null;
  stillUrl: string | null;
  runtime: number | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function mark() {
    setDone(true);
    start(async () => {
      try {
        await runOrQueue("toggleEpisode", { showTmdbId, season, episode, runtime, watched: true });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        setDone(false);
      }
    });
  }

  return (
    <section aria-labelledby="next-up-heading">
      <h2 id="next-up-heading" className="text-lg font-bold mb-4">
        {t.nextUpTitle}
      </h2>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col sm:flex-row">
        <Link
          href={`/show/${showTmdbId}`}
          prefetch={false}
          className="relative w-full sm:w-56 shrink-0 aspect-[16/9] bg-surface-2 group"
          aria-label={showName}
        >
          {stillUrl ? (
            <Image
              src={stillUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 224px"
              className="object-cover group-hover:scale-[1.03] transition duration-300"
            />
          ) : (
            <span className="w-full h-full grid place-items-center text-muted">
              <Logo size={28} gradientId="nextup-empty" />
            </span>
          )}
        </Link>

        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center gap-1 min-w-0">
          <Link
            href={`/show/${showTmdbId}`}
            className="font-bold text-base sm:text-lg leading-tight hover:text-accent transition truncate"
          >
            {showName}
          </Link>

          <p className="text-sm text-accent-2 font-semibold" dir="auto">
            {t.nextUpEpisode(season, episode)}
          </p>

          {(episodeName || runtime) && (
            <div className="flex items-baseline gap-2 min-w-0 text-sm text-muted">
              {episodeName && (
                <span className="truncate" dir="auto">
                  {episodeName}
                </span>
              )}
              {runtime ? (
                <span className="shrink-0 text-xs whitespace-nowrap">
                  {episodeName ? "· " : ""}
                  {t.runtimeMin(runtime)}
                </span>
              ) : null}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <button
              onClick={mark}
              disabled={pending || done}
              className="px-5 py-2.5 rounded-xl bg-accent-2 text-[color:var(--on-accent-2)] font-semibold text-sm hover:brightness-110 transition disabled:opacity-70"
            >
              {done ? (pending ? t.nextUpMarking : t.nextUpMarked) : t.nextUpMark}
            </button>
            <Link
              href={`/show/${showTmdbId}`}
              className="text-sm text-muted hover:text-accent transition"
            >
              {t.nextUpOpen}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
