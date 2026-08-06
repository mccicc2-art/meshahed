"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { flashError } from "@/lib/toast";
import { runOrQueue } from "@/lib/offline";
import { tap } from "@/lib/haptics";
import { coalescedRefresh } from "@/lib/refresh";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { startRewatch } from "@/lib/actions";
import { PosterCard } from "./PosterCard";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { chipClass, segmentedItem, segmentedTrackFull } from "./ui/controls";

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
      {/* تبويبان في مقسّمٍ واحد — نفس عائلة تبويبات صفحة العمل ومقسّم
          «اكتشف»: خطٌّ سفليّ بلون التمييز تحت المختار، والأيقونة والعدّاد
          يأخذان اللون نفسه */}
      <div className={`${segmentedTrackFull} mb-5`} role="tablist">
        {tabs.map(({ id, icon, label, n }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={segmentedItem(
                active,
                "flex-1 flex items-center justify-center gap-2 px-2 pt-1.5 pb-3 text-[13px]",
                false,
              )}
            >
              <Icon
                name={icon}
                size={16}
                className={`shrink-0 transition-colors ${active ? "text-accent" : ""}`}
              />
              {label}
              <span
                className={`text-[11px] tabular-nums transition-colors ${
                  active ? "text-accent" : "opacity-80"
                }`}
                dir="ltr"
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* بحثٌ وفرز: سطرٌ واحد تحت التبويبين */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 start-3 grid place-items-center text-muted pointer-events-none">
            <Icon name="search" size={16} />
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
              className={chipClass(sort === id, "sm")}
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
        /* content-visibility: مكتبة من ٣٠٠ عمل كانت ٣٠٠ بطاقة مركّبة تُنسَّق
           كلها عند أول تمرير — الآن ما خرج عن الشاشة يُتخطّى رسمُه */
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 [&>*]:[content-visibility:auto] [&>*]:[contain-intrinsic-size:auto_240px]">
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
          onDone={() => coalescedRefresh(router)}
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
          tap(12);
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

  /**
   * تفاؤلي بالكامل: العلامة تظهر في نفس اللحظة واللوح يُغلق، والخادم
   * يلحق في الخلفية — كانت هذه الواجهة الوحيدة التي تُبقي المستخدم
   * يحدّق في زرٍّ معتم ٤٠٠–١٢٠٠ مللي ثانية، وهي أميز تفاعلٍ في التطبيق.
   * الفشل يظهر توستاً، والتجديد المُجمَّع يصحّح أي تفاؤلٍ كاذب.
   */
  function run(label: string, fn: () => Promise<unknown>) {
    setMsg(label);
    onDone();
    setTimeout(onClose, 650);
    start(async () => {
      try {
        await fn();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  const isTv = item.mediaType === "tv";
  const btn =
    "flex items-center gap-3 w-full text-start px-5 py-3.5 text-sm font-semibold transition active:bg-surface-2 disabled:opacity-40";

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="quick-actions-title">
      <SheetHeader id="quick-actions-title" title={item.title} closeLabel={t.closeLabel} onClose={onClose}>
        {msg && (
          <p role="status" className="text-xs text-[color:var(--success)] mt-1">
            {msg}
          </p>
        )}
      </SheetHeader>

        {item.dropped ? (
          /* عملٌ موقوف: الإجراء الوحيد المنطقي هو التراجع عن الإيقاف */
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run("✓", () => runOrQueue("setDropped", item.tmdbId!, item.mediaType!, false))
            }
            className={btn}
          >
            <Icon name="play" size={20} className="text-accent shrink-0" />
            {t.undoWatched}
          </button>
        ) : (
          <>
            {isTv && !item.completed && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run("✓", () => runOrQueue("markNextEpisode", item.tmdbId!))
                }
                className={btn}
              >
                <Icon name="play" size={20} className="text-accent shrink-0" />
                {t.markNextEp}
              </button>
            )}

            {/* عملٌ مكتمل: بابه «أشاهده من جديد» — دورةٌ جديدة واليوميات سليمة */}
            {isTv && item.completed && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run("✓", () => startRewatch(item.tmdbId!))
                }
                className={btn}
              >
                <Icon name="repeat" size={20} className="text-accent shrink-0" />
                {t.rewatchBtn}
              </button>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run("✓", () =>
                  isTv
                    ? runOrQueue("markShowWatched", item.tmdbId!)
                    : runOrQueue("toggleMovieWatched", {
                        movieTmdbId: item.tmdbId!,
                        runtime: null,
                        watched: true,
                      }),
                )
              }
              className={`${btn} border-t border-[color:var(--divider)]`}
            >
              <Icon name="check" size={20} className="text-[color:var(--success)] shrink-0" />
              {t.markAllWatched}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run("✓", () => runOrQueue("setDropped", item.tmdbId!, item.mediaType!, true))
              }
              className={`${btn} border-t border-[color:var(--divider)]`}
            >
              <Icon name="card" size={20} className="text-[color:var(--error)] shrink-0" />
              {t.dropTitle}
            </button>
          </>
        )}
    </Sheet>
  );
}
