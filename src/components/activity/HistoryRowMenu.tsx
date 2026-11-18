"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { buttonClass } from "../ui/Button";
import { chipClass } from "../ui/controls";
import { v1Post } from "../InboxComposer";
import { HISTORY_WORDS } from "./historyWords";
import { flashError, toast } from "@/lib/toast";
import { dayKey, dayLabel, shiftDay, type ActivityItem } from "@/core/activityDays";
import { getDict, type Locale } from "@/core/i18n";
import type { MoveWatchDayBody, ToggleMovieBody, UnmarkEpisodesBody } from "@/core/contracts/track";

/**
 * ====== 🆕 تحريرُ السجلّ في الويب — قائمةُ الصفّ (التصميم «أ»، أحمد ١٨ نوفمبر) ======
 *
 * ما يفعله الضغطُ المطوَّلُ على صفِّ مشاهدةٍ في التطبيق (`apps/mobile/src/member/ActivityList.tsx`) بأبوابه نفسِها:
 * - **«غيّر يوم المشاهدة»**: آخرُ سبعة أيام رقائقَ، والساعةُ تبقى (`POST /api/v1/track/history-day` بالإزاحة بالأيام — الخادمُ يقصّ المستقبل).
 * - **«ما شفتها، احذفها من السجل»** بتأكيدٍ داخل القائمة نفسِها: الفيلمُ `track/movie {watched:false}`، والحلقاتُ بعينها
 *   (المدموجةُ كلُّها) `track/episodes-unmark`.
 * 🔑 **على الحاسوب ⋯ يظهر عند المرور** (الفأرةُ لا تضغط مطوّلاً)، وعلى اللمس ظاهرٌ دائماً. **قائمةٌ مثبَّتةٌ بجانب الصفّ لا نافذة**:
 * الفعلُ صغيرٌ والسجلُّ خلفه يبقى مقروءاً. وبعد الفعل تُعاد قراءةُ الصفحة من الخادم (`router.refresh`) فيقع الصفُّ في يومه الجديد.
 */
export function HistoryRowMenu({ item, locale, local, todayKey }: { item: ActivityItem; locale: Locale; local: boolean; todayKey: string }) {
  const t = getDict(locale);
  const w = HISTORY_WORDS[locale === "en" ? "en" : "ar"];
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "menu" | "day" | "confirm">("closed");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const open = mode !== "closed";

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setMode("closed");
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode("closed");
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const episodes =
    item.mediaType === "tv" ? (item.eps ?? (item.season != null && item.episode != null ? [{ s: item.season, e: item.episode }] : [])) : undefined;
  const from = dayKey(item.at, local);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      setMode("closed");
      router.refresh();
    } catch (e) {
      flashError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const moveTo = (key: string) => {
    const shiftDays = Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
    if (!shiftDays) return setMode("closed");
    void run(
      () =>
        v1Post("/api/v1/track/history-day", { mediaType: item.mediaType, tmdbId: item.tmdbId, episodes, shiftDays } satisfies MoveWatchDayBody, t),
      t.keepSaved,
    );
  };
  const remove = () =>
    void run(
      () =>
        item.mediaType === "movie"
          ? v1Post("/api/v1/track/movie", { movieTmdbId: item.tmdbId, runtime: null, watched: false } satisfies ToggleMovieBody, t)
          : v1Post("/api/v1/track/episodes-unmark", { showTmdbId: item.tmdbId, episodes: episodes ?? [] } satisfies UnmarkEpisodesBody, t),
      t.keepSaved,
    );

  const href = `/${item.mediaType === "tv" ? "show" : "movie"}/${item.tmdbId}`;
  const item_ = "flex w-full items-center gap-2.5 rounded-lg px-2.5 h-10 text-start text-sm transition hover:bg-surface-2";

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-label={w.more}
        aria-expanded={open}
        onClick={() => setMode(open ? "closed" : "menu")}
        className={`grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-muted transition hover:text-foreground ${
          open ? "opacity-100" : "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 focus-visible:opacity-100"
        }`}
      >
        <Icon name="dots" size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-10 z-30 w-[260px] rounded-2xl border border-border bg-[color:var(--elevated)] p-1.5 shadow-2xl"
        >
          {mode === "menu" && (
            <>
              <Link href={href} prefetch={false} role="menuitem" className={item_}>
                <Icon name={item.mediaType === "tv" ? "tv" : "film"} size={17} />
                <span className="truncate">{t.postMenuOpenTitle(item.title)}</span>
              </Link>
              <button type="button" role="menuitem" className={item_} onClick={() => setMode("day")}>
                <Icon name="calendar" size={17} />
                {t.historyMoveDay}
              </button>
              <span aria-hidden className="mx-2 my-1 block h-px bg-[color:var(--divider)]" />
              <button type="button" role="menuitem" className={`${item_} text-[color:var(--error)]`} onClick={() => setMode("confirm")}>
                <Icon name="trash" size={17} />
                {t.historyRemove}
              </button>
            </>
          )}
          {mode === "day" && (
            <div className="p-2">
              <p className="text-sm font-bold">{t.historyMoveDay}</p>
              <p className="mt-0.5 mb-2.5 text-12 text-muted">{t.historyMoveDayHint}</p>
              <div className={`flex flex-wrap gap-1.5 ${busy ? "pointer-events-none opacity-60" : ""}`}>
                {Array.from({ length: 7 }, (_, i) => shiftDay(todayKey, -i)).map((k, i) => (
                  <button key={k} type="button" className={chipClass(k === from, "sm")} onClick={() => moveTo(k)}>
                    {i === 0 ? t.diaryToday : i === 1 ? t.diaryYesterday : dayLabel(k, locale)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mode === "confirm" && (
            <div className="p-2">
              <p className="text-sm font-bold">{t.historyRemoveAction}</p>
              <p className="mt-1 text-12 text-muted leading-relaxed">{t.historyRemoveConfirm}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className={buttonClass({ variant: "ghost", size: "sm" })} onClick={() => setMode("closed")}>
                  {t.cancelLabel}
                </button>
                <button type="button" disabled={busy} className={buttonClass({ variant: "danger", size: "sm", className: "flex-1" })} onClick={remove}>
                  {t.historyRemoveAction}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
