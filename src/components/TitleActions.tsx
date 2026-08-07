"use client";

import Link from "next/link";
import { flashError, toast } from "@/lib/toast";
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
 * مربّع ✓ الموحّد داخل ورقة القوائم — شكلٌ واحد لكل صفوفها.
 *
 * خارج المكوّن لا داخله: المكوّن المعرَّف أثناء التصيير يُنشأ من جديد مع
 * كل رسمة، فتُفقد حالة أبنائه ويُلغى تذكيرُ React — وهو ما ينبّه إليه
 * `react-hooks/static-components`.
 */
function CheckBox({ on, success = false }: { on: boolean; success?: boolean }) {
  return (
    <span
      className={`grid place-items-center w-[22px] h-[22px] rounded-full border-[1.5px] shrink-0 transition ${
        on
          ? success
            ? "bg-[color:var(--success)] border-[color:var(--success)] text-white"
            : "bg-accent border-accent text-[color:var(--on-accent)]"
          : "border-border text-transparent"
      }`}
    >
      <Icon name="check-line" size={14} strokeWidth={2.2} />
    </span>
  );
}

/**
 * صفّ الإجراء الرئيسي في صفحة العمل: «أضف لقائمة» + دائرة «للمشاهدة».
 *
 * الدائرة كانت تعني «شاهدتُ العمل كله» وتفتح ورقة تأكيد. تغيّر معناها إلى
 * «للمشاهدة» (D-047) لسببين: هو الفعل الأكثر تكراراً في التطبيق وكان
 * مدفوناً خلف زرٍّ وورقة، ولأن ✓ الممتلئ يعني داخل ورقة القوائم «هذا العمل
 * في هذه القائمة» — فالدائرة تقول الشيء نفسه عن القائمة المثبّتة، لا معنىً
 * مستحدثاً.
 *
 * وورقة التأكيد سقطت كلها: الحماية انتقلت من «تأكيد قبل» إلى «تراجع بعد».
 * التأكيد يعاقب كل من أصاب ليحمي من أخطأ؛ والتراجع يحمي من أخطأ بلا أن
 * يشعر به من أصاب. ومضيف الرسائل العام يدعم زرّ فعلٍ داخل الرسالة أصلاً،
 * فلا مكوّن جديد ولا لغة بصرية ثانية.
 *
 * و«شاهدتُه كله» انتقل إلى ذيل الورقة نفسها — سطرٌ مفصولٌ بخطّ تحت القوائم:
 * الفعل لم يُدفن (ضغطتان)، ولم تُفتح له ورقةٌ ثانية، وبقيت الحالة كلها في
 * مكوّنٍ واحد فلا تتناقض دائرةٌ مع سطر.
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
  /** عدد الحلقات المعروضة — للمسلسلات فقط، يظهر في سطر «شاهدتُه كله» */
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, start] = useTransition();

  const badge = inLists.size + (following ? 1 : 0);

  /**
   * الانزلاق إلى صفّ «الأجزاء والأعمال المرتبطة» بعد الإضافة.
   *
   * الحفظ لحظةُ نيّة: من حفظ عملاً هو أقرب الناس إلى أن يريد بقيّة أجزائه.
   * والصفّ موجودٌ دائماً أسفل الصفحة — الانزلاق يكشفه لا ينشئه، فلا يفوت
   * من لم يضغط.
   *
   * وشرطان يمنعانه من أن يصير خطفاً للشاشة: احترام `prefers-reduced-motion`،
   * وسقفُ مسافةٍ بأربع شاشات — تبويب الحلقات في مسلسلٍ طويل يجعل الصفّ على
   * بُعد آلاف البكسلات، وانزلاقةٌ بهذا الطول تُقرأ هروباً لا كشفاً.
   */
  function revealRelated() {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    requestAnimationFrame(() => {
      const el = document.getElementById("related");
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 4) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /**
   * «للمشاهدة» — الحالة المطلوبة صريحةٌ لا مقلوبةٌ عن الحالية، كي يستطيع
   * زرّ التراجع أن يستدعي الدالة نفسها بلا أن يقرأ حالةً تغيّرت تحته.
   */
  function setToWatch(next: boolean, silent = false) {
    setFollowing(next);
    tap(next ? [12, 30] : 10);
    if (next) revealRelated();
    start(async () => {
      try {
        if (next) await follow({ tmdbId, mediaType, title, posterPath });
        else await unfollow({ tmdbId, mediaType });
        coalescedRefresh(router);
        if (!silent) {
          toast(next ? t.toWatchAdded : t.toWatchRemoved, {
            // التراجع صامت: رسالةٌ تلد رسالةً تجعل الشاشة تتكلّم مرّتين لفعلٍ واحد
            action: { label: t.undoWatched, run: () => setToWatch(!next, true) },
          });
        }
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

  /** التأشير الكامل — وإن لم يكن في «للمشاهدة» أضفناه أولاً كي يظهر في مكتبته */
  function setWatched(mark: boolean, silent = false) {
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
        if (!silent) {
          toast(mark ? t.watchedMarked : t.watchedUnmarked, {
            /* المسلسل لا تراجع له: `markShowWatched` تكتب مئات الحلقات ولا
               دالةَ عكسٍ لها اليوم — فلا نَعِد بزرٍّ لا يفي. الفيلم يتراجع */
            action:
              mediaType === "movie"
                ? { label: t.undoWatched, run: () => setWatched(!mark, true) }
                : undefined,
          });
        }
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

        {/* دائرة «للمشاهدة» — ضغطةٌ واحدة، بلا ورقة، والتراجع في الرسالة */}
        <button
          onClick={() => setToWatch(!following)}
          disabled={pending}
          aria-pressed={following}
          aria-label={t.libToWatch}
          title={t.libToWatch}
          className={`w-12 h-12 shrink-0 rounded-full grid place-items-center border-[1.5px] active:scale-95 transition ${
            following
              ? "border-transparent bg-accent/15 text-accent"
              : "border-border text-foreground/85 hover:border-accent/60"
          }`}
        >
          <Icon
            name="check-line"
            size={20}
            strokeWidth={2.2}
            className={following ? "check-pop" : ""}
          />
        </button>
      </div>

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
            onClick={() => setToWatch(!following, true)}
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

          {/* ===== شاهدتُه كله =====
              مفصولٌ بخطٍّ عن القوائم لأنه ليس قائمة: هو حالةُ العمل لا
              مكانه. ولونه لون النجاح وحده في التطبيق — لا لون ثانٍ له.
              والمسلسل يعرض عدد حلقاته في السطر نفسه: من يضغط يعرف كم
              يؤشّر قبل أن يؤشّر، وهو ما كانت ورقة التأكيد تقوله */}
          <div className="h-px bg-[color:var(--divider)] mx-5 mt-2" />
          <button
            /* المسلسل المُشاهَد بالكامل يبقى ظاهراً ومعطَّلاً لا مخفيّاً:
               إخفاؤه يجعل الحالة غير مقروءة، ولا دالةَ عكسٍ للمسلسل اليوم
               فلا يجوز أن يبدو الصفّ قابلاً للنقر */
            onClick={() => setWatched(!done)}
            disabled={mediaType === "tv" && done}
            className="w-full flex items-center gap-3 px-5 py-3 text-start hover:bg-surface-2 transition disabled:hover:bg-transparent disabled:opacity-70 disabled:cursor-default"
          >
            <CheckBox on={done} success />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">
                {done ? t.allWatchedShort : t.markAllTitle}
              </span>
              {!done && mediaType === "tv" && episodesTotal ? (
                <span className="block text-[11px] text-muted mt-0.5">
                  {t.markAllCount(episodesTotal)}
                </span>
              ) : null}
            </span>
          </button>

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
