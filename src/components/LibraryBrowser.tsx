"use client";

import { useMemo, useState } from "react";
import { PosterCard } from "./PosterCard";
import { PosterGrid } from "./PosterGrid";
import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

export interface LibraryItem {
  key: string;
  href: string;
  title: string;
  posterPath: string | null;
  kind: "tv" | "movie";
  status: "watching" | "notStarted" | "done";
  badge?: string;
  progress?: number;
}

type Filter = "all" | "watching" | "notStarted" | "done" | "tv" | "movie";

/**
 * المكتبة في شبكة واحدة.
 *
 * كانت أربع شبكات فوق بعضها — جارية، مسلسلات، أفلام، أكملتها — والعمل
 * الواحد يظهر في ثلاث منها. صفحة بطول ثلاثة أمتار تعرض ثلاثة عشر عملاً.
 * الآن شبكة واحدة وشريط شرائح: الفلترة تتم في المتصفح بلا رحلة للخادم،
 * فالتبديل فوري.
 */
export function LibraryBrowser({
  items,
  locale,
}: {
  items: LibraryItem[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: items.length,
      watching: items.filter((i) => i.status === "watching").length,
      notStarted: items.filter((i) => i.status === "notStarted").length,
      done: items.filter((i) => i.status === "done").length,
      tv: items.filter((i) => i.kind === "tv").length,
      movie: items.filter((i) => i.kind === "movie").length,
    }),
    [items],
  );

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: t.libFilterAll },
    { key: "watching", label: t.libFilterWatching },
    { key: "notStarted", label: t.libFilterNotStarted },
    { key: "done", label: t.libFilterDone },
    { key: "tv", label: t.libFilterTv },
    { key: "movie", label: t.libFilterMovies },
  ];

  const shown = useMemo(() => {
    const list =
      filter === "all"
        ? items
        : filter === "tv" || filter === "movie"
          ? items.filter((i) => i.kind === filter)
          : items.filter((i) => i.status === filter);
    // المسلسلات أولاً ثم الأفلام: الترتيب الافتراضي كان يخلطهما حسب
    // ترتيب الإضافة، فتتناثر الأفلام بين المسلسلات بلا منطق ظاهر
    return [...list].sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === "tv" ? -1 : 1,
    );
  }, [items, filter]);

  return (
    <div>
      <div className="-mx-4 px-4 mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1.5 w-max">
          {chips.map((c) => {
            const n = counts[c.key];
            const on = filter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                aria-pressed={on}
                disabled={n === 0}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition whitespace-nowrap disabled:opacity-35 ${
                  on
                    ? "bg-accent text-[color:var(--on-accent)] border-accent"
                    : "bg-surface text-muted border-border hover:text-foreground hover:border-accent/50"
                }`}
              >
                {c.label}{" "}
                <span className="opacity-70 tabular-nums">
                  <span dir="ltr">{n}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted text-center py-12">{t.libNothingHere}</p>
      ) : (
        <PosterGrid>
          {shown.map((i) => (
            <PosterCard
              key={i.key}
              href={i.href}
              title={i.title}
              posterPath={i.posterPath}
              badge={i.badge}
              progress={i.progress}
            />
          ))}
        </PosterGrid>
      )}

      {/* مدخل التحليل أسفل الشبكة لا فوقها: يراه من فرغ من التصفّح،
          ولا يعترض من جاء ليختار ما يشاهده */}
      <Link
        href="/stats"
        className="mt-6 flex items-center justify-center gap-2 text-xs text-muted hover:text-accent border border-dashed border-border rounded-xl py-3 transition"
      >
        <Icon name="chart" size={16} />
        {t.libAnalysisBtn}
      </Link>
    </div>
  );
}
