"use client";

import { useEffect, useRef, useState } from "react";
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
 * **٣ · وعتبةٌ أبعدُ من مسافة التمرير العابر** (٧٠px): أصابعُ الناس
 * تلمس الشاشةَ وتتحرّك قليلاً قبل أن تستقرّ، **وعتبةٌ قريبة تجعل
 * التطبيقَ يُحدِّث نفسَه كلَّما لمسته.**
 *
 * **٤ · والمقاومةُ نصفُ المسافة** (`d / 2.2`): تويتر يجرّ المؤشّرَ أبطأ
 * من الإصبع، **فيُحسّ القارئُ أنه يشدّ شيئاً له وزن** — والحركةُ الحرفية
 * ١:١ تجعل الصفحةَ تبدو منفصلةً عن يده.
 *
 * **٥ · والمحتوى ينزل مع الإصبع والترويسةُ تثبت** (D-246، طلبُ أحمد:
 * «النشرات ما تنزل — أحتاجها تنزل عشان يوضح أن الشخص يعمل ريفرش»).
 * **وهو نقضُ «لا يتحرّك إلا المؤشّر» (D-243) ويُسجَّل**: حجّتي كانت كلفةَ
 * إعادة التخطيط، **وكانت حجّةً خاطئة التشخيص** — الجرُّ بـ`transform`
 * تركيبٌ لا تخطيط، لا يُعاد حسابُ صفٍّ واحد. وأحمد محقٌّ في الجوهر:
 * **مؤشّرٌ فوق محتوًى ساكنٍ يُقرأ زخرفةً، ومحتوًى ينزل يُقرأ فعلاً.**
 * ويُجَرّ `#main` وحده **إجبارياً لا عبر الحالة** (`style.transform`
 * مباشرةً): تصييرُ React في كل إطارِ لمسٍ هدرٌ لحركةٍ لا يقرؤها أحد.
 * **وارتدادُ النظام يبقى مُطفأً** (`overscroll-behavior-y: none`، D-245)
 * — وإلا تحرّك اثنان لحركةٍ واحدة.
 *
 * ⚠️ **و`router.refresh()` لا `location.reload()`**: الأوّلُ يعيد
 * جلبَ مكوّنات الخادم **ويُبقي حالةَ العميل والتمرير**، والثاني يهدم
 * الصفحةَ ويعيد بناءها — **وميضٌ أبيض ورجوعٌ إلى الأعلى ثمناً لتحديث.**
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);

  const THRESHOLD = 70;

  useEffect(() => {
    /**
     * **جرُّ المحتوى** (D-246) — `#main` وحده: الترويسةُ والتبويبات خارجه
     * فتثبت كتويتر، والمؤشّرُ يظهر في الفجوة التي يكشفها النزول.
     * **والعودةُ وحدها تُحرَّك** (`transition` عند الإفلات لا أثناء الجرّ):
     * انتقالٌ أثناء اللمس يجعل الصفحةَ تلحق الإصبعَ متأخّرةً فتُحَسّ ثقيلة.
     */
    function shift(px: number, animate: boolean) {
      const el = document.getElementById("main");
      if (!el) return;
      el.style.transition = animate ? "transform 0.25s ease" : "none";
      el.style.transform = px > 0 ? `translateY(${px}px)` : "";
    }

    /* **لا لمسَ لا مستمع** — انظر الحدّ ٢ */
    if (typeof window === "undefined" || !("ontouchstart" in window)) return;

    function onStart(e: TouchEvent) {
      if (window.scrollY > 0 || busy) return;
      start.current = e.touches[0]?.clientY ?? null;
    }
    function onMove(e: TouchEvent) {
      if (start.current === null) return;
      const d = (e.touches[0]?.clientY ?? 0) - start.current;
      /* سحبٌ لأعلى؟ ليس تحديثاً — يُلغى فوراً فلا يعلق المؤشّر */
      if (d <= 0) {
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
      if (start.current === null) return;
      start.current = null;
      setPull((p) => {
        if (p >= THRESHOLD) {
          setBusy(true);
          /* **يستقرّ المحتوى عند العتبة ما دام الجلبُ جارياً** — فجوةُ
             المؤشّر باقيةٌ حتى يكتمل، وهو عقدُ تويتر نفسُه */
          shift(THRESHOLD, true);
          /* **وتُترك دورةٌ للمؤشّر كي يُرسم قبل الجلب** — تحديثٌ بلا
             أثرٍ مرئيّ يجعل القارئ يسحب ثانيةً ظنّاً أن شيئاً لم يقع */
          setTimeout(() => {
            router.refresh();
            setTimeout(() => {
              setBusy(false);
              shift(0, true);
            }, 700);
          }, 60);
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
  }, [busy, router]);

  const shown = busy ? THRESHOLD : pull;
  if (shown <= 0) return null;

  return (
    /* **المؤشّرُ يظهر تحت الترويسة اللاصقة لا فوق كل شيء** (D-245،
       لقطةُ أحمد مقارِناً بتويتر): هناك يولد الدوّارُ **بين الرأس الثابت
       والمحتوى** — وهنا كان يولد عند حافّة الشاشة فوق الترويسة نفسِها.
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
          busy ? "animate-spin" : ""
        }`}
        style={{
          /* **قبل العتبة يدور المؤشّر مع الإصبع** — فيقول «لم تصل بعد»
             بلا كلمة، ويكتمل عند العتبة تماماً */
          transform: busy ? undefined : `rotate(${(shown / THRESHOLD) * 270}deg)`,
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
            strokeDashoffset={busy ? 30 : 44 - Math.min(1, shown / THRESHOLD) * 40}
            className="text-accent"
          />
        </svg>
      </span>
    </div>
  );
}
