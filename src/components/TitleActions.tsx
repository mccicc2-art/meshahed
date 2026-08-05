"use client";

import Link from "next/link";
import { flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/lib/refresh";
import { tap } from "@/lib/haptics";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { follow, unfollow, toggleInList, markShowWatched, toggleMovieWatched } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";

/**
 * صفّ الإجراء الرئيسي في صفحة العمل: «أضف لقائمة» + دائرة «شاهدتُه».
 *
 * زرّ المتابعة الكبير حُذف: المتابعة صارت أول صفٍّ داخل ورقة القوائم
 * («للمشاهدة» قائمةٌ مثبّتة فوق قوائم المستخدم)، فالنموذج الذهني واحد —
 * كل شيء إضافة إلى قائمة. والدائرة تؤشّر العمل كله مُشاهَداً بعد ورقة
 * تأكيد زجاجية تعرض العدد، فلا يقع ٢٥٦ حلقة بضغطة خاطئة.
 */
export function TitleActions({
  tmdbId,
  mediaType,
  title,
  posterPath,
  locale,
  initialFollowing,
  lists,
  containing,
  episodesTotal,
  runtime,
  initialDone,
}: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  locale: Locale;
  initialFollowing: boolean;
  lists: { id: string; name: string }[];
  containing: string[];
  /** عدد الحلقات المعروضة — للمسلسلات فقط، يظهر في زرّ التأكيد */
  episodesTotal: number | null;
  /** مدّة الفيلم — تُسجَّل مع «شاهدتُه» */
  runtime: number | null;
  /** مُشاهَد بالكامل عند فتح الصفحة */
  initialDone: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [inLists, setInLists] = useState<Set<string>>(new Set(containing));
  const [done, setDone] = useState(initialDone);
  const [sheet, setSheet] = useState<null | "lists" | "watch">(null);
  const [pending, start] = useTransition();

  const badge = inLists.size + (following ? 1 : 0);

  function toggleFollow() {
    const was = following;
    setFollowing(!was);
    tap(10);
    start(async () => {
      try {
        if (was) await unfollow({ tmdbId, mediaType });
        else await follow({ tmdbId, mediaType, title, posterPath });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        setFollowing(was);
      }
    });
  }

  function toggleList(listId: string) {
    const add = !inLists.has(listId);
    setInLists((prev) => {
      const next = new Set(prev);
      if (add) next.add(listId);
      else next.delete(listId);
      return next;
    });
    start(async () => {
      try {
        await toggleInList({ listId, tmdbId, mediaType, title, posterPath, add });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        setInLists((prev) => {
          const next = new Set(prev);
          if (add) next.delete(listId);
          else next.add(listId);
          return next;
        });
      }
    });
  }

  /** التأشير الكامل — وإن لم يكن متابِعاً تابَعناه أولاً كي يظهر في مكتبته */
  function confirmWatch(mark: boolean) {
    setSheet(null);
    setDone(mark);
    tap(mark ? [12, 40, 12] : 10);
    start(async () => {
      try {
        if (mark && !following) {
          await follow({ tmdbId, mediaType, title, posterPath });
          setFollowing(true);
        }
        if (mediaType === "tv") {
          if (mark) await markShowWatched(tmdbId);
        } else {
          await toggleMovieWatched({ movieTmdbId: tmdbId, runtime, watched: mark });
        }
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        setDone(!mark);
      }
    });
  }

  // زرّ داخل الورقة: سطحٌ ثانوي يملأ العرض — الرتبة الثانية بعد الفعل
  // الأول في الشاشة نفسها، فلا يزاحمه بلون الهوية
  const sheetBtn = buttonClass({ variant: "surface", size: "lg", full: true });

  return (
    <>
      <div className="flex items-center gap-3">
        {/* أضف لقائمة: أبيض قبل الإضافة، وبلون الهوية بعدها — اللون هو
            الإشارة لا رقمٌ يحتاج تفسيراً، والعلامة تمتلئ معه */}
        <button
          onClick={() => setSheet("lists")}
          aria-pressed={badge > 0}
          className={`flex-1 h-12 rounded-full font-bold text-[15px] flex items-center justify-center gap-2.5 active:scale-[0.98] transition ${
            badge > 0
              ? "bg-accent text-[color:var(--on-accent)] shadow-[0_10px_28px_rgba(124,58,237,0.35)] hover:brightness-110"
              : "bg-[color:var(--surface-inverse)] text-[color:var(--on-surface-inverse)] shadow-[0_10px_28px_rgba(0,0,0,0.28)] hover:brightness-95"
          }`}
        >
          <Icon
            name="bookmark"
            size={18}
            strokeWidth={2.2}
            style={badge > 0 ? { fill: "currentColor" } : undefined}
          />
          {t.listAddTo}
        </button>

        {/* دائرة «شاهدتُه كله» */}
        <button
          onClick={() => setSheet("watch")}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? t.allWatchedShort : t.markAllTitle}
          title={done ? t.allWatchedShort : t.markAllTitle}
          className={`w-12 h-12 shrink-0 rounded-full grid place-items-center border-[1.5px] active:scale-95 transition ${
            done
              ? "border-transparent bg-[color:var(--success)]/15 text-[color:var(--success)]"
              : "border-border text-foreground/85 hover:border-accent/60"
          }`}
        >
          <Icon name="check-line" size={20} strokeWidth={2.2} className={done ? "check-pop" : ""} />
        </button>
      </div>

      {/* ورقة القوائم */}
      <Sheet
        open={sheet === "lists"}
        onClose={() => setSheet(null)}
        closeLabel={t.closeLabel}
        variant="center"
        labelledBy="lists-sheet-title"
      >
        <>
          <p id="lists-sheet-title" className="text-center font-bold text-[15px] pt-5 pb-3">
            {t.listAddTo}
          </p>

            {/* «للمشاهدة» — المتابعة بثوب القائمة المثبّتة */}
            <button
              onClick={toggleFollow}
              className="w-full flex items-center gap-3 px-5 py-3 text-start hover:bg-surface-2 transition"
            >
              <span
                className={`grid place-items-center w-[22px] h-[22px] rounded-full border-[1.5px] shrink-0 transition ${
                  following
                    ? "bg-accent border-accent text-[color:var(--on-accent)]"
                    : "border-border text-transparent"
                }`}
              >
                <Icon name="check-line" size={14} strokeWidth={2.2} />
              </span>
              <span className="text-[14px] font-semibold flex items-center gap-2">
                <Icon name="bookmark" size={16} className="text-muted" />
                {t.libToWatch}
              </span>
            </button>

            <div className="h-px bg-[color:var(--divider)] mx-5 my-1" />

            {lists.length === 0 ? (
              <p className="px-5 py-3 text-xs text-muted">
                {t.listNoLists}{" "}
                <Link href="/lists" className="text-accent hover:brightness-110">
                  {t.listsTitle}
                </Link>
              </p>
            ) : (
              <ul className="max-h-52 overflow-y-auto">
                {lists.map((l) => {
                  const on = inLists.has(l.id);
                  return (
                    <li key={l.id}>
                      <button
                        onClick={() => toggleList(l.id)}
                        className="w-full flex items-center gap-3 px-5 py-2.5 text-start hover:bg-surface-2 transition"
                      >
                        <span
                          className={`grid place-items-center w-[22px] h-[22px] rounded-full border-[1.5px] shrink-0 transition ${
                            on
                              ? "bg-accent border-accent text-[color:var(--on-accent)]"
                              : "border-border text-transparent"
                          }`}
                        >
                          <Icon name="check-line" size={14} strokeWidth={2.2} />
                        </span>
                        <span className="text-[14px] truncate">{l.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

          <div className="p-4 pt-2">
            <button onClick={() => setSheet(null)} className={sheetBtn}>
              {t.doneLabel}
            </button>
          </div>
        </>
      </Sheet>

      {/* ورقة التأشير الكامل */}
      <Sheet
        open={sheet === "watch"}
        onClose={() => setSheet(null)}
        closeLabel={t.closeLabel}
        variant="center"
        labelledBy="watch-sheet-title"
        className="p-4"
      >
        <>
          <p id="watch-sheet-title" className="text-center font-bold text-[15px] pt-1.5 pb-4">
            {done ? t.allWatchedShort : t.markAllTitle}
          </p>
            <div className="space-y-2.5">
              {done ? (
                mediaType === "movie" ? (
                  <button onClick={() => confirmWatch(false)} className={sheetBtn}>
                    {t.unmarkWatchedBtn}
                  </button>
                ) : null
              ) : (
                <button onClick={() => confirmWatch(true)} className={sheetBtn}>
                  {mediaType === "tv" && episodesTotal
                    ? t.markAllCount(episodesTotal)
                    : t.markWatchedBtn}
                </button>
              )}
              <button
                onClick={() => setSheet(null)}
                className={buttonClass({ variant: "ghost", size: "lg", full: true })}
              >
                {t.cancelLabel}
              </button>
          </div>
        </>
      </Sheet>
    </>
  );
}
