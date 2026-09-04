"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { getDict, type Locale } from "@/core/i18n";
import {
  TOUR_IDS,
  TOUR_START_EVENT,
  TOUR_VERSION,
  persistTourState,
  readTourState,
  type TourId,
} from "@/lib/tour";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";

/* المحرّك يُحمَّل عند الحاجة لا مع كل صفحة (D-469): من لا جولةَ عنده
   لا يدفع ثمنَها — هذا المكوّن نفسه لا يرسم شيئاً في الحالة الشائعة. */
const TourGuide = dynamic(() => import("./TourGuide").then((m) => m.TourGuide), {
  ssr: false,
});

/**
 * بوّابة الجولة — تُركَّب في التخطيط وتصمت في الحالة الشائعة.
 *
 * ثلاث حالات: لا شيء (الأغلب) · اقتراحٌ صغير للمستخدم الجديد («ابدأ
 * الجولة» / «لاحقاً») لا يبدأ شيئاً إجبارياً · والجولة نفسها إن كانت
 * نشطة أو بُدئت من الإعدادات (حدث `loopz:tour-start`).
 *
 * الاقتراح على الرئيسية وحدها: هي أول ما يفتحه الداخل، واقتراحٌ يطارد
 * في كل صفحة إزعاجٌ لا تعريف. ويُعرض مرةً واحدة — «لاحقاً» تُسجَّل،
 * والجولة تبقى متاحةً من الإعدادات → المساعدة.
 */
export function TourMount({ locale, signedIn }: { locale: Locale; signedIn: boolean }) {
  const t = getDict(locale);
  const pathname = usePathname();
  const [mode, setMode] = useState<"idle" | "suggest" | "active">("idle");
  const [startIndex, setStartIndex] = useState(0);
  /* 🆕 **وأيُّ جولةٍ تجري** (D-852) — **والاقتراحُ التلقائيُّ للأساسيّات
     وحدَها**: **من يفتح التطبيقَ أوّلَ مرّةٍ يحتاج «كيف أستعمله» لا
     «ما الذي لا تعرف أنّه موجود»** — **والثانيةُ بابُها الإعدادات.** */
  const [tourId, setTourId] = useState<TourId>("basics");

  /* القراءة في effect لا أثناء الرسم: الخادم لا يعرف localStorage،
     وفرقُ الرسمتين يكسر الترطيب (نفس درس OneTimeHint) */
  useEffect(() => {
    if (!signedIn) return;
    /* إظهارٌ في إطارٍ لاحق لا في جسد الـeffect — قاعدة D-434 نفسها
       (نفس وصفة OneTimeHint): لا رسم متتالٍ متزامن */
    const raf = requestAnimationFrame(() => {
      const state = readTourState();
      if (state?.s === "active") {
        setStartIndex(state.i);
        setTourId(state.id ?? "basics");
        setMode("active");
        return;
      }
      if (!state && pathname === "/") {
        /* «يظهر مرة واحدة» بنصّ أحمد: يُسجَّل «اقتُرح» لحظةَ عرضه —
           في الجهاز والحساب معاً — فلا يعود ولو أُهمل بلا ضغطة. والجولة
           تبقى متاحةً دائماً من الإعدادات → المساعدة. */
        persistTourState({ v: TOUR_VERSION, id: "basics", i: 0, s: "suggested" });
        setMode("suggest");
      }
    });
    return () => cancelAnimationFrame(raf);
    // يُقرأ مرةً عند التركيب — لا يطارد المستخدم عند كل تنقّل
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  /* «ابدأ الجولة» من الإعدادات — حدثٌ لا خيطُ props عبر الشجرة كلها */
  useEffect(() => {
    /* 🆕 **والحدثُ يحمل رمزَ الجولة** (D-852) — **والقديمُ بلا حمولةٍ
       يُقرأ «الأساسيّات»** فلا ينكسر مستدعٍ لم يلحق (D-152). */
    const onStart = (e: Event) => {
      const asked = (e as CustomEvent<{ id?: TourId }>).detail?.id;
      const id: TourId = asked && TOUR_IDS.includes(asked) ? asked : "basics";
      persistTourState({ v: TOUR_VERSION, id, i: 0, s: "active" });
      setTourId(id);
      setStartIndex(0);
      setMode("active");
    };
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, []);

  if (mode === "suggest") {
    return (
      <div
        role="region"
        aria-label={t.tourSuggestTitle}
        className="sheet-pop fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-40 mx-auto w-[calc(100%-2rem)] max-w-md rounded-sheet border border-border bg-elevated shadow-2xl p-4"
      >
        <div className="flex items-center gap-3">
          <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-accent/10">
            <Icon name="sparkles" size={18} className="text-accent" />
          </span>
          <p className="min-w-0 flex-1 text-14 font-semibold" dir="auto">
            {t.tourSuggestTitle}
          </p>
          <button
            type="button"
            onClick={() => {
              /* «اقتُرح» مسجَّلٌ منذ العرض — الإخفاء يكفي هنا */
              setMode("idle");
            }}
            className={buttonClass({ variant: "ghost", size: "sm" })}
          >
            {t.tourLater}
          </button>
          <button
            type="button"
            onClick={() => {
              persistTourState({ v: TOUR_VERSION, id: "basics", i: 0, s: "active" });
              setTourId("basics");
              setStartIndex(0);
              setMode("active");
            }}
            className={buttonClass({ variant: "primary", size: "sm" })}
          >
            {t.tourStart}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "active") {
    return (
      <TourGuide locale={locale} tourId={tourId} initialIndex={startIndex} onClose={() => setMode("idle")} />
    );
  }

  return null;
}
