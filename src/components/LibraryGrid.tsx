"use client";

import { useMemo, useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { PosterCard } from "./PosterCard";
import { Icon } from "./Icon";

export interface GridItem {
  key: string;
  href: string;
  title: string;
  posterPath: string | null;
  progress?: number;
  badge?: string;
  badgeTone?: "neutral" | "progress" | "watched" | "rating" | "dropped";
  count?: number;
  dropped?: boolean;
}

/**
 * المكتبة: تبويبان لا أربعة.
 *
 * «للمشاهدة» و«القادم» انتقلا إلى الرئيسية صفوفاً أفقية، فبقيت المكتبة
 * لما هي له: كل ما تتابعه. تبويبٌ للمسلسلات وتبويبٌ للأفلام، وكلٌّ
 * منهما شبكةُ ملصقاتٍ رأسية — ثلاثة في الصفّ على الجوال وتتّسع مع
 * الشاشة — لأن سؤال المكتبة «ماذا عندي؟» وجوابه يُقرأ بالأغلفة لا
 * بالصفوف.
 */
export function LibraryGrid({
  shows,
  movies,
  locale,
  initialTab = "shows",
}: {
  shows: GridItem[];
  movies: GridItem[];
  locale: Locale;
  initialTab?: "shows" | "movies";
}) {
  const t = getDict(locale);
  const [tab, setTab] = useState<"shows" | "movies">(initialTab);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"smart" | "title" | "progress">("smart");

  /* البحث والفرز في الذاكرة: القائمة وصلت كاملةً من الخادم، فالحرف
     الواحد يصفّي فوراً بلا رحلة شبكة */
  const items = useMemo(() => {
    const base = tab === "shows" ? shows : movies;
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? base.filter((x) => x.title.toLowerCase().includes(needle))
      : base;
    if (sort === "title") return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "progress")
      return [...filtered].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    return filtered;
  }, [tab, shows, movies, q, sort]);

  const tabs = [
    { id: "shows" as const, icon: "tv" as const, label: t.shortShows, n: shows.length },
    { id: "movies" as const, icon: "film" as const, label: t.shortMovies, n: movies.length },
  ];

  return (
    <div>
      {/* تبويبان بلا إطار — على نمط صفّ أرقام الرئيسية: فاصلٌ رأسيّ رفيع
          بينهما، وخطٌّ سفليّ بلون التمييز تحت المختار وحده */}
      <div
        className="grid grid-cols-2 mb-5 border-b border-[color:var(--divider)]"
        role="tablist"
      >
        {tabs.map(({ id, icon, label, n }, i) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className="relative flex items-center justify-center gap-2 px-3 pt-1.5 pb-3 text-sm font-semibold transition"
            >
              <Icon
                name={icon}
                size={17}
                className={`shrink-0 transition ${active ? "text-accent" : "text-muted"}`}
              />
              <span className={`transition ${active ? "text-foreground" : "text-muted"}`}>
                {label}
              </span>
              <span
                className={`text-[11px] tabular-nums transition ${
                  active ? "text-accent" : "text-muted"
                }`}
                dir="ltr"
              >
                {n}
              </span>

              {/* الفاصل الرأسي بين التبويبين */}
              {i === 0 && (
                <span className="absolute inset-y-1 end-0 w-px bg-white/10" aria-hidden />
              )}

              {/* مؤشّر الاختيار: خطّ يجلس على حدّ الصفّ السفلي */}
              <span
                aria-hidden
                className={`absolute -bottom-px inset-x-8 h-[3px] rounded-full transition-all duration-200 ${
                  active ? "bg-accent opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* بحثٌ وفرز: سطرٌ واحد تحت التبويبين */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 start-3 grid place-items-center text-muted pointer-events-none">
            <Icon name="search" size={15} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.searchLibrary}
            className="w-full bg-surface border border-border rounded-xl ps-9 pe-3 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent/60"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0" role="group" aria-label={t.sortSmart}>
          {(
            [
              { id: "smart", label: t.sortSmart },
              { id: "title", label: t.sortTitle },
              { id: "progress", label: t.sortProgress },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={sort === id}
              onClick={() => setSort(id)}
              className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold transition ${
                sort === id
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-muted py-16">{t.libraryEmpty}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {items.map((x) => (
            <PosterCard
              key={x.key}
              href={x.href}
              title={x.title}
              posterPath={x.posterPath}
              progress={x.progress}
              badge={x.badge}
              badgeTone={x.badgeTone}
              count={x.count}
              dropped={x.dropped}
            />
          ))}
        </div>
      )}
    </div>
  );
}
