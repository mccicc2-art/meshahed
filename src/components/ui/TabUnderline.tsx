"use client";

import { useEffect, useRef } from "react";
import { onTabDrag } from "@/lib/tabDrag";

/**
 * **الشريطُ الأصفر يمشي مع اللوحة** (D-276، طلبُ أحمد: «حتى الشريط اللي
 * تحت الاسم يمشي معك»).
 *
 * ================= لماذا شريطٌ واحدٌ يتحرّك لا `::after` على المختار =================
 *
 * **`segmentedItem` يرسمه عنصراً زائفاً على الخانة المختارة** (D-016) —
 * **وعنصرٌ زائفٌ لا يُمسك من JS ولا يُحرَّك بين خانتين.** فحين يصير
 * الشريطُ مستمرّاً بين تبويبين لزم أن يكون **جسماً واحداً يُزاح ويُمطّ**،
 * لا ثلاثةَ أشباحٍ يظهر واحدُها.
 *
 * **ولا يُلغى الأصلُ من العائلة**: `segmentedItem` كما هو لكلِّ من
 * يستعمله (المكتبة · اكتشف)، **والإخفاءُ هنا بمحدِّدٍ موضعيٍّ على الصفّ
 * الذي طلب السحب وحدَه** — **فلا عائلةَ ثانية ولا وصفةٌ تُنسخ** (D-002).
 *
 * ⚠️ **والقياسُ من الـDOM لا من حسابٍ بالأصناف**: الخاناتُ تنمو بنصّها
 * (`flex-1 basis-auto`)، **فعرضُ كلٍّ يختلف باختلاف اسمه** — ولا يُعرف
 * إلا بقياسه. **ويُعاد القياسُ عند تغيّر المقاس** وعند تبدّل التبويب.
 */
export function TabUnderline({ index }: { index: number }) {
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = bar.current;
    const strip = el?.parentElement;
    if (!el || !strip) return;

    /** الخاناتُ وحدَها — الشريطُ نفسُه ليس منها */
    const items = () => [...strip.children].filter((c) => c !== el) as HTMLElement[];

    let rects: { x: number; w: number }[] = [];
    const measure = () => {
      const base = strip.getBoundingClientRect().left + strip.scrollLeft;
      rects = items().map((c) => {
        const r = c.getBoundingClientRect();
        return { x: r.left + strip.scrollLeft - base, w: r.width };
      });
      draw(0);
    };

    const draw = (p: number) => {
      const from = rects[index];
      if (!from) return;
      /* **الجارُ في الاتّجاه المقصود، وإلا فالمختارُ نفسُه** — فلا يتمطّط
         الشريطُ نحو العدم عند الطرف (D-274: ولا التفاف) */
      const to = rects[index + (p > 0 ? 1 : -1)] ?? from;
      const k = Math.min(1, Math.abs(p));
      const x = from.x + (to.x - from.x) * k;
      const w = from.w + (to.w - from.w) * k;
      el.style.transform = `translate3d(${x}px,0,0)`;
      el.style.width = `${w}px`;
    };

    measure();
    const off = onTabDrag(draw);
    const ro = new ResizeObserver(measure);
    ro.observe(strip);
    return () => {
      off();
      ro.disconnect();
    };
  }, [index]);

  return (
    <span
      ref={bar}
      aria-hidden
      /* **جالسٌ على الخطّ لا طائرٌ فوقه** — نفسُ `-bottom-px` و`h-[3px]`
         و`rounded-t-full` التي في `segmentedItem`، **فالشكلُ واحدٌ
         والمتحرّكُ جسمُه** (D-016، وبلاغُ أحمد ٩ أغسطس: «لا تحط خط ثاني»). */
      className="pointer-events-none absolute -bottom-px start-0 h-[3px] w-0 rounded-t-full bg-accent"
    />
  );
}
