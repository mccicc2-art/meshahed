"use client";

import Link from "next/link";
import { flashError, toast } from "@/lib/toast";
import { coalescedRefresh } from "@/lib/refresh";
import { tap } from "@/lib/haptics";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  follow,
  unfollow,
  toggleInList,
  markShowWatched,
  unmarkEpisodes,
  toggleMovieWatched,
} from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { FranchisePanel } from "./FranchisePanel";
import { buttonClass } from "./ui/Button";

/**
 * مربّع ✓ الموحّد داخل ورقة القوائم — شكلٌ واحد لكل صفوفها.
 *
 * خارج المكوّن لا داخله: المكوّن المعرَّف أثناء التصيير يُنشأ من جديد مع
 * كل رسمة، فتُفقد حالة أبنائه ويُلغى تذكيرُ React — وهو ما ينبّه إليه
 * `react-hooks/static-components`.
 */
function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      className={`grid place-items-center w-[22px] h-[22px] rounded-full border-[1.5px] shrink-0 transition ${
        on
          ? "bg-accent border-accent text-[color:var(--on-accent)]"
          : "border-border text-transparent"
      }`}
    >
      <Icon name="check-line" size={14} strokeWidth={2.2} />
    </span>
  );
}

/**
 * صفّ الإجراء الرئيسي في صفحة العمل: «أضف لقائمة» + دائرة «شاهدتُه».
 *
 * **الدائرة تعني «شاهدتُه»، وورقة التأكيد لا تعود** (D-047، بصيغته
 * النهائية). جُرّب أن تعني «للمشاهدة» فتبيّن أنها تكرار: الزرّ الكبير
 * بجانبها يفتح ورقةً أوّلُ صفٍّ فيها «للمشاهدة» — فمعنيان لفعلٍ واحد في
 * شبرٍ واحد. قرار المالك، وهو الصواب: الزرّ الكبير للحفظ، والدائرة
 * للحالة.
 *
 * والذي بقي من التجربة هو الأهمّ: **الحماية انتقلت من «تأكيد قبل» إلى
 * «تراجع بعد».** التأكيد يعاقب كل من أصاب ليحمي من أخطأ؛ والتراجع يحمي
 * من أخطأ بلا أن يشعر به من أصاب. ومضيف الرسائل يدعم زرّ فعلٍ أصلاً
 * (D-019)، فلا مكوّن جديد ولا ورقة ثانية.
 *
 * وتراجع المسلسل صادقٌ لا شكليّ: `markShowWatched` تُرجع ما أضافته هي
 * وحدها، و`unmarkEpisodes` تحذف ذلك القدر بعينه — فلا يُمحى ما أشّره
 * المستخدم بيده قبل الضغطة. والعدد يُقال بعد الفعل («أُشّرت ٢٥٦ حلقة»)
 * لا قبله: هو نفسه الرقم الذي كانت ورقة التأكيد تعرضه، منقولاً إلى
 * الموضع الذي لا يكلّف أحداً ضغطة.
 *
 * ومسلسلٌ اكتمل لا تُلغيه الدائرة: حذف كل حلقاته بضغطة إتلافٌ لا تراجع،
 * فتقول الرسالة أين يُلغى الموسم. الفيلم يُقلَب لأنه حالةٌ واحدة.
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
  collectionId,
}: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  locale: Locale;
  initialFollowing: boolean;
  lists: { id: string; name: string }[];
  containing: string[];
  /** عدد الحلقات المعروضة — للمسلسلات فقط، يظهر في اسم الزرّ قبل الضغط */
  episodesTotal: number | null;
  /** مدّة الفيلم — تُسجَّل مع «شاهدتُه» */
  runtime: number | null;
  /** مُشاهَد بالكامل عند فتح الصفحة */
  initialDone: boolean;
  /** معرّف سلسلة الفيلم — تُعرض أجزاؤها تحت الصفّ بعد ضغطة ✓ */
  collectionId?: number | null;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [inLists, setInLists] = useState<Set<string>>(new Set(containing));
  const [done, setDone] = useState(initialDone);
  const [sheetOpen, setSheetOpen] = useState(false);
  /* لوحة الأجزاء تُفتح بضغطة ✓ وتبقى مفتوحة: من أشّر جزءاً يريد التالي،
     وإغلاقها تلقائياً يسحب الجواب من تحت يده */
  const [showParts, setShowParts] = useState(false);
  const [pending, start] = useTransition();

  const badge = inLists.size + (following ? 1 : 0);

  /**
   * «للمشاهدة» — صفُّ ورقة القوائم وحده.
   *
   * بلا رسالةٍ عابرة: المربّع يمتلئ أمام العين داخل الورقة، ورسالةٌ خلفها
   * لا تُقرأ. والحالة المطلوبة صريحةٌ لا مقلوبةٌ عن الحالية، فلا تُقرأ حالةٌ
   * تغيّرت تحت الدالّة.
   */
  function setToWatch(next: boolean) {
    setFollowing(next);
    tap(next ? [12, 30] : 10);
    start(async () => {
      try {
        if (next) await follow({ tmdbId, mediaType, title, posterPath });
        else await unfollow({ tmdbId, mediaType });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        setFollowing(!next);
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

  /**
   * التأشير الكامل. `followedNow` يُمرَّر إلى التراجع كي يعيد الحالة كما
   * كانت: من لم يكن في المكتبة قبل الضغطة لا يجوز أن يبقى فيها بعد إلغائها.
   */
  function markWatched() {
    if (done) {
      if (mediaType === "movie") {
        undoWatch({ movie: true, unfollow: false });
        return;
      }
      toast(t.seriesWatchedHint, { tone: "info" });
      return;
    }

    setDone(true);
    tap([12, 40, 12]);
    if (collectionId) setShowParts(true);
    start(async () => {
      let followedNow = false;
      try {
        if (!following) {
          await follow({ tmdbId, mediaType, title, posterPath });
          setFollowing(true);
          followedNow = true;
        }

        if (mediaType === "tv") {
          const res = await markShowWatched(tmdbId);
          const added = res?.added ?? [];
          coalescedRefresh(router);
          toast(added.length ? t.watchedMarkedCount(added.length) : t.watchedMarked, {
            action: {
              label: t.undoWatched,
              run: () => undoWatch({ episodes: added, unfollow: followedNow }),
            },
          });
        } else {
          await toggleMovieWatched({ movieTmdbId: tmdbId, runtime, watched: true });
          coalescedRefresh(router);
          toast(t.watchedMarked, {
            action: {
              label: t.undoWatched,
              run: () => undoWatch({ movie: true, unfollow: followedNow }),
            },
          });
        }
      } catch (e) {
        flashError((e as Error).message);
        setDone(false);
        if (followedNow) setFollowing(false);
      }
    });
  }

  /** التراجع — صامتٌ دائماً: رسالةٌ تلد رسالةً تجعل الشاشة تتكلّم مرّتين لفعلٍ واحد */
  function undoWatch(opts: {
    episodes?: { s: number; e: number }[];
    movie?: boolean;
    unfollow: boolean;
  }) {
    setDone(false);
    tap(10);
    start(async () => {
      try {
        if (opts.movie) {
          await toggleMovieWatched({ movieTmdbId: tmdbId, runtime, watched: false });
        } else if (opts.episodes?.length) {
          await unmarkEpisodes({ showTmdbId: tmdbId, episodes: opts.episodes });
        }
        if (opts.unfollow) {
          await unfollow({ tmdbId, mediaType });
          setFollowing(false);
        }
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        setDone(true);
      }
    });
  }

  /* اسم الزرّ يحمل العدد للمسلسل: هو الرقم الذي كانت ورقة التأكيد تعرضه،
     منقولاً إلى `title` و`aria-label` — يصل إلى قارئ الشاشة وإلى من يتحوّم
     بالفأرة، ولا يعترض طريق أحد */
  const watchLabel = done
    ? t.allWatchedShort
    : mediaType === "tv" && episodesTotal
      ? `${t.markAllTitle} · ${t.markAllCount(episodesTotal)}`
      : t.markAllTitle;

  // زرّ داخل الورقة: سطحٌ ثانوي يملأ العرض — الرتبة الثانية بعد الفعل
  // الأول في الشاشة نفسها، فلا يزاحمه بلون الهوية
  const sheetBtn = buttonClass({ variant: "surface", size: "lg", full: true });

  return (
    <>
      <div className="flex items-center gap-3">
        {/* أضف لقائمة: أبيض قبل الإضافة، وبلون الهوية بعدها — اللون هو
            الإشارة لا رقمٌ يحتاج تفسيراً، والعلامة تمتلئ معه */}
        <button
          onClick={() => setSheetOpen(true)}
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

        {/* دائرة «شاهدتُه» — ضغطةٌ واحدة، بلا ورقة، والتراجع في الرسالة */}
        <button
          onClick={markWatched}
          disabled={pending}
          aria-pressed={done}
          aria-label={watchLabel}
          title={watchLabel}
          className={`w-12 h-12 shrink-0 rounded-full grid place-items-center border-[1.5px] active:scale-95 transition ${
            done
              ? "border-transparent bg-[color:var(--success)]/15 text-[color:var(--success)]"
              : "border-border text-foreground/85 hover:border-accent/60"
          }`}
        >
          <Icon name="check-line" size={20} strokeWidth={2.2} className={done ? "check-pop" : ""} />
        </button>
      </div>

      {/* أجزاء السلسلة — تحت الصفّ مباشرةً، حيث وقعت الضغطة */}
      {showParts && collectionId ? (
        <FranchisePanel collectionId={collectionId} excludeId={tmdbId} locale={locale} />
      ) : null}

      {/* ورقة القوائم */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        closeLabel={t.closeLabel}
        variant="center"
        labelledBy="lists-sheet-title"
      >
        <>
          <p id="lists-sheet-title" className="text-center font-bold text-[15px] pt-5 pb-3">
            {t.listAddTo}
          </p>

          {/* «للمشاهدة» — المتابعة بثوب القائمة المثبّتة. صامتة هنا: المربّع
              يمتلئ أمام العين، ورسالةٌ خلف الورقة لا تُقرأ */}
          <button
            onClick={() => setToWatch(!following)}
            className="w-full flex items-center gap-3 px-5 py-3 text-start hover:bg-surface-2 transition"
          >
            <CheckBox on={following} />
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
                      <CheckBox on={on} />
                      <span className="text-[14px] truncate">{l.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="p-4 pt-2">
            <button onClick={() => setSheetOpen(false)} className={sheetBtn}>
              {t.doneLabel}
            </button>
          </div>
        </>
      </Sheet>
    </>
  );
}
