"use client";

import { useState } from "react";
import { PosterCard } from "./PosterCard";
import { getDict, type Locale } from "@/lib/i18n";

export interface LibraryEntry {
  key: string;
  href: string;
  title: string;
  posterPath: string | null;
  kind: "tv" | "movie";
  badge?: string;
  progress?: number;
}

export interface LibraryStat {
  label: string;
  value: string;
  icon: string;
}

type TabId = "watching" | "saved" | "finished" | "stats";

export function LibraryTabs({
  locale,
  watching,
  saved,
  finished,
  stats,
}: {
  locale: Locale;
  watching: LibraryEntry[];
  saved: LibraryEntry[];
  finished: LibraryEntry[];
  stats: LibraryStat[];
}) {
  const t = getDict(locale);
  const [tab, setTab] = useState<TabId>("watching");

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "watching", label: t.libTabWatching, count: watching.length },
    { id: "saved", label: t.libTabFavorites, count: saved.length },
    { id: "finished", label: t.libTabFinished, count: finished.length },
    { id: "stats", label: t.libTabStats },
  ];

  const lists: Record<Exclude<TabId, "stats">, { items: LibraryEntry[]; empty: string }> = {
    watching: { items: watching, empty: t.libEmptyWatching },
    saved: { items: saved, empty: t.libEmptyFavorites },
    finished: { items: finished, empty: t.libEmptyFinished },
  };

  return (
    <div className="space-y-6">
      {/* شريط التبويبات */}
      <div className="-mx-4 px-4 overflow-x-auto">
        <div
          role="tablist"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1 min-w-max"
        >
          {tabs.map((tb) => {
            const active = tb.id === tab;
            return (
              <button
                key={tb.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tb.id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm whitespace-nowrap transition ${
                  active
                    ? "bg-accent text-[color:var(--on-accent)] font-semibold"
                    : "text-muted hover:text-foreground hover:bg-surface-2"
                }`}
              >
                {tb.label}
                {typeof tb.count === "number" && tb.count > 0 && (
                  <span
                    className={`text-[11px] rounded-full px-1.5 py-0.5 ${
                      active ? "bg-black/15" : "bg-surface-2 text-muted"
                    }`}
                    dir="ltr"
                  >
                    {tb.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "stats" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface border border-border rounded-2xl p-5">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-sm text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <Grouped entry={lists[tab]} showsLabel={t.libShowsGroup} moviesLabel={t.libMoviesGroup} />
      )}
    </div>
  );
}

function Grouped({
  entry,
  showsLabel,
  moviesLabel,
}: {
  entry: { items: LibraryEntry[]; empty: string };
  showsLabel: string;
  moviesLabel: string;
}) {
  const shows = entry.items.filter((i) => i.kind === "tv");
  const movies = entry.items.filter((i) => i.kind === "movie");

  if (entry.items.length === 0) {
    return <p className="text-center text-muted py-20">{entry.empty}</p>;
  }

  return (
    <div className="space-y-10">
      {shows.length > 0 && <Group title={showsLabel} items={shows} />}
      {movies.length > 0 && <Group title={moviesLabel} items={movies} />}
    </div>
  );
}

function Group({ title, items }: { title: string; items: LibraryEntry[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted mb-3">{title}</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {items.map((i) => (
          <PosterCard
            key={i.key}
            href={i.href}
            title={i.title}
            posterPath={i.posterPath}
            badge={i.badge}
            progress={i.progress}
          />
        ))}
      </div>
    </section>
  );
}
