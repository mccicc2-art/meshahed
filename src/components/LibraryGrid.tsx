"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { flashError } from "@/lib/toast";
import { runOrQueue } from "@/lib/offline";
import { coalescedRefresh } from "@/lib/refresh";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { startRewatch } from "@/lib/actions";
import type { UserList } from "@/lib/data";
import { PosterCard } from "./PosterCard";
import { SectionDivider } from "./SectionDivider";
import { LongPressable } from "./LongPressable";
import { ListManager } from "./ListManager";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { chipClass, segmentedItem, segmentedTrackFull } from "./ui/controls";
import { buttonClass } from "./ui/Button";

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
  /** حالة المشاهدة — تغذّي رقائق التقسيم (طلب المالك)؛ الصفحة تحسبها */
  status?: LibraryStatus;
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
export type LibraryTab = "shows" | "movies" | "lists";

/** حالات التقسيم — «أشاهدها» للمسلسلات وحدها؛ الفيلم يُشاهد أو لا */
export type LibraryStatus = "watching" | "unstarted" | "completed" | "dropped";

export function LibraryGrid({
  shows,
  movies,
  lists,
  locale,
  initialTab = "shows",
  listsExtra,
}: {
  shows: GridItem[];
  movies: GridItem[];
  lists: UserList[];
  locale: Locale;
  initialTab?: LibraryTab;
  /** ما يلي قوائمي في اللوح (القوائم المحفوظة — طلب أحمد: بيتها
      المكتبة لا صفحة منفصلة): يُرسم على الخادم ويُمرَّر عقدةً جاهزة،
      فيبقى PublicListsRail مكوّن خادمٍ بلا JS كما وُلد (D-063) */
  listsExtra?: React.ReactNode;
}) {
  const t = getDict(locale);
  const router = useRouter();
  /* التبويب يسكن الرابط لا الحالة وحدها (ذاكرة التنقل — تدقيق 8 Aug م١):
     useState وحده كان ينسى التبويب عند الرجوع من عملٍ مفتوح، فيهبط
     العائد على تبويبٍ غير الذي غادر منه. الآن: تفاؤلٌ محليّ فوريّ +
     push يكتب `?filter=` في التاريخ — فالرجوع يرجع للتبويب نفسه،
     والرابط يُشارك فيفتح على حالته. */
  const [pendingTab, setPendingTab] = useState<LibraryTab | null>(null);
  /* تصفير التفاؤل أثناء الرسم لا في effect (نمط React الموثّق لضبط
     الحالة عند تغيّر prop) — الرابط وصل فصار هو الحقيقة */
  const [lastInitial, setLastInitial] = useState(initialTab);
  if (lastInitial !== initialTab) {
    setLastInitial(initialTab);
    setPendingTab(null);
  }
  const tab = pendingTab ?? initialTab;
  function goTab(id: LibraryTab) {
    if (id === tab) return;
    setPendingTab(id);
    router.push(
      id === "shows" ? "/library" : `/library?filter=${id === "movies" ? "movie" : "list"}`,
      { scroll: false },
    );
  }
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"smart" | "title" | "progress">("smart");
  /* رقاقة الحالة (طلب المالك): «الكل» افتراضاً، والترشيح محليّ كالبحث */
  const [sheet, setSheet] = useState<GridItem | null>(null);

  /* البحث والفرز في الذاكرة: القائمة وصلت كاملةً من الخادم، فالحرف
     الواحد يصفّي فوراً بلا رحلة شبكة */
  const items = useMemo(() => {
    const base = tab === "movies" ? movies : shows;
    /* صفُّ رقائق الحالة حُذف بطلب المالك (نقض جزئي لـ D-078) —
       الفواصل المسمّاة بقيت، والشبكة تعرض الكل دائماً */
    const byStatus = base;
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? byStatus.filter((x) => x.title.toLowerCase().includes(needle))
      : byStatus;
    if (sort === "title") return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "progress")
      /* غير المكتمل أولاً (طلب أحمد 9 Aug): من يفرز بالتقدم يبحث عمّا
         يُكمله لا عمّا أنهاه — المكتمل ١٠٠٪ ذيلٌ، والباقي أعلاه تنازلياً */
      return [...filtered].sort((a, b) => {
        const ap = a.progress ?? 0;
        const bp = b.progress ?? 0;
        const aDone = ap >= 100 ? 1 : 0;
        const bDone = bp >= 100 ? 1 : 0;
        return aDone - bDone || bp - ap;
      });
    return filtered;
  }, [tab, shows, movies, q, sort]);

  /* عدّاد كل رقاقةٍ من التبويب الحاليّ — الرقم يجيب «كم عندي؟» قبل الضغط */


  const tabs = [
    { id: "shows" as const, icon: "tv" as const, label: t.shortShows, n: shows.length },
    { id: "movies" as const, icon: "film" as const, label: t.shortMovies, n: movies.length },
    { id: "lists" as const, icon: "list" as const, label: t.listsTitle, n: lists.length },
  ];

  return (
    <div>
      {/* ثلاثة تبويبات في مقسّمٍ واحد — نفس عائلة تبويبات صفحة العمل
          ومقسّم «اكتشف»: خطٌّ سفليّ بلون التمييز تحت المختار، والأيقونة
          والعدّاد يأخذان اللون نفسه.

          «القوائم» تبويبٌ حقيقيّ لا رابط: تبدّل اللوح في مكانه ولا تغادر
          الصفحة، فيبقى التبويبان الآخران ظاهرين ويظلّ التنقّل الثلاثيّ
          بنفس سلاسة التنقّل بين المسلسلات والأفلام — بلا تحميل مسارٍ جديد
          ولا وميض. وبما أن القوائم تُقرأ مع الصفحة صار عدّادُها مجّانيّاً،
          فاستوت الخانات الثلاث شكلاً ووزناً: `segmentedTrackFull` يقسّم
          العرض بالتساوي و`flex-1 basis-0` يمنع النصّ الأطول من توسيع خانته. */}
      <div className={`${segmentedTrackFull} mb-5`} role="tablist" aria-label={t.libraryTitle}>
        {tabs.map(({ id, icon, label, n }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`lib-tab-${id}`}
              aria-selected={active}
              aria-controls="lib-panel"
              onClick={() => goTab(id)}
              className={segmentedItem(
                active,
                "flex-1 basis-0 min-w-0 flex items-center justify-center gap-2 px-2 pt-1.5 pb-3 text-[13px]",
                false,
              )}
            >
              <Icon
                name={icon}
                size={16}
                className={`shrink-0 transition-colors ${active ? "text-accent" : ""}`}
              />
              <span className="truncate">{label}</span>
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

      <div id="lib-panel" role="tabpanel" aria-labelledby={`lib-tab-${tab}`}>
      {tab === "lists" ? (
        /* نفس تركيبة صفحة `/lists` حرفياً — لا نسخة ثانية منها: المسار
           يبقى قائماً للروابط المباشرة، وهذا اللوح يعرض المكوّنين
           نفسيهما (قوائمي ثم القوائم المحفوظة) */
        <div className="space-y-8">
          <ListManager lists={lists} locale={locale} />
          {listsExtra}
        </div>
      ) : (
      <>
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
        /* حالة موجهة لا جملة تشخّص (نمط D-106): الزر يحمل أول خطوة */
        <div className="text-center py-16 space-y-4">
          <p className="text-muted">{t.libraryEmpty}</p>
          <button
            type="button"
            onClick={() => router.push("/news")}
            className={buttonClass({ size: "sm" })}
          >
            {t.libraryEmptyCta}
          </button>
        </div>
      ) : (
        /* content-visibility: مكتبة من ٣٠٠ عمل كانت ٣٠٠ بطاقة مركّبة تُنسَّق
           كلها عند أول تمرير — الآن ما خرج عن الشاشة يُتخطّى رسمُه */
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 [&>*]:[content-visibility:auto] [&>*]:[contain-intrinsic-size:auto_240px]">
          {items.map((x, i) => (
            <Fragment key={x.key}>
              {/* فاصلٌ مسمّى عند تبدّل المجموعة (طلب المالك): الترتيب الذكي
                  يرصف الحالات متجاورةً أصلاً، فالحدّ بينها سطرُ عنوانٍ
                  بعرض الشبكة. يظهر في «الكل» بالترتيب الذكي وحده — الفرز
                  بالاسم أو التقدّم يخلط المجموعات فيصير الفاصل كذبة */}
              {sort === "smart" &&
                i > 0 &&
                x.status !== items[i - 1].status &&
                x.status && (
                  /* الكلمة في منتصف السطر لا في أوّله (طلب المالك) — المكوّن
                     المشترك SectionDivider. ويُستثنى من content-visibility
                     الموروثة: حجزُ ٢٤٠ بكسل لفاصلٍ ارتفاعه ٢٠ يجعل شريط
                     التمرير يقفز */
                  <SectionDivider
                    label={statusLabel(x.status, t)}
                    className="col-span-full pt-1"
                    style={{ contentVisibility: "visible", containIntrinsicSize: "auto" }}
                  />
                )}
              <LongPressable onLongPress={() => setSheet(x)}>
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
            </Fragment>
          ))}
        </div>
      )}
      </>
      )}
      </div>

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

type Dict = ReturnType<typeof getDict>;

/** اسم رقاقة الحالة نفسه يسمّي الفاصل — مفهومٌ واحد، اسمٌ واحد (D-026) */
function statusLabel(s: LibraryStatus, t: Dict): string {
  return s === "watching"
    ? t.libStatusWatching
    : s === "completed"
      ? t.libStatusCompleted
      : s === "unstarted"
        ? t.libStatusUnstarted
        : t.libStatusDropped;
}

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
