"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TrailerPlayback, useTrailerPlayback } from "./trailers/TrailerPlaybackController";
import { TrailerCardMedia } from "./trailers/TrailerCardMedia";
import { PosterRail } from "./PosterRail";
import { RailScroll } from "./RailScroll";
import { ShareTitleButton } from "./ShareTitleButton";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";
import { webWords } from "./webWords";
import { dismissTitle, moreTrailerClips, undoDismissTitle } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import {
  trailerClipKeyOf,
  trailerKeyOf,
  trailerTitleHref,
  useTrailerFollow,
  useTrailerSlots,
} from "@/lib/trailerCard";
import { getDict, type Locale } from "@/core/i18n";
import { TRAILER_FEED_LIMIT, TRAILER_PER_TITLE } from "@/core/trailerTabs";
import type { TrailerItem, TrailerScope } from "@/lib/trailers";
import type { TrailerFilterParams } from "@/core/trailerFilter";

/**
 * 🆕 R258 — **منصّةُ الترايلرات على الحاسوب** (أحمد ١٨ نوفمبر: «ب٢ ممتازة» ثمّ «وضع السينما» ثمّ «خل اربع فيديوهات
 * بعدين المزيد»). مقطعٌ واحدٌ كبيرٌ يعمل، وقائمةُ «التالي» بجواره (اكتشف) أو تحته (صفحة الترايلرات).
 *
 * 🔑 **والمصدرُ لم يتغيّر**: «ترايلرات لك» نفسُها (`getTrailerFeed` بنطاق التبويب) وعلفُ الصفحة نفسُه — هذا ثوبُ الحاسوب
 * لهما، والجوّالُ يبقى على الصفِّ والعلفِ الطوليّ كما هما (`desk:hidden` عند المنادي).
 *
 * 🔑 **ومشغّلٌ واحدٌ وخانةٌ واحدة**: البطاقةُ الكبيرةُ هي الخانةُ الوحيدةُ المسجّلةُ في `TrailerPlayback`، والقائمةُ صورٌ
 * وأزرار. اختيارُ عنصرٍ يبدّل البطاقةَ (مفتاحُها المقطع)، فيُطفئ المتحكّمُ القديمةَ ويُشغّل الجديدةَ بمنطقه هو — لا محرّكَ ثانٍ.
 *
 * ⚖️ **وملءُ الشاشة هنا حقيقيٌّ لا مسرحيّ**: التكبيرُ المسرحيُّ (D-762) بُني لأنّ iPhone يمنع ملءَ الشاشة الأصليّ، والحاسوبُ
 * لا يمنعه — فيُطلب للمنصّة كلِّها (`requestFullscreen`)، **والمتحكّمُ داخلَها** فطبقةُ المشغّل الثابتةُ تُرسم معها. وEsc
 * يخرج بيد المتصفّح، وF يبدّل، و«التالي» يكمل وأنت فيه.
 */

/** 🆕 R258 — «تلقائي»: نهايةُ المقطع تشغّل التالي. محفوظٌ في المتصفّح، وأصلُه «نعم» */
const AUTO_KEY = "loopz.trailer.auto";
const autoSubs = new Set<() => void>();
function readAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}
function writeAuto(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* تخزينٌ مقفول — يبقى الاختيارُ لهذه الجلسة فقط */
  }
  autoSubs.forEach((cb) => cb());
}
function useAutoplay(): boolean {
  return useSyncExternalStore(
    (cb) => {
      autoSubs.add(cb);
      return () => autoSubs.delete(cb);
    },
    readAuto,
    () => true,
  );
}

/** **قائمةُ اكتشف أربعةُ مقاطع ثمّ «المزيد»** (أحمد: «خل اربع فيديوهات بعدين المزيد») — والأوّلُ هو ما يعمل */
const DISCOVER_QUEUE = 4;

type StageProps = {
  items: TrailerItem[];
  locale: Locale;
  soundOn: boolean;
};

/** **اكتشف**: المنصّةُ تحت عنوان «ترايلرات لك» — القائمةُ بجوار المقطع و«الكل»/«المزيد» بابا صفحة الترايلرات */
export function TrailerStageDiscover({ items, locale, soundOn, scope }: StageProps & { scope: TrailerScope }) {
  const t = getDict(locale);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /* D-1300 بعينه: الإضافةُ تُبطل «اكتشف» فيُسقط العلفُ المتابَع — فالقائمةُ تثبت منذ أوّل إضافة، وتبديلُ التبويب يفكّها */
  const [pin, setPin] = useState<{ scope: TrailerScope; items: TrailerItem[] } | null>(null);
  if (pin && pin.scope !== scope) setPin(null);
  const shown = pin && pin.scope === scope ? pin.items : items;
  const origin = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const feedHref = (i?: TrailerItem) => {
    const params = new URLSearchParams({ scope, from: origin });
    if (i) params.set("at", trailerKeyOf(i));
    return `/trailers?${params.toString()}`;
  };

  return (
    <PosterRail bare title={t.trailersForYou} icon="play" href={feedHref()} seeAllLabel={t.seeAll}>
      <StageShell soundOn={soundOn}>
        <StageBody
          key={scope}
          items={shown}
          locale={locale}
          variant="discover"
          moreHref={feedHref()}
          onAdd={() => setPin((p) => p ?? { scope, items })}
        />
      </StageShell>
    </PosterRail>
  );
}

/** **صفحةُ الترايلرات — وضعُ السينما** (التصميم ج): المقطعُ كبيرٌ وصفُّ «التالي» تحته، والدفعاتُ تُجلب كعلف الجوّال */
export function TrailerStageCinema({
  items: served,
  locale,
  soundOn,
  tab,
  scope,
  filter,
}: StageProps & { tab?: string; scope?: string; filter?: TrailerFilterParams }) {
  /* حمولةُ العلف الأولى تثبت ما عاش المكوّن (D-1296) — والتبويبُ الجديدُ مكوّنٌ جديدٌ بمفتاح `Suspense` في الصفحة */
  const [items] = useState(served);
  return (
    <StageShell soundOn={soundOn}>
      <StageBody items={items} locale={locale} variant="cinema" feed={{ tab, scope, filter }} />
    </StageShell>
  );
}

/** **الجذرُ الذي يملأ الشاشة** — والمتحكّمُ داخلَه، فطبقتُه الثابتةُ (مشغّلُ يوتيوب) تدخل ملءَ الشاشة معه */
function StageShell({ soundOn, children }: { soundOn: boolean; children: React.ReactNode }) {
  return (
    <div className="lz-stage">
      <TrailerPlayback soundPref={soundOn}>{children}</TrailerPlayback>
    </div>
  );
}

function StageBody({
  items,
  locale,
  variant,
  moreHref,
  onAdd,
  feed,
}: {
  items: TrailerItem[];
  locale: Locale;
  variant: "discover" | "cinema";
  moreHref?: string;
  onAdd?: () => void;
  feed?: { tab?: string; scope?: string; filter?: TrailerFilterParams };
}) {
  const t = getDict(locale);
  const w = webWords(locale);
  const api = useTrailerPlayback();
  const auto = useAutoplay();
  const { added, addToList, removeFromList } = useTrailerFollow();
  const [extra, setExtra] = useState<TrailerItem[]>([]);
  const all = extra.length ? [...items, ...extra] : items;
  const { slots, retire } = useTrailerSlots(all, (variant === "cinema" ? 40 : 6) + extra.length);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const shown = gone.size ? slots.filter((i) => !gone.has(trailerKeyOf(i))) : slots;
  /* **الموضعُ رقمٌ لا مفتاح**: مقطعٌ يرفضه يوتيوب يُستبدل في خانته (D-756) و«ليس لي» يطوي عملَه — وفي الحالين يعمل ما صار في
     الموضع نفسه، وهو التالي. */
  const [at, setAt] = useState(0);
  const idx = Math.min(at, Math.max(0, shown.length - 1));
  const cur = shown[idx];
  const curKey = cur ? trailerClipKeyOf(cur) : "";

  /* ---- ملءُ الشاشة الحقيقيّ ---- */
  const root = useRef<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => setFull(!!root.current && document.fullscreenElement === root.current.closest(".lz-stage"));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFull = useCallback(() => {
    const el = root.current?.closest(".lz-stage") as HTMLElement | null;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen?.().catch(() => {});
  }, []);

  /* **ضغطةُ قائمةٍ إيماءةُ مستخدم** — تُحمل إلى المقطع الجديد بعد تسجيله (يفكّ الصوتَ حيث يمنعه المتصفّح آليّاً) */
  const tapNext = useRef<string | null>(null);
  const go = (n: number, tapped: boolean) => {
    const target = shown[n];
    if (!target) return;
    if (tapped) tapNext.current = trailerClipKeyOf(target);
    setAt(n);
  };
  useEffect(() => {
    if (curKey && tapNext.current === curKey) {
      tapNext.current = null;
      api.tapPlay(curKey);
    }
  }, [api, curKey]);

  /* ---- «تلقائي»: نهايةُ المقطع تشغّل التالي ----
     ⚠️ **النهايةُ تُقرأ من اللقطة لا من حدثٍ جديدٍ في المتحكّم**: `ENDED` يُوقف الطورَ ويكتب الوقتَ عند آخره، فتوقّفٌ في الثانية
     الأخيرة هو النهاية. **والملفّاتُ تدور (`loop`) فلا تنتهي** — وهي قليلةٌ في العلف. */
  const live = useRef({ curKey, auto, idx, len: shown.length });
  useEffect(() => {
    live.current = { curKey, auto, idx, len: shown.length };
  });
  const endedFor = useRef<string | null>(null);
  useEffect(
    () =>
      api.subscribe(() => {
        const s = api.getSnapshot();
        const l = live.current;
        if (!l.auto || s.activeId !== l.curKey || s.phase !== "paused" || !s.time || s.time.total <= 0) return;
        if (s.time.total - s.time.now > 1.2 || endedFor.current === l.curKey) return;
        endedFor.current = l.curKey;
        if (l.idx + 1 < l.len) setAt(l.idx + 1);
      }),
    [api],
  );

  /* ---- F يبدّل ملءَ الشاشة، والسهمان في ملئها يتنقّلان ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      /* منصّةٌ مخفيّة (الجوّال، أو صفحةٌ أخرى في الشجرة) لا تسمع */
      if (!root.current || root.current.offsetParent === null) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFull();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFull]);

  /* ---- الدفعاتُ التالية (السينما) — وصفةُ العلف نفسُها (`TrailerFeed`) ---- */
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const nearEnd = variant === "cinema" && !done && shown.length > 0 && idx >= shown.length - 6;
  useEffect(() => {
    /* منصّةٌ مخفيّة (عرضُ الجوّال) لا تجلب ما لن يُرى */
    if (!nearEnd || busy.current || !root.current || root.current.offsetParent === null) return;
    busy.current = true;
    moreTrailerClips({
      tab: feed?.tab,
      scope: feed?.scope,
      filter: feed?.filter,
      page: page + 1,
      perTitle: TRAILER_PER_TITLE,
      limit: TRAILER_FEED_LIMIT,
    })
      .then((next) => {
        if (!next.length) return setDone(true);
        setPage((p) => p + 1);
        setExtra((previous) => {
          const seen = new Set([...items, ...previous].map(trailerClipKeyOf));
          return [...previous, ...next.filter((x) => !seen.has(trailerClipKeyOf(x)))];
        });
      })
      .catch(() => {})
      .finally(() => {
        busy.current = false;
      });
  }, [nearEnd, feed?.tab, feed?.scope, feed?.filter, page, items]);

  function notForMe(i: TrailerItem) {
    const k = trailerKeyOf(i);
    setGone((previous) => new Set(previous).add(k));
    dismissTitle({ tmdbId: i.tmdbId, mediaType: i.mediaType }).catch((e) => flashError((e as Error).message));
    toast(t.dismissedToast, {
      tone: "info",
      action: {
        label: t.undoWatched,
        run: () => {
          setGone((previous) => {
            const next = new Set(previous);
            next.delete(k);
            return next;
          });
          undoDismissTitle({ tmdbId: i.tmdbId, mediaType: i.mediaType }).catch(() => {});
        },
      },
    });
  }

  if (!cur) return null;
  const isAdded = added.has(trailerKeyOf(cur));
  const meta = [cur.year, cur.genre, cur.country].filter(Boolean).join(" · ");
  /* أزرارُ ما فوق الصورة: بيضاءُ ثابتةٌ لا رموزُ السمة — الصورةُ داكنةٌ في النهار أيضاً (وصفةُ D-1291 في التكبير) */
  const glass =
    "pointer-events-auto inline-flex h-10 items-center gap-2 rounded-control bg-black/55 px-4 text-14 font-semibold text-white backdrop-blur-sm transition hover:bg-black/70 active:scale-[0.98]";

  const stage = (
    <div
      ref={root}
      className="lz-stage-card relative min-w-0 overflow-hidden rounded-2xl border border-border bg-background"
      style={variant === "cinema" ? { width: "min(100%, calc((100dvh - 24rem) * 16 / 9))", marginInline: "auto" } : undefined}
    >
      <TrailerCardMedia
        key={curKey}
        id={curKey}
        item={{ keys: cur.videoKeys, fileUrl: cur.fileUrl, title: cur.title }}
        backdrop={cur.backdrop}
        title={cur.title}
        eager
        playLabel={t.trailerPlay}
        pauseLabel={t.trailerPause}
        muteLabel={t.trailerMute}
        unmuteLabel={t.trailerUnmute}
        seekLabel={t.trailerSeek}
        volumeLabel={t.trailerVolume}
        onUnavailable={() => retire(curKey)}
        unavailableLabel={!cur.videoKeys.length && !cur.fileUrl ? t.trailerUnavailable : null}
      />
      {/* ⤢ ظاهرٌ دائماً — على الحاسوب لا لمسةَ تكشف الأدوات، والبابُ لا يُخبّأ خلف نقرة */}
      <button
        type="button"
        onClick={toggleFull}
        aria-label={full ? w.trailerExitFullscreen : w.trailerFullscreen}
        title={`${full ? w.trailerExitFullscreen : w.trailerFullscreen} (F)`}
        className="absolute start-2.5 top-2.5 z-50 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70 active:opacity-70"
      >
        <Icon name={full ? "close" : "expand"} size={17} />
      </button>
      {/* الاسمُ والأفعالُ فوق المقطع — وفوق شريط التقديم بمسافته، فلا يغطّيه حين يظهر */}
      <div className="lz-stage-cap pointer-events-none absolute inset-x-0 bottom-0 z-50 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-5 pb-12 pt-16">
        <div className="flex items-end gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h2 className="truncate text-24 font-extrabold text-white" dir="auto">
                {cur.title}
              </h2>
              {cur.clipLabel ? (
                <span className="shrink-0 rounded-full bg-black/55 px-2.5 py-0.5 text-12 font-semibold text-white/85">
                  {cur.clipLabel}
                </span>
              ) : null}
            </div>
            {meta ? <p className="mt-0.5 truncate text-14 text-white/75">{meta}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-pressed={isAdded}
              onClick={() => {
                if (isAdded) return removeFromList(cur);
                onAdd?.();
                addToList(cur);
              }}
              className={buttonClass({ size: "md", className: "pointer-events-auto h-10" })}
            >
              <Icon name={isAdded ? "check" : "plus"} size={17} />
              {t.trailerMyList}
            </button>
            <Link href={trailerTitleHref(cur)} prefetch={false} className={glass}>
              <Icon name="info" size={17} />
              {t.trailerDetails}
            </Link>
            {variant === "cinema" ? (
              <>
                <ShareTitleButton
                  path={trailerTitleHref(cur)}
                  title={cur.title}
                  locale={locale}
                  label={t.shareLinkLabel}
                  className={`${glass} !text-white`}
                />
                <button
                  type="button"
                  onClick={() => notForMe(cur)}
                  aria-label={t.trailerNotForMe}
                  title={t.trailerNotForMe}
                  className={`${glass} w-10 justify-center !px-0`}
                >
                  <Icon name="eye-off" size={17} />
                </button>
              </>
            ) : null}
            {/* في ملء الشاشة لا قائمةَ تُرى — فالتالي زرٌّ هنا */}
            {full && idx + 1 < shown.length ? (
              <button type="button" onClick={() => go(idx + 1, true)} className={glass}>
                {w.trailerUpNext}
                <Icon name="play" size={15} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === "discover") {
    const queue = shown.slice(idx, idx + DISCOVER_QUEUE);
    return (
      <div className="lz-stage-split grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4">
        {stage}
        <aside className="lz-stage-queue min-w-0">
          <h3 className="mb-2 text-14 font-bold text-muted">{w.trailerUpNext}</h3>
          <ol className="space-y-2">
            {queue.map((i, n) => (
              <li key={trailerClipKeyOf(i)}>
                <QueueRow item={i} on={n === 0} onPick={() => go(idx + n, true)} playingLabel={t.trailerPlay} />
              </li>
            ))}
          </ol>
          {moreHref ? (
            <Link
              href={moreHref}
              prefetch={false}
              className="mt-2 flex h-11 items-center justify-center rounded-2xl border border-border text-[13px] font-bold text-accent transition hover:border-accent"
            >
              {w.trailerMore}
            </Link>
          ) : null}
        </aside>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stage}
      <div className="lz-stage-queue">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-15 font-bold">{w.trailerUpNext}</h3>
          <button
            type="button"
            aria-pressed={auto}
            onClick={() => writeAuto(!auto)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-12 font-semibold transition ${
              auto ? "text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon name={auto ? "check" : "repeat"} size={14} />
            {w.trailerAutoplay}
          </button>
        </div>
        <RailScroll prevLabel="السابق / Previous" nextLabel="التالي / Next" mouseDrag>
          {shown.map((i, n) => (
            <div key={trailerClipKeyOf(i)} className="w-[220px] shrink-0 snap-start">
              <QueueTile item={i} on={n === idx} onPick={() => go(n, true)} />
            </div>
          ))}
        </RailScroll>
      </div>
    </div>
  );
}

/** صفٌّ في قائمة اكتشف: الصورةُ في البداية والاسمُ والسطرُ الثاني بجوارها — والعاملُ محاطٌ بلون التمييز */
function QueueRow({
  item,
  on,
  onPick,
  playingLabel,
}: {
  item: TrailerItem;
  on: boolean;
  onPick: () => void;
  playingLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={on ? "true" : undefined}
      aria-label={on ? undefined : `${playingLabel}: ${item.title}`}
      className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-start transition ${
        on ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/60"
      }`}
    >
      <span className="relative aspect-video w-[120px] shrink-0 overflow-hidden rounded-xl bg-surface-2">
        {item.backdrop ? <Image src={item.backdrop} alt="" fill sizes="120px" className="object-cover" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-14 font-bold" dir="auto">
          {item.title}
        </b>
        <span className="mt-0.5 block truncate text-12 text-muted">
          {[item.clipLabel, item.year, item.genre].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
}

/** بلاطةٌ في صفِّ السينما: صورةٌ عريضةٌ ثمّ الاسمُ والسطرُ الثاني تحتها */
function QueueTile({ item, on, onPick }: { item: TrailerItem; on: boolean; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} aria-current={on ? "true" : undefined} className="block w-full text-start">
      <span
        className={`relative block aspect-video overflow-hidden rounded-xl bg-surface-2 ring-2 transition ${
          on ? "ring-accent" : "ring-transparent hover:ring-accent/50"
        }`}
      >
        {item.backdrop ? <Image src={item.backdrop} alt="" fill sizes="220px" className="object-cover" /> : null}
        {item.clipLabel ? (
          <span className="absolute bottom-1.5 end-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {item.clipLabel}
          </span>
        ) : null}
      </span>
      <b className="mt-1.5 block truncate text-14 font-bold" dir="auto">
        {item.title}
      </b>
      <span className="block truncate text-12 text-muted">{[item.year, item.genre].filter(Boolean).join(" · ")}</span>
    </button>
  );
}
