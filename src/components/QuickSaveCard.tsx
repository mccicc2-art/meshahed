"use client";

import { useState, useTransition } from "react";
import { follow } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * زرّ الحفظ السريع على بطاقات «الرائج».
 *
 * وأنت تتصفح ما يقترحه العالم، البطاقة نفسها تخبرك بعلاقتك بها:
 * ✓ خضراء = شفته، إشارة مرجعية ذهبية = في قائمتك، مفرّغة = غريب —
 * وضغطة واحدة عليها تتبعه فيدخل «للمشاهدة» دون مغادرة الصف.
 * الزرّ شقيق الرابط لا ابنه، فلا ضغطة تفتح الصفحة خطأً.
 */
export function QuickSaveCard({
  tmdbId,
  mediaType,
  title,
  posterPath,
  state: initial,
  locale,
  children,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  state: "none" | "saved" | "watched";
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = getDict(locale);
  const [state, setState] = useState(initial);
  const [, start] = useTransition();

  function save() {
    if (state !== "none") return;
    setState("saved"); // تفاؤل: اللون يتغير قبل ردّ الخادم
    try {
      navigator.vibrate?.(10);
    } catch {
      /* لا شيء */
    }
    start(async () => {
      try {
        await follow({ tmdbId, mediaType, title, posterPath });
      } catch {
        setState("none");
      }
    });
  }

  const base =
    "absolute top-2 end-2 z-10 grid place-items-center w-9 h-9 rounded-full backdrop-blur-md transition-all duration-200";

  return (
    <div className="relative">
      {children}

      {state === "watched" ? (
        /* شفته: مؤشّر لا زرّ — المعلومة هي الفائدة */
        <span
          className={`${base} bg-black/45 border border-white/20`}
          title={t.watchedBadge}
          aria-label={t.watchedBadge}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke="var(--success)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : (
        <button
          type="button"
          onClick={save}
          disabled={state === "saved"}
          aria-label={state === "saved" ? t.libToWatch : t.follow}
          title={state === "saved" ? t.libToWatch : t.follow}
          className={`${base} active:scale-90 ${
            state === "saved"
              ? "bg-black/55 border border-transparent scale-105"
              : "bg-black/45 border border-white/25 hover:bg-black/60"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M6.5 4.5h11v15l-5.5-4-5.5 4v-15Z"
              fill={state === "saved" ? "var(--brand-3)" : "none"}
              stroke={state === "saved" ? "var(--brand-3)" : "rgba(255,255,255,0.9)"}
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
