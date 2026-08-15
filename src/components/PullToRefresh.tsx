"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { claimGesture, releaseGesture, gestureTakenBy } from "@/lib/tabDrag";
import { useRouter } from "next/navigation";

/**
 * **السحبُ للتحديث** (D-243، طلبُ أحمد: «أحتاج إذا سحبت يعمل تحديث مثل
 * تويتر»).
 *
 * ================= خمسةُ حدودٍ تجعله لا يزعج =================
 *
 * **١ · لا يبدأ إلا من قمّة الصفحة بالضبط.** `scrollY > 0` يعني أن
 * الإصبع يقرأ لا يُحدِّث — **وسحبٌ يُطلق التحديثَ في منتصف القائمة يفقد
 * القارئَ موضعَه**، وهو أسوأُ ما يفعله تحديثٌ لم يُطلب.
 *
 * **٢ · واللمسُ وحده.** الفأرةُ لا تسحب صفحاتٍ، **وسطحُ المكتب له
 * `F5`** — فالمستمعُ لا يُركَّب إلا حيث يوجد لمس.
 *
 * **٣ · وعتبةٌ أبعدُ من مسافة التمرير العابر** (٧٠px).
 *
 * **٤ · والمقاومةُ نصفُ المسافة** (`d / 2.2`).
 *
 * **٥ · والمحتوى ينزل مع الإصبع والترويسةُ تثبت** (D-246) — يُجَرّ `#main`
 * وحده إجبارياً (`style.transform`)، لا تصييرَ React في كل إطارِ لمس.
 *
 * ⚠️ **و`router.refresh()` لا `location.reload()`**: الأوّلُ يعيد جلبَ
 * مكوّنات الخادم ويُبقي حالةَ العميل والتمرير.
 *
 * ================= D-250 — عيبان أصلحهما بلاغٌ واحد =================
 *
 * **بنصّ أحمد:** «المفروض بعد السحب إذا فاتت الإصبع الدائرة فوق تدور
 * والصفحة تعمل ريفرش سريع».
 *
 * **العيبُ الأول — الجرُّ كان يُلغى في اللحظة نفسِها التي يبدأ فيها
 * التحديث.** `busy` كان في مصفوفة اعتماد `useEffect`، **فقلبُه إلى `true`
 * يُشغّل تنظيفَ الأثر، وفي التنظيف `shift(0)`** — فينطبق المحتوى فوراً
 * وتبقى دائرةٌ معلّقة وحدها. **ودرسٌ يُقال: حالةٌ يقرؤها مستمعُ لمسٍ
 * تسكن `ref` لا مصفوفةَ اعتماد** — وإلا صار كلُّ تغيّرٍ فيها إعادةَ تركيبٍ
 * للمستمعات ونقضاً لما تفعله.
 *
 * **العيبُ الثاني — الانتظارُ كان رقماً لا حدثاً.** ٧٠٠ms ثابتة بعد
 * `refresh()`: **إن جاء الخادمُ في ١٥٠ms انتظرَ القارئُ بلا سبب، وإن
 * تأخّر إلى ٩٠٠ اختفت الدائرةُ قبل أن يصل الجديد.** والآن **`useTransition`
 * هو المقياس**: `isPending` تعني حرفياً «مكوّناتُ الخادم في الطريق»،
 * فالدائرةُ تعيش عمرَ الجلب لا عمرَ مؤقّت. **وأرضيةٌ صغيرة (٤٥٠ms) تبقى**
 * لأن وميضاً في ٨٠ms يُقرأ عطلاً لا سرعة.
 *
 * **والدورانُ يبدأ قبل الإفلات** (وهو ما طلبه حرفياً): متى تجاوز الإصبعُ
 * العتبةَ صارت الحلقةُ كاملةً ودارت — **فتقول «أفلِت الآن» بلا كلمة**،
 * بدل أن تظلّ ساكنةً حتى يُفلت فلا يعرف أوصل أم لا.
 */

const THRESHOLD = 70;
/** أقلُّ عمرٍ مرئيّ للدائرة — دونه يُقرأ التحديثُ وميضاً لا فعلاً */
const MIN_VISIBLE = 450;

/**
 * **جرُّ المحتوى** — `#main` وحده: الترويسةُ والتبويبات خارجه فتثبت
 * كتويتر، والمؤشّرُ يظهر في الفجوة التي يكشفها النزول. **والعودةُ وحدها
 * تُحرَّك** (`transition` عند الإفلات لا أثناء الجرّ): انتقالٌ أثناء اللمس
 * يجعل الصفحةَ تلحق الإصبعَ متأخّرةً فتُحَسّ ثقيلة.
 */
function shift(px: number, animate: boolean) {
  const el = document.getElementById("main");
  if (!el) return;
  el.style.transition = animate ? "transform 0.25s ease" : "none";
  el.style.transform = px > 0 ? `translateY(${px}px)` : "";
}

export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const start = useRef<number | null>(null);
  /* **الحالةُ التي يقرؤها المستمع تسكن `ref`** — انظر العيب الأول أعلاه */
  const busyRef = useRef(false);
  const since = useRef(0);

  useEffect(() => {
    /* **لا لمسَ لا مستمع** — انظر الحدّ ٢ */
    if (typeof window === "undefined" || !("ontouchstart" in window)) return;

    function onStart(e: TouchEvent) {
      if (window.scrollY > 0 || busyRef.current) return;
      start.current = e.touches[0]?.clientY ?? null;
    }
    function onMove(e: TouchEvent) {
      if (start.current === null) return;
      /* **ومن سبق مَلَك** (D-277): إن كان سحبُ التبويبات قد أمسك اللمسة
         **فهذه ليست جرّةَ تحديث** — تُلغى فوراً ولا يعلق المؤشّر.
         **وهو نصفُ علاجِ لخبطةِ أحمد**: النصفُ الآخر أن الأفقيَّ يمنع
         التمرير، وهذا أن الرأسيَّ يعترف بالأوّل. */
      if (gestureTakenBy("y")) {
        start.current = null;
        setPull(0);
        shift(0, true);
        return;
      }
      const d = (e.touches[0]?.clientY ?? 0) - start.current;
      /* سحبٌ لأعلى؟ ليس تحديثاً — يُلغى فوراً فلا يعلق المؤشّر */
      if (d <= 0) {
        start.current = null;
        setPull(0);
        shift(0, true);
        return;
      }
      /* **ولا يُملَك إلا عند جرّةٍ حقيقيّة** — لا عند أوّل بكسل: لمسةٌ
         ساكنةٌ لا تحجز الإصبعَ عن السحب الأفقيّ (D-277). */
      if (d > 8 && !claimGesture("y")) {
        start.current = null;
        setPull(0);
        shift(0, true);
        return;
      }
      const p = Math.min(d / 2.2, THRESHOLD + 24);
      setPull(p);
      shift(p, false);
    }
    function onEnd() {
      releaseGesture("y");
      if (start.current === null) return;
      start.current = null;
      setPull((p) => {
        if (p >= THRESHOLD) {
          busyRef.current = true;
          since.current = Date.now();
          setBusy(true);
          /* **يستقرّ المحتوى عند العتبة ما دام الجلبُ جارياً** — فجوةُ
             المؤشّر باقيةٌ حتى يكتمل، وهو عقدُ تويتر نفسُه */
          shift(THRESHOLD, true);
          /* **والجلبُ داخل انتقال** كي يصير له `isPending` نقرؤه */
          startTransition(() => router.refresh());
          return THRESHOLD;
        }
        shift(0, true);
        return 0;
      });
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      shift(0, false);
    };
    /* ⚠️ **ولا `busy` هنا** — انظر العيب الأول */
  }, [router, startTransition]);

  /**
   * **الإفراجُ حدثٌ لا مؤقّت**: ينتهي الجلبُ (`pending` تسقط) فتُحسب
   * البقيّةُ من أرضيّة العمر المرئيّ وحدها.
   */
  useEffect(() => {
    if (!busy || pending) return;
    const wait = Math.max(0, MIN_VISIBLE - (Date.now() - since.current));
    const id = setTimeout(() => {
      busyRef.current = false;
      setBusy(false);
      setPull(0);
      shift(0, true);
    }, wait);
    return () => clearTimeout(id);
  }, [busy, pending]);

  const shown = busy ? THRESHOLD : pull;
  if (shown <= 0) return null;

  /* **مشدودةٌ = تجاوز الإصبعُ العتبةَ ولم يُفلت بعد** — تدور كما لو بدأت */
  const armed = !busy && pull >= THRESHOLD;
  const spinning = busy || armed;

  return (
    /* **المؤشّرُ يظهر تحت الترويسة اللاصقة لا فوق كل شيء** (D-245).
       و`--sticky-top` هي نفسُ المرساة التي تلتصق عندها التبويبات،
       **فتعريفٌ واحدٌ يحكم الاثنين** ولا ينفكّان. */
    <div
      aria-hidden
      className="fixed inset-x-0 z-20 flex justify-center pointer-events-none"
      style={{
        top: "var(--sticky-top)",
        transform: `translateY(${Math.max(0, shown - 26)}px)`,
      }}
    >
      <span
        className={`grid place-items-center w-9 h-9 rounded-full bg-surface border border-border shadow-lg ${
          spinning ? "animate-spin" : ""
        }`}
        style={{
          /* **قبل العتبة يدور المؤشّر مع الإصبع** — فيقول «لم تصل بعد»
             بلا كلمة. **وعند العتبة يتحوّل إلى دورانٍ حقيقيّ**، فلا
             تُكتب زاويةٌ ثابتة تُجمّده تحت الحركة. */
          transform: spinning ? undefined : `rotate(${(shown / THRESHOLD) * 270}deg)`,
          opacity: Math.min(1, shown / 28),
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="44"
            strokeDashoffset={spinning ? 30 : 44 - Math.min(1, shown / THRESHOLD) * 40}
            className="text-accent"
          />
        </svg>
      </span>
    </div>
  );
}
