"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markShowWatched, toggleMovieWatched, setDropped } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * أدوات بطاقة «للمشاهدة»: زرّان يطفوان على الملصق.
 *
 * ✓ «شفته» يعلّم العمل كله مشاهداً، والبطاقة الحمراء 🟥 — استعارةً من
 * حكم الملعب — توقف عملاً اكتفيتَ منه: لا يُحذف ولا يُكذب عليه بعلامة
 * مشاهدة، بل يبقى في المكتبة بشريطٍ أحمر ويرحل من الرئيسية.
 *
 * البطاقة تختفي فور اللمس — التفاؤل قبل الشبكة — وتعود إن فشل الطلب.
 * والحاوية تغلّف البطاقة نفسها: الأزرار تُرسم فوقها لا بجانبها.
 */
export function ToWatchCard({
  tmdbId,
  mediaType,
  locale,
  children,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [gone, setGone] = useState(false);
  const [, start] = useTransition();

  if (gone) return null;

  function run(fn: () => Promise<unknown>) {
    setGone(true);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch {
        setGone(false);
      }
    });
  }

  return (
    <div className="relative">
      {children}

      <div className="absolute top-[52%] end-1.5 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label={t.markAllWatched}
          title={t.markAllWatched}
          onClick={() =>
            run(() =>
              mediaType === "tv"
                ? markShowWatched(tmdbId)
                : toggleMovieWatched({ movieTmdbId: tmdbId, runtime: null, watched: true }),
            )
          }
          className="grid place-items-center w-8 h-8 rounded-full bg-black/60 backdrop-blur border border-white/20 text-[color:var(--success)] hover:bg-[color:var(--success)] hover:text-white transition"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m4.5 12.5 5 5 10-11" />
          </svg>
        </button>

        <button
          type="button"
          aria-label={t.dropTitle}
          title={t.dropTitle}
          onClick={() => run(() => setDropped(tmdbId, mediaType, true))}
          className="grid place-items-center w-8 h-8 rounded-full bg-black/60 backdrop-blur border border-white/20 text-[color:var(--error)] hover:bg-[color:var(--error)] hover:text-white transition"
        >
          {/* بطاقة الحكم: مستطيل مائل قليلاً */}
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <rect
              x="7"
              y="4.5"
              width="10.5"
              height="15"
              rx="2"
              fill="currentColor"
              transform="rotate(9 12 12)"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
