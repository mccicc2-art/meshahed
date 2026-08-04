"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleEpisode, toggleMovieWatched } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

export interface ShowRow {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  /** الحلقة التالية غير المشاهَدة */
  season: number;
  episode: number;
  episodeName: string | null;
  /** كم حلقة معروضة باقية بعد هذه */
  remaining: number;
  runtime: number | null;
  started: boolean;
}

export interface ShowUpcomingRow {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  season: number;
  episode: number;
  episodeName: string | null;
  date: string;
  dayLabel: string;
  whenLabel: string;
}

export interface MovieRow {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  /** السنة للمشاهدة، والتاريخ الكامل للقادم */
  meta: string;
  /** كم بقي على الطرح — يظهر في طرف الصفّ */
  when?: string;
  groupLabel: string;
  runtime: number | null;
}

/**
 * المكتبة على هيئة قوائم لا شبكات.
 *
 * الشبكة تعرض ملصقات، وهذه الصفحة تُفتح لسؤالٍ واحد: «وش أشوف الحين؟».
 * فالصفّ يجيب مباشرةً — اسم العمل، الحلقة التالية بالضبط، كم باقٍ، وزرّ
 * تأشير واحد بجانبها. والتأشير يتمّ من هنا بلا فتح صفحة العمل.
 */
export function LibraryView({
  shows,
  showsUpcoming,
  movies,
  moviesUpcoming,
  locale,
  initialTab = "shows",
}: {
  shows: ShowRow[];
  showsUpcoming: ShowUpcomingRow[];
  movies: MovieRow[];
  moviesUpcoming: MovieRow[];
  locale: Locale;
  initialTab?: "shows" | "movies";
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [kind, setKind] = useState<"shows" | "movies">(initialTab);
  const [when, setWhen] = useState<"toWatch" | "upcoming">("toWatch");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  function markEpisode(r: ShowRow) {
    const key = `tv-${r.tmdbId}-${r.season}-${r.episode}`;
    setDone((p) => new Set(p).add(key));
    start(async () => {
      try {
        await toggleEpisode({
          showTmdbId: r.tmdbId,
          season: r.season,
          episode: r.episode,
          runtime: r.runtime,
          watched: true,
        });
        router.refresh();
      } catch {
        setDone((p) => {
          const n = new Set(p);
          n.delete(key);
          return n;
        });
      }
    });
  }

  function markMovie(r: MovieRow) {
    const key = `movie-${r.tmdbId}`;
    setDone((p) => new Set(p).add(key));
    start(async () => {
      try {
        await toggleMovieWatched({ movieTmdbId: r.tmdbId, runtime: r.runtime, watched: true });
        router.refresh();
      } catch {
        setDone((p) => {
          const n = new Set(p);
          n.delete(key);
          return n;
        });
      }
    });
  }

  const kinds: { key: "shows" | "movies"; label: string }[] = [
    { key: "shows", label: t.libShows },
    { key: "movies", label: t.libMovies },
  ];
  const whens: { key: "toWatch" | "upcoming"; label: string }[] = [
    { key: "toWatch", label: t.libToWatch },
    { key: "upcoming", label: t.libUpcoming },
  ];

  return (
    <div>
      {/* شريطان مقسّمان: الحبّة الممتلئة تقول أين أنت بلا حاجة لخطّ سفليّ
          أو لون نصّ وحده — وهي أوضح على الجوال من التبويب الخطّي */}
      <Segmented
        options={kinds}
        value={kind}
        onChange={(v) => setKind(v as "shows" | "movies")}
        size="lg"
      />

      <div className="mt-2 mb-4">
        <Segmented
          options={whens}
          value={when}
          onChange={(v) => setWhen(v as "toWatch" | "upcoming")}
          size="sm"
        />
      </div>

      {kind === "shows" && when === "toWatch" && (
        <Groups
          empty={t.libNothingToWatch}
          groups={[
            { label: t.libToWatch, rows: shows.filter((r) => r.started) },
            { label: t.libNotStartedGroup, rows: shows.filter((r) => !r.started) },
          ]}
          render={(r) => (
            <Row
              key={`s-${r.tmdbId}`}
              href={`/show/${r.tmdbId}`}
              poster={r.posterUrl}
              title={r.title}
              line1={
                <span className="flex items-baseline gap-2">
                  <span dir="ltr" className="font-bold">
                    S{String(r.season).padStart(2, "0")} | E{String(r.episode).padStart(2, "0")}
                  </span>
                  {r.remaining > 0 && (
                    <span className="text-muted text-xs" dir="ltr">
                      +{r.remaining}
                    </span>
                  )}
                </span>
              }
              line2={r.episodeName ?? undefined}
              action={
                done.has(`tv-${r.tmdbId}-${r.season}-${r.episode}`) ? (
                  <Check on />
                ) : (
                  <button onClick={() => markEpisode(r)} aria-label={t.markWatchedAria}>
                    <Check />
                  </button>
                )
              }
            />
          )}
        />
      )}

      {kind === "shows" && when === "upcoming" && (
        <Groups
          empty={t.libNothingUpcoming}
          groups={groupBy(showsUpcoming, (r) => r.dayLabel)}
          render={(r) => (
            <Row
              key={`u-${r.tmdbId}-${r.season}-${r.episode}`}
              href={`/show/${r.tmdbId}`}
              poster={r.posterUrl}
              title={r.title}
              line1={
                <span dir="ltr" className="font-bold">
                  S{String(r.season).padStart(2, "0")} | E{String(r.episode).padStart(2, "0")}
                </span>
              }
              line2={r.episodeName ?? t.libTba}
              action={<span className="text-[11px] text-accent-2 font-semibold">{r.whenLabel}</span>}
            />
          )}
        />
      )}

      {kind === "movies" && when === "toWatch" && (
        <Groups
          empty={t.libNothingToWatch}
          groups={[{ label: t.libToWatch, rows: movies }]}
          render={(r) => (
            <Row
              key={`m-${r.tmdbId}`}
              href={`/movie/${r.tmdbId}`}
              poster={r.posterUrl}
              title={r.title}
              line2={r.meta}
              action={
                done.has(`movie-${r.tmdbId}`) ? (
                  <Check on />
                ) : (
                  <button onClick={() => markMovie(r)} aria-label={t.markWatchedAria}>
                    <Check />
                  </button>
                )
              }
            />
          )}
        />
      )}

      {kind === "movies" && when === "upcoming" && (
        <Groups
          empty={t.libNothingUpcoming}
          groups={groupBy(moviesUpcoming, (r) => r.groupLabel)}
          render={(r) => (
            <Row
              key={`mu-${r.tmdbId}`}
              href={`/movie/${r.tmdbId}`}
              poster={r.posterUrl}
              title={r.title}
              line2={r.meta}
              action={
                <span className="text-[11px] text-accent-2 font-semibold text-center">
                  {r.when ?? ""}
                </span>
              }
            />
          )}
        />
      )}
    </div>
  );
}

/** شريط مقسّم: وعاء دائريّ وحبّة ممتلئة تتحرّك بين الخيارات */
function Segmented({
  options,
  value,
  onChange,
  size = "lg",
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: "lg" | "sm";
}) {
  return (
    <div className="flex rounded-full bg-surface border border-border p-1">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={on}
            className={`flex-1 rounded-full font-bold transition ${
              size === "lg" ? "py-2.5 text-sm" : "py-1.5 text-xs"
            } ${
              on
                ? "bg-accent text-[color:var(--on-accent)] shadow-lg shadow-black/20"
                : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return [...map.entries()].map(([label, rs]) => ({ label, rows: rs }));
}

function Groups<T>({
  groups,
  render,
  empty,
}: {
  groups: { label: string; rows: T[] }[];
  render: (r: T) => React.ReactNode;
  empty: string;
}) {
  const shown = groups.filter((g) => g.rows.length > 0);
  if (!shown.length) return <p className="text-sm text-muted text-center py-16">{empty}</p>;

  // شارة المجموعة تظهر حين تكون هناك مجموعتان فأكثر: مجموعة واحدة اسمها
  // اسم التبويب الذي فوقها، فتكرارها سطرٌ لا يضيف شيئاً
  const showLabels = shown.length > 1;

  return (
    <div className="space-y-5">
      {shown.map((g) => (
        <section key={g.label}>
          <div className={`flex justify-center mb-2 ${showLabels ? "" : "hidden"}`}>
            <span className="px-3 py-1 rounded-full bg-surface-2 text-[11px] font-bold tracking-wide text-muted">
              {g.label}
            </span>
          </div>
          <div className="space-y-2">{g.rows.map(render)}</div>
        </section>
      ))}
    </div>
  );
}

/** صفّ واحد: ملصق، اسم، سطر الحلقة، ثم الإجراء في الطرف */
function Row({
  href,
  poster,
  title,
  line1,
  line2,
  action,
}: {
  href: string;
  poster: string | null;
  title: string;
  line1?: React.ReactNode;
  line2?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-stretch gap-0 rounded-2xl bg-surface border border-border overflow-hidden">
      <Link href={href} prefetch={false} className="relative w-[68px] shrink-0 bg-surface-2">
        {poster ? (
          <Image src={poster} alt="" fill sizes="68px" className="object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted">
            <Icon name="film" size={18} />
          </span>
        )}
      </Link>

      <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <Link
            href={href}
            prefetch={false}
            className="inline-flex items-center gap-1 max-w-full text-accent text-[12px] font-bold hover:brightness-110"
          >
            <span className="truncate">{title}</span>
            <span className="shrink-0">›</span>
          </Link>
          {line1 && <p className="text-sm mt-0.5">{line1}</p>}
          {line2 && <p className="text-[12px] text-muted truncate mt-0.5">{line2}</p>}
        </div>

        <div className="shrink-0 grid place-items-center">{action}</div>
      </div>
    </div>
  );
}

/** دائرة التأشير — بيضاء ممتلئة كما في مراجع التتبّع، وتتحوّل عند التأشير */
function Check({ on = false }: { on?: boolean }) {
  return (
    <span
      className={`grid place-items-center w-11 h-11 rounded-full transition ${
        on
          ? "bg-accent-2 text-[color:var(--on-accent-2)]"
          : "bg-foreground text-[color:var(--background)] hover:brightness-90"
      }`}
    >
      <Icon name="check" size={20} />
    </span>
  );
}
