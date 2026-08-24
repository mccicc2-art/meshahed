"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 🔴 🆕 **حاويةٌ لاصقةٌ تعرف متى التصقت فعلاً** (D-570، بلاغُ أحمد
 * بلقطة: «فيه مشكلة في البروفايل» — نصفُ صورته مقطوعٌ وبطاقةُ الأرقام
 * غائبةٌ خلف فراغٍ أسود).
 *
 * ================= العطل، وأصلُه في إصلاحٍ سابق =================
 *
 * **D-565 أضافت طبقةً صمّاءَ فوق شريط تبويبات البروفايل** لتسدّ الشقَّ
 * الذي تتركه الترويسةُ حين تنزوي. **وكانت تُرسم دائماً** — **والشريطُ
 * في البروفايل يجلس في وسط الصفحة لا في أعلاها** (وهو ما ميّزه في
 * D-564)، **فالطبقةُ التي تسدّ شقّاً فوق شريطٍ ملتصق تغطّي محتوًى
 * حقيقيّاً فوق شريطٍ غير ملتصق**: بطاقةَ الأرقام، وسطرَ اللقب،
 * **ونصفَ الصورة الشخصيّة.**
 *
 * ⚠️ **والدرسُ هو نفسُه الذي كتبتُه في D-564 ولم أطبّقه على إصلاحي**:
 * **CSS لا تعرف «هل أنا ملتصقٌ الآن؟»** — **وكلُّ تنسيقٍ يفترض
 * الالتصاق يكسر اللحظةَ التي لا التصاقَ فيها.** **فالجوابُ أن تُقاس
 * الحالةُ لا أن تُفترض.**
 *
 * ================= القياس =================
 *
 * **`IntersectionObserver` على العنصر نفسِه** — **بلا عنصرِ استشعارٍ
 * إضافيّ**: **الابنُ الزائد في حاويةٍ ذات `space-y` يفتح فجوةً
 * جديدة**، وهو عطلٌ يستبدل عطلاً.
 *
 * **والحيلةُ في `rootMargin`**: تُرفع حافّةُ الجذر العليا إلى
 * `top + 1` — **فالعنصرُ الملتصقُ عند `top` يخرج بكسلاً واحداً عنها،
 * فتهبط نسبتُه عن الواحد.** **وغيرُ الملتصق ظاهرٌ كاملاً فنسبتُه واحد.**
 *
 * ⚠️ **وحين يمرّ الشريطُ إلى أسفل الشاشة** تهبط النسبةُ أيضاً —
 * **وهي حالةٌ لا تضرّ**: العنصرُ خارج الرؤية أصلاً، والطبقةُ معه.
 */
export function StickyStuck({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const top = parseFloat(getComputedStyle(el).top) || 0;
    const io = new IntersectionObserver(
      ([e]) => setStuck(e.intersectionRatio < 1),
      { rootMargin: `-${Math.round(top) + 1}px 0px 0px 0px`, threshold: [1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {/* **الطبقةُ عنصرٌ حقيقيٌّ لا `::before`** — **تُرسم حين تُقاس
          الحالةُ لا حين يُفترض التنسيق**، **وشرطُ JSX أوضحُ من متغيّرِ
          Tailwind يعتمد على سمةٍ تُكتب في مكانٍ آخر.** */}
      {stuck && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-full h-[var(--sticky-top)] bg-[color:var(--background)]"
        />
      )}
      {children}
    </div>
  );
}
