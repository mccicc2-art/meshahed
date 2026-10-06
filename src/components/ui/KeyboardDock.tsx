"use client";

import { useEffect, useRef, useState } from "react";
import { useKeyboardInset, KEYBOARD_MIN } from "@/lib/useKeyboard";

/**
 * 🆕 **مرسى الكتابة — على حافّة النافذة المرئيّة** (D-320).
 *
 * **لماذا لا يكفي `fixed bottom-0`:** حين يفتح الكيبورد على iOS تبقى
 * عناصرُ `fixed` مربوطةً بنافذة *التخطيط* — **فيغرق الشريطُ خلف
 * الكيبورد.** و`visualViewport` هي الحقيقة: **ما حجبه الكيبورد =
 * `innerHeight - height - offsetTop`**، فيُرفع الشريطُ بهذا القياس
 * ويُعاد قياسُه مع كلِّ `resize`/`scroll` للنافذة المرئيّة —
 * **الانتظارُ حدثٌ لا مؤقّت** (D-250).
 *
 * **والعرضُ يُقاس من الفاصل لا يُفترض** (D-282): الفاصلُ `h-40` يسكن
 * عمودَ الصفحة نفسَه — أيّاً كان عرضُه — **ويحجز في التدفق مكانَ
 * الشريط كي لا يختفي آخرُ ردٍّ خلفه** (D-138). والنزفُ الجانبيُّ
 * (`bleed`) يعيد امتدادَ `-mx-4 sm:-mx-6` القديم بالقياس.
 *
 * **وحين لا كيبورد** (عتبةُ ٦٠px تُسقط تنفُّسَ أشرطة المتصفّح) يجلس
 * فوق شريط التنقّل بنفس حساب الشريط القديم — ويسقط الحسابُ من `md:`
 * حيث يختفي الشريط.
 *
 * 🆕 ٦ أكتوبر ٢٠٢٦ (بلاغُ خالد: «لازم أنزل تحت لين يظهر مكان الإرسال»): خرج من `ThreadReplies` إلى ملفِّه
 * لأنّ حقلَ الردّ في المحادثة يحتاج المرسى نفسَه — **مرسى واحدٌ لا اثنان.** و`spacer` ارتفاعُ الفاصل المحجوز
 * (محرّرُ النقاش أطولُ من سطرِ الردّ).
 */
export function KeyboardDock({ children, spacer = "h-40" }: { children: React.ReactNode; spacer?: string }) {
  const anchor = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  /* 🆕 **والقياسُ صار مشتركاً** (D-359): الارتفاعُ المحجوب من
     `useKeyboardInset` — **والعرضُ وحدَه يبقى هنا لأنه يُقاس من فاصل هذا
     المكوّن لا من النافذة** (D-282). */
  const kb = useKeyboardInset();
  useEffect(() => {
    const read = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const bleed = window.innerWidth >= 640 ? 24 : 16;
      setBox({
        left: Math.max(0, r.left - bleed),
        width: Math.min(window.innerWidth, r.width + bleed * 2),
      });
    };
    read();
    window.addEventListener("resize", read);
    window.visualViewport?.addEventListener("resize", read);
    window.visualViewport?.addEventListener("scroll", read);
    return () => {
      window.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("scroll", read);
    };
  }, []);
  const kbOpen = kb > KEYBOARD_MIN;
  return (
    <>
      <div ref={anchor} aria-hidden className={spacer} />
      <div
        className={`fixed z-30 ${
          kbOpen ? "" : "bottom-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:bottom-0"
        }`}
        style={{
          left: box ? box.left : 0,
          width: box ? box.width : "100%",
          ...(kbOpen ? { bottom: kb + 6 } : null),
        }}
      >
        <div className="px-4 sm:px-6 py-3 border-t border-[color:var(--divider)] bg-[color:var(--background)]">
          {children}
        </div>
      </div>
    </>
  );
}
