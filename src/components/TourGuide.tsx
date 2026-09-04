"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getDict, type Locale } from "@/core/i18n";
import { TOUR_META, TOUR_VERSION, persistTourState, stepsOf, type TourId } from "@/lib/tour";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";

/**
 * محرّك الجولة — بطاقةٌ سفليّة تتنقّل بين الصفحات (١٩ أغسطس).
 *
 * بطاقةٌ لا غشاء: الجولة تعرض الصفحةَ الحقيقيةَ نفسَها، فحجبُها بغشاءٍ
 * معتمٍ يناقض غرضَها ويحجب المحتوى (شرط أحمد: لا نوافذ مزعجة). البطاقة
 * تقف فوق الشريط السفلي، والصفحةُ خلفها حيّةٌ تُقرأ وتُمرَّر.
 *
 * كل خطوةٍ تُبحر إلى صفحتها فعلاً (`router.push`) — فالمعروض هو
 * التطبيق لا صورةٌ عنه — والتقدّم يُحفظ عند كل خطوة فيُستأنف بعد
 * انقطاع. الخطواتُ من `lib/tour.ts` وحده (الإعداد المركزي).
 *
 * وصولاً: `role="dialog"` بلا `aria-modal` (لا يحبس شيئاً)، التركيز
 * ينتقل إلى البطاقة عند كل خطوة، وEscape يغلق كما يغلق «تخطّي».
 * الحركة `sheet-pop` القائمة — وتسكن كلياً مع `prefers-reduced-motion`
 * (القاعدة العامة في globals.css).
 */
export function TourGuide({
  locale,
  tourId,
  initialIndex,
  onClose,
}: {
  locale: Locale;
  /** 🆕 **أيُّ جولة** (D-852) — **والمحرّكُ واحدٌ لهما** (القاعدة ٣) */
  tourId: TourId;
  initialIndex: number;
  onClose: () => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const pathname = usePathname();
  /* 🆕 **الخطواتُ تُقرأ من الجولة المطلوبة** (D-852) — **ومحرّكٌ واحدٌ
     يقودهما**: **جولتان بمحرّكين نسختان تفترقان عند أوّل إصلاح**
     (القاعدة ٣). */
  const steps = stepsOf(tourId);
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), steps.length - 1),
  );
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[index];
  const last = index === steps.length - 1;

  /* الإبحار إلى صفحة الخطوة + حفظ التقدّم — عند كل تغيّر خطوة */
  useEffect(() => {
    persistTourState({ v: TOUR_VERSION, id: tourId, i: index, s: "active" });
    if (pathname !== step.path) router.push(step.path);
    // التركيز على البطاقة كي يقرأ قارئ الشاشة العنوان الجديد
    cardRef.current?.focus({ preventScroll: true });
    // pathname خارج الاعتماديات عمداً: تغيّرُه أثرُ push لا سببٌ لإعادة الدفع
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function end() {
    persistTourState({ v: TOUR_VERSION, id: tourId, i: index, s: "done" });
    onClose();
  }

  /* Escape يغلق — كما تُغلق الأوراق (القاعدة ١٦) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={step.title(t)}
      tabIndex={-1}
      className="sheet-pop fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-50 mx-auto w-[calc(100%-2rem)] max-w-md rounded-sheet border border-border bg-elevated shadow-2xl p-4 outline-none"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-accent/10">
          <Icon name="sparkles" size={18} className="text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-15 font-bold" dir="auto">
            {step.title(t)}
          </p>
          <p className="mt-1 text-12 text-muted leading-relaxed" dir="auto">
            {step.body(t)}
          </p>
        </div>
        <button
          type="button"
          aria-label={t.tourSkip}
          onClick={end}
          className="shrink-0 grid place-items-center w-8 h-8 -me-1 -mt-1 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
        >
          <Icon name="close" size={15} strokeWidth={2.2} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {/* نقاط التقدّم — والعدّ نصاً لقارئ الشاشة */}
        <span className="flex items-center gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={`rounded-full transition-all ${
                i === index ? "w-4 h-1.5 bg-accent" : "w-1.5 h-1.5 bg-surface-2"
              }`}
            />
          ))}
        </span>
        <span className="text-12 text-muted tabular-nums" dir="ltr">
          {index + 1} / {steps.length}
        </span>
        <span className="ms-auto flex items-center gap-2">
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              {t.tourPrev}
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? end() : setIndex((i) => i + 1))}
            className={buttonClass({ variant: "primary", size: "sm" })}
          >
            {last ? t.tourFinish : t.tourNext}
          </button>
        </span>
      </div>
    </div>
  );
}
