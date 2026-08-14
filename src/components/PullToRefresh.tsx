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
 * **٥ · ولا شيءَ يتحرّك إلا المؤشّر.** جرُّ الصفحة كلِّها يعني إعادةَ
 * تخطيطٍ في كل إطار على قوائمَ فيها عشرات الملصقات. **فالمؤشّرُ وحده
 * ينزل، والمحتوى ثابت** — نفسُ إحساسٍ بثمنٍ أقلّ.
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
        return;
      }
      setPull(Math.min(d / 2.2, THRESHOLD + 24));
    }
    function onEnd() {
      if (start.current === null) return;
      start.current = null;
      setPull((p) => {
        if (p >= THRESHOLD) {
          setBusy(true);
          /* **وتُترك دورةٌ للمؤشّر كي يُرسم قبل الجلب** — تحديثٌ بلا
             أثرٍ مرئيّ يجعل القارئ يسحب ثانيةً ظنّاً أن شيئاً لم يقع */
          setTimeout(() => {
            router.refresh();
            setTimeout(() => setBusy(false), 700);
          }, 60);
          return THRESHOLD;
        }
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
    };
  }, [busy, router]);

  const shown = busy ? THRESHOLD : pull;
  if (shown <= 0) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-30 flex justify-center pointer-events-none"
      style={{ transform: `translateY(${Math.max(0, shown - 26)}px)` }}
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
