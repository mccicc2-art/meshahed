"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import {
  markNextEpisode,
  markShowWatched,
  setDropped,
  startRewatch,
  toggleMovieWatched,
} from "@/lib/actions";
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
  /** مكتملٌ — يفتح خيار «أشاهده من جديد» */
  completed?: boolean;
  /** للإجراءات السريعة بالضغطة المطوّلة */
  tmdbId?: number;
  mediaType?: "tv" | "movie";
}

/**
 * المكتبة: تبويبان لا أربعة.
 *
 * «للمشاهدة» و«القادم» انتقلا إلى الرئيسية صفوفاً أفقية، فبقيت المكتبة
 * لما هي له: كل ما تتابعه. تبويبٌ للمسلسلات وتبويبٌ للأفلام، وكلٌّ
 * منهما شبكةُ ملصقاتٍ رأسية — ثلاثة في الصفّ على الجوال وتتّسع مع
 * الشاشة — لأن سؤال المكتبة «ماذا عندي؟» وجوابه يُقرأ بالأغلفة لا
 * بالصفوف.
 *
 * والضغطة المطوّلة على أي بطاقة تفتح لوح إجراءاتٍ سريعة: «+١ الحلقة
 * التالية» و«شفته كله» والبطاقة الحمراء — أقوى عادات TV Time، بلا فتح
 * صفحة العمل.
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
  const router = useRouter();
  const [tab, setTab] = useState<"shows" | "movies">(initialTab);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"smart" | "title" | "progress">("smart");
  const [sheet, setSheet] = useState<GridItem | null>(null);

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
      <div className="flex items-center gap-2 mb-2">
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

      <p className="text-[10px] text-muted/80 mb-4">{t.longPressHint}</p>

      {items.length === 0 ? (
        <p className="text-center text-muted py-16">{t.libraryEmpty}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {items.map((x) => (
            <LongPressable key={x.key} onLongPress={() => setSheet(x)}>
              <PosterCard
                href={x.href}
                title={x.title}
                posterPath={x.posterPath}
                progress={x.progress}
                badge={x.badge}
                badgeTone={x.badgeTone}
                count={x.count}
                dropped={x.dropped}
              />
            </LongPressable>
          ))}
        </div>
      )}

      {sheet && (
        <QuickActions
          item={sheet}
          t={t}
          onClose={() => setSheet(null)}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}

/**
 * غلاف الضغطة المطوّلة.
 *
 * ٤٥٠ مللي ثانية بلا حركةٍ تُطلق الإجراء وتبتلع النقرة التالية حتى لا
 * يفتح الرابط. التحرّك أكثر من ١٠ بكسل يُلغي — فالتمرير يبقى تمريراً.
 */
function LongPressable({
  onLongPress,
  children,
}: {
  onLongPress: () => void;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }

  return (
    <div
      className="select-none"
      style={{ WebkitTouchCallout: "none" }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          fired.current = true;
          // اهتزازة خفيفة تؤكّد أن الضغطة «مسكت» — حيث يدعمها الجهاز
          try {
            navigator.vibrate?.(12);
          } catch {
            /* لا شيء */
          }
          onLongPress();
        }, 450);
      }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        const dx = e.clientX - origin.current.x;
        const dy = e.clientY - origin.current.y;
        if (dx * dx + dy * dy > 100) clear();
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onClickCapture={(e) => {
        if (fired.current) {
          e.preventDefault();
          e.stopPropagation();
          fired.current = false;
        }
      }}
    >
      {children}
    </div>
  );
}

type Dict = ReturnType<typeof getDict>;

/** لوح الإجراءات السريعة — يطفو من الأسفل فوق الشبكة */
function QuickActions({
  item,
  t,
  onClose,
  onDone,
}: {
  item: GridItem;
  t: Dict;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<string | null>) {
    start(async () => {
      try {
        const label = await fn();
        setMsg(label ?? "✓");
        onDone();
        setTimeout(onClose, 900);
      } catch {
        setMsg("✗");
        setTimeout(onClose, 900);
      }
    });
  }

  const isTv = item.mediaType === "tv";
  const btn =
    "flex items-center gap-3 w-full text-start px-5 py-3.5 text-sm font-semibold transition active:bg-white/[0.06] disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label=""
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="sheet-pop relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-border bg-[color:var(--surface)] shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="px-5 pt-4 pb-3 border-b border-[color:var(--divider)]">
          <p className="text-sm font-bold truncate">{item.title}</p>
          {msg && (
            <p role="status" className="text-xs text-[color:var(--success)] mt-1">
              {msg}
            </p>
          )}
        </div>

        {item.dropped ? (
          /* عملٌ موقوف: الإجراء الوحيد المنطقي هو التراجع عن الإيقاف */
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                await setDropped(item.tmdbId!, item.mediaType!, false);
                return "✓";
              })
            }
            className={btn}
          >
            <Icon name="play" size={19} className="text-accent shrink-0" />
            {t.undoWatched}
          </button>
        ) : (
          <>
            {isTv && !item.completed && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const r = await markNextEpisode(item.tmdbId!);
                    return r ? t.markedEp(r.season, r.episode) : t.watchedBadge;
                  })
                }
                className={btn}
              >
                <Icon name="play" size={19} className="text-accent shrink-0" />
                {t.markNextEp}
              </button>
            )}

            {/* عملٌ مكتمل: بابه «أشاهده من جديد» — دورةٌ جديدة واليوميات سليمة */}
            {isTv && item.completed && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await startRewatch(item.tmdbId!);
                    return "🔁 ✓";
                  })
                }
                className={btn}
              >
                <span className="text-[17px] shrink-0" aria-hidden>
                  🔁
                </span>
                {t.rewatchBtn}
              </button>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  if (isTv) await markShowWatched(item.tmdbId!);
                  else
                    await toggleMovieWatched({
                      movieTmdbId: item.tmdbId!,
                      runtime: null,
                      watched: true,
                    });
                  return "🏁 ✓";
                })
              }
              className={`${btn} border-t border-[color:var(--divider)]`}
            >
              <Icon name="check" size={19} className="text-[color:var(--success)] shrink-0" />
              {t.markAllWatched}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await setDropped(item.tmdbId!, item.mediaType!, true);
                  return "✓";
                })
              }
              className={`${btn} border-t border-[color:var(--divider)]`}
            >
              <Icon name="card" size={19} className="text-[color:var(--error)] shrink-0" />
              {t.dropTitle}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
