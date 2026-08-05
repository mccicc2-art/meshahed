"use client";

import { useState, useTransition } from "react";
import { flashError } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { markShowWatched, toggleMovieWatched, setDropped } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { coalescedRefresh } from "@/lib/refresh";
import { Icon } from "./Icon";

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
  runtime = null,
  locale,
  children,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  /** مدّة الفيلم إن عُرفت — تُحفظ مع علامة المشاهدة ليصحّ حساب السجلّ */
  runtime?: number | null;
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [gone, setGone] = useState(false);
  const [, start] = useTransition();

  if (gone) return null;

  function run(fn: () => Promise<unknown>) {
    tap(10);
    setGone(true);
    start(async () => {
      try {
        await fn();
        // تجميع التحديثات: أربع بطاقات متتالية = تجديد واحد لا أربعة
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        setGone(false);
      }
    });
  }

  return (
    <div className="relative">
      {children}

      {/* هدف اللمس ٤٤ بكسلاً والدائرة المرئية ٣٢ — كالنمط في متتبّع الحلقات */}
      <div className="absolute top-[46%] end-0 flex flex-col">
        <button
          type="button"
          aria-label={t.markAllWatched}
          title={t.markAllWatched}
          onClick={() =>
            run(() =>
              mediaType === "tv"
                ? markShowWatched(tmdbId)
                : toggleMovieWatched({ movieTmdbId: tmdbId, runtime, watched: true }),
            )
          }
          className="grid place-items-center w-11 h-11 group/w"
        >
          <span className="grid place-items-center w-8 h-8 rounded-full bg-black/60 backdrop-blur border border-white/20 text-[color:var(--success)] group-hover/w:bg-[color:var(--success)] group-hover/w:text-white transition">
          <Icon name="check-line" size={16} strokeWidth={2.2} />
          </span>
        </button>

        <button
          type="button"
          aria-label={t.dropTitle}
          title={t.dropTitle}
          onClick={() => run(() => setDropped(tmdbId, mediaType, true))}
          className="grid place-items-center w-11 h-11 -mt-2 group/d"
        >
          <span className="grid place-items-center w-8 h-8 rounded-full bg-black/60 backdrop-blur border border-white/20 text-[color:var(--error)] group-hover/d:bg-[color:var(--error)] group-hover/d:text-white transition">
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
          </span>
        </button>
      </div>
    </div>
  );
}
