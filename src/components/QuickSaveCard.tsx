"use client";

import { useState, useTransition } from "react";
import { flashError } from "@/lib/toast";
import { follow } from "@/lib/actions";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

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
      tap(10);
    } catch {
      /* لا شيء */
    }
    start(async () => {
      try {
        await follow({ tmdbId, mediaType, title, posterPath });
      } catch (e) {
        flashError((e as Error).message);
        setState("none");
      }
    });
  }

  // هدف اللمس ٤٤ بكسلاً والدائرة المرئية ٣٦ — الغلاف شفاف يوسّع الإصابة
  const wrap = "absolute top-0.5 end-0.5 z-10 grid place-items-center w-11 h-11";
  const base =
    "grid place-items-center w-9 h-9 rounded-full backdrop-blur-md transition-all duration-200";

  return (
    <div className="relative">
      {children}

      {state === "watched" ? (
        /* شفته: مؤشّر لا زرّ — المعلومة هي الفائدة */
        <span className={wrap} title={t.watchedBadge} aria-label={t.watchedBadge}>
          <span className={`${base} bg-black/45 border border-white/20`}>
          <Icon
            name="check-line"
            size={18}
            strokeWidth={2.2}
            className="text-[color:var(--success)]"
          />
          </span>
        </span>
      ) : (
        <button
          type="button"
          onClick={save}
          disabled={state === "saved"}
          aria-label={state === "saved" ? t.libToWatch : t.follow}
          title={state === "saved" ? t.libToWatch : t.follow}
          className={`${wrap} active:scale-90`}
        >
          <span
            className={`${base} ${
              state === "saved"
                ? "bg-black/55 border border-transparent scale-105"
                : "bg-black/45 border border-white/25 hover:bg-black/60"
            }`}
          >
          <Icon
            name="bookmark"
            size={16}
            style={
              state === "saved"
                ? { color: "var(--brand-3)", fill: "currentColor" }
                : { color: "rgba(255,255,255,0.9)" }
            }
          />
          </span>
        </button>
      )}
    </div>
  );
}
