"use client";

import Link from "next/link";
import { flashError, toast } from "@/lib/toast";
import { coalescedRefresh } from "@/core/refresh";
import { tap } from "@/lib/haptics";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  follow,
  unfollow,
  toggleInList,
  markShowWatched,
  unmarkShow,
  unmarkEpisodes,
  toggleMovieWatched,
  toggleFavorite,
  myRatingFor,
} from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { formatDateShort } from "@/core/when";
import type { MediaType } from "@/core/media";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { FranchisePanel } from "./FranchisePanel";
import { RatingBox } from "./RatingBox";
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
 * صفّ الإجراء الرئيسي في صفحة العمل — ⚖️ 🆕 **أربعُ خاناتٍ كالتطبيق منذ ١٩ نوفمبر** (للمشاهدة · إلى قائمة · مفضّلة ·
 * شاهدته؛ تفصيلُه عند الصفّ أدناه). ما تحته تاريخُ الصفِّ السابق («أضف لقائمة» + دائرة «شاهدتُه») — **وحجّتُه في «شاهدته» ما
 * زالت قائمةً حرفاً** (ضغطةٌ واحدة والتراجعُ بعدها)؛ الذي تبدّل الشكلُ وموضعُ «للمشاهدة».
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
  backdropPath,
  locale,
  initialFollowing,
  lists,
  containing,
  episodesTotal,
  runtime,
  initialDone,
  collectionId,
  initialFavorite = false,
  lockedUntil,
}: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  /** 🆕 **غلافُ العمل** (D-313) — يمرّ إلى صندوق التقييم فيُكتب مع الحفظ */
  backdropPath?: string | null;
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
  /** في «مفضّلاتي» عند فتح الصفحة (D-130) */
  initialFavorite?: boolean;
  /**
   * 🆕 T474 — **فيلمٌ لم يُعرض**: تاريخُ عرضه (`null` = بلا تاريخٍ بعد)، والغيابُ = مفتوح. خانةُ «شاهدته» تصير تقويماً
   * بتاريخه خافتاً («١ أ»)، وضغطتُها تقول متى تُفتح — والحارسُ الحقيقيُّ في الخادم (`assertMovieOut`).
   */
  lockedUntil?: string | null;
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
  const [fav, setFav] = useState(initialFavorite);
  const [pending, start] = useTransition();
  /* ورقة التقييم بعد ✓ (D-158، طلب أحمد: «يسألني عن التقييم مباشرة»).
     `null` = مغلقة؛ وإلا فهي تقييمي الحالي، يُحمَّل عند الفتح لا مع الصفحة. */
  const [rateSheet, setRateSheet] = useState<
    { rating: number | null; review: string | null; hasSpoiler?: boolean } | null
  >(null);

  /* القلب تفاؤليٌّ مع تراجعٍ عند الفشل (D-007): فعلٌ من ضغطةٍ واحدة لا
     يحتمل انتظار رحلةِ شبكة، وخطؤه يُصحَّح بنفسه */
  function flipFavorite() {
    const next = !fav;
    tap(next ? [10, 20] : 8);
    setFav(next);
    toggleFavorite({ tmdbId, mediaType, title, posterPath, listName: t.favListName })
      .then((real) => setFav(real))
      .catch((e) => {
        setFav(!next);
        flashError((e as Error).message);
      });
  }

  /* ⚖️ D-1251 — «للمشاهدة» = أريد مشاهدتَه ولم أُنهِه (أحمد: «يبقى في المكتبة بس ما يبقى في تو واتش»).
     المتابعةُ نفسُها لا تُمسّ (العملُ باقٍ في المكتبة، وموسمٌ جديدٌ يعيده)؛ الذي يتبدّل ما يُعرض ويُعدّ. */
  const wantsWatch = following && !done;

  /**
   * «للمشاهدة» — خانتُها في صفّ الأفعال (كانت صفَّ ورقة القوائم حتى ١٩ نوفمبر).
   *
   * بلا رسالةٍ عابرة: الخانةُ تصفرّ أمام العين. والحالة المطلوبة صريحةٌ لا مقلوبةٌ عن الحالية، فلا تُقرأ حالةٌ
   * تغيّرت تحت الدالّة. ومن أنهى العملَ يُقال له السببُ بتوستٍ عند الخانة نفسِها (D-1251).
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
  /**
   * السؤال عن التقييم فور «شاهدتُه» (D-158) — طلب أحمد: «يكون أريح».
   *
   * **وهو عرضٌ لا تأكيد، فلا ينقض D-047:** الختم وقع وسُجّل قبل أن تُفتح
   * الورقة، والإغلاق يتركه كما هو. التأكيد يقف *قبل* الفعل ويعاقب من أصاب؛
   * هذا يقع *بعده* ويلتقط اللحظة التي يكون فيها الرأي حاضراً.
   *
   * **ومن قيّمه من قبلُ لا يُسأل ثانيةً:** الورقة تُفتح فقط حين يعود
   * الخادم بلا تقييم. سؤالُ من أجاب قبل قليل إلحاحٌ لا خدمة، وهو ما يجعل
   * العين تتعلّم تجاهل ما نعرضه (نفس منطق «بلا عدّاد على التبويب»، D-137).
   *
   * ولا نجلب التقييم مع الصفحة: `myRatingFor` تُنادى هنا وحدها، فلا تدفع
   * كل فتحةِ صفحةٍ كلفةَ ورقةٍ قد لا تُفتح (نمط جرس D-125).
   */
  function askRating() {
    myRatingFor(tmdbId, mediaType)
      .then((r) => {
        if (r.rating == null) setRateSheet(r);
      })
      .catch(() => {
        /* تعذّرت القراءة: لا نسأل على الشكّ — إظهارُ صفر نجومٍ لمن قيّم
           بثمانية يمحو رأيه إن حفظ. الصمت هنا أصدق. */
      });
  }

  function markWatched() {
    if (done) {
      if (mediaType === "movie") {
        undoWatch({ movie: true, unfollow: false });
        return;
      }
      /* ⚖️ 🆕 **والمسلسلُ يُلغى من هنا أيضاً** (D-538، تصميمُ أحمد:
         «اضغط زر الصح مرة ثانية لإلغاء التحديد»).
         **كان الردُّ تلميحاً** («ألغِ أي موسم من تبويب الحلقات») —
         **وزرٌّ يردّ بتعليماتٍ ليس زرّاً**، **وعلامةٌ تُضغط فتضيء ولا
         تنطفئ نصفُ مفتاح** (D-238: فعلٌ واحدٌ باتّجاهيه).
         **والفيلمُ كان يفعلها منذ يومه** — فالشكلان استويا.
         **والتراجعُ إعادةُ الوسم كاملاً**: الزرُّ لا يُرى إلا
         والمسلسلُ مُشاهَدٌ كلُّه، **فما يعود هو ما ذهب بالضبط.** */
      setDone(false);
      tap(10);
      start(async () => {
        try {
          await unmarkShow(tmdbId);
          coalescedRefresh(router);
          toast(t.unwatchShowDone, {
            action: {
              label: t.undoWatched,
              run: () => {
                setDone(true);
                start(async () => {
                  try {
                    await markShowWatched(tmdbId);
                    coalescedRefresh(router);
                  } catch (e) {
                    flashError((e as Error).message);
                    setDone(false);
                  }
                });
              },
            },
          });
        } catch (e) {
          flashError((e as Error).message);
          setDone(true);
        }
      });
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
        /* والسؤال يقع هنا: بعد نجاح الختم لا قبله (D-158).
           ورقةٌ تُفتح ثم يفشل الختم تسأل عن رأيك في شيءٍ لم يُسجَّل. */
        askRating();
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
  /* 🆕 **واسمُ الزرِّ يقول ما تفعله الضغطةُ التالية** (D-538/D-238):
     **كان يقول «مُشاهَد» وهو حال، والضغطةُ صارت فعلاً** — **واسمٌ يصف
     الحالَ فوق زرٍّ يغيّره يُقرأ خطأً.** */
  const watchLabel = done
    ? mediaType === "tv"
      ? t.unwatchShowAria
      : t.undoNotWatched
    : mediaType === "tv" && episodesTotal
      ? `${t.markAllTitle} · ${t.markAllCount(episodesTotal)}`
      : t.markAllTitle;

  // زرّ داخل الورقة: سطحٌ ثانوي يملأ العرض — الرتبة الثانية بعد الفعل
  // الأول في الشاشة نفسها، فلا يزاحمه بلون الهوية
  const sheetBtn = buttonClass({ variant: "surface", size: "lg", full: true });

  return (
    <>
      {/* ⚖️ 🆕 **صفُّ الأفعال الأربعة كالتطبيق** (أحمد ١٩ نوفمبر: «ابغى أغيّرها وأخلّي نظامها وشكلها مثل التطبيق، وتكون فوق
          الحلقات وعن العمل والمراجعات» — الخيار «أ»). نقضٌ لصفِّ D-047/D-130 («أضف لقائمة» + قلب + ✓) بحكم صاحبه، **ونسخةُ
          `apps/mobile/src/title/ActionRow.tsx` (D-1014) حرفاً**: إطارٌ واحدٌ بلا فواصل ولا خلفيّةٍ للخانة النشطة — **الذي يتبدّل
          الأيقونةُ والكلمةُ ولونُهما**: الأصفرُ للحفظ، والأحمرُ للمفضّلة، ولونُ النجاح لـ«شاهدته».
          🔑 **و«للمشاهدة» خرجت من ورقة القوائم إلى خانتها** (تصحيحُ أحمد في التطبيق: «مستقلٌّ تماماً») — فلا بابان لها. ومن أنهى
          العملَ تبقى خانتُها مطفأةً وتقول السببَ بتوست (D-1251: الضغطةُ لا تحذف من المكتبة، والسببُ يُقال لا يُخمَّن). */}
      <div className="grid grid-cols-4 rounded-card border border-border overflow-hidden">
        {(
          [
            {
              key: "watch",
              icon: "eye",
              label: t.toWatchAction,
              on: wantsWatch,
              tone: "text-accent",
              press: () => (done ? toast(t.toWatchDone, { tone: "info" }) : setToWatch(!following)),
            },
            {
              key: "list",
              icon: "bookmark",
              label: inLists.size > 0 ? t.inListAction : t.toListAction,
              on: inLists.size > 0,
              tone: "text-accent",
              press: () => setSheetOpen(true),
            },
            {
              key: "fav",
              icon: fav ? "heart-filled" : "heart",
              label: t.favoriteAction,
              on: fav,
              tone: "text-[color:var(--error)]",
              aria: t.favAria,
              press: flipFavorite,
            },
            /* 🆕 T474 — **لم يُعرض: تقويمٌ بتاريخه لا ✓** (نموذجُ أحمد «١ أ» — «يُعرض ١٨ ديسمبر» قُصّت في الخانة فبقي التاريخُ
               وحده، والأيقونةُ تقول الباقي). **ومن أشّره قبل الحارس يبقى له ✓ يلغيه** — التراجعُ مفتوحٌ دائماً */
            lockedUntil !== undefined && !done
              ? {
                  key: "done",
                  icon: "calendar",
                  label: lockedUntil ? formatDateShort(lockedUntil, t) : t.trailerReleaseSoon,
                  on: false,
                  tone: "",
                  aria: t.releaseLockedToast,
                  locked: true,
                  press: () => toast(t.releaseLockedToast, { tone: "info" }),
                }
              : {
                  key: "done",
                  icon: "check-line",
                  label: t.watchedAction,
                  on: done,
                  tone: "text-[color:var(--success)]",
                  aria: watchLabel,
                  press: markWatched,
                },
          ] as { key: string; icon: IconName; label: string; on: boolean; tone: string; aria?: string; locked?: boolean; press: () => void }[]
        ).map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.press}
            disabled={c.key === "done" && pending}
            aria-pressed={c.on}
            /* الاسمُ المسموعُ هو المكتوب (WCAG 2.5.3: «اضغط شاهدته» يجده) — وجملةُ الفعل الكاملة في التلميح */
            title={c.aria}
            className={`flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-12 font-semibold transition active:opacity-60 disabled:opacity-60 desk:py-3 desk:text-14 hover:bg-surface-2 ${
              c.locked ? "text-muted" : c.on ? c.tone : "text-foreground"
            }`}
          >
            <Icon name={c.icon} size={20} strokeWidth={2} className={c.key === "done" && c.on ? "check-pop" : ""} />
            <span className="max-w-full truncate">{c.label}</span>
          </button>
        ))}
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
          <p id="lists-sheet-title" className="text-center font-bold text-15 pt-5 pb-3">
            {t.toListAction}
          </p>

          {/* «للمشاهدة» غادرت الورقة إلى خانتها في الصفّ (كالتطبيق) — الورقةُ لقوائمك وحدها */}

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
                      <span className="text-14 truncate">{l.name}</span>
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

      {/* ورقة «ما تقييمك له؟» بعد ✓ مباشرةً (D-158).

          `center` لا `bottom`: سؤالٌ قصيرٌ من سطرٍ وصفّ نجوم، والورقة
          السفلية شكلُ قوائم الأفعال (D-018). و`dismissible` كما هي — هذا
          عرضٌ يُترك بلمسةٍ خارجه، لا حاجزٌ يُجتاز (D-047).

          وصندوقُ التقييم هو نفسه صندوقُ تبويب التتبّع بلا نسخة: **لا عائلة
          تقييمٍ ثانية** (D-139)، فالنجوم العشر وحفظُها ورسائلُها تُكتب
          مرّةً واحدة وتظهر في موضعين. */}
      <Sheet
        open={rateSheet !== null}
        onClose={() => setRateSheet(null)}
        closeLabel={t.closeLabel}
        variant="center"
        labelledBy="rate-now-title"
      >
        {/* عنوانُ الورقة هو اسمُ العمل، ولا سطرَ ثانياً يسأل: صندوقُ
            التقييم يحمل عنوانه بنفسه («قيّم هذا العمل»)، فسؤالٌ فوقه
            يقول الشيء مرّتين في شبرٍ واحد. */}
        <div className="p-3.5 sm:p-4">
          <p id="rate-now-title" className="font-bold text-15 mb-2.5 px-1 truncate">
            {title}
          </p>
          <RatingBox
            tmdbId={tmdbId}
            mediaType={mediaType}
            title={title}
            posterPath={posterPath}
            backdropPath={backdropPath}
            locale={locale}
            initialRating={rateSheet?.rating ?? null}
            initialReview={rateSheet?.review ?? null}
            initialHasSpoiler={rateSheet?.hasSpoiler ?? false}
            /* الحفظ يُغلق الورقة: الجواب وصل، فبقاؤها مفتوحةً يطلبه ثانيةً */
            onSaved={() => {
              setRateSheet(null);
              coalescedRefresh(router);
            }}
          />
        </div>
      </Sheet>
    </>
  );
}
