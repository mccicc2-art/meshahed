"use client";

import { useRef } from "react";
import { onTabDrag } from "@/lib/tabDrag";
import { useBeforePaint } from "@/lib/useBeforePaint";

/** **منحنى الاستقرار** — واحدٌ للشريط واللوحة (D-279) */
const EASE = "cubic-bezier(.32,.72,0,1)";

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
 *
 * ================= 🆕 ⚡ ولماذا **قبل الرسم** لا بعده (D-524) =================
 *
 * **رمشةٌ واحدةٌ فور استقرار التبويب، قِيست بالإطار على المنشور:**
 * `TabPager` يقلب الفهرسَ وينادي `setTabDrag(0)` **في التزامه قبل
 * الرسم**، **وهذا القياسُ كان في أثرٍ خامل — أي بعد الرسم.** فيقع هذا:
 *
 * | الدفعة | الزمن | ماذا |
 * |---|---|---|
 * | ١ | `+17`م.ث | الشريطُ ينطلق إلى خانة الوجهة (`717px`, ٥٢٠م.ث) |
 * | ٢ | **`+862`** | **قلبُ اللوحات** — **والشريطُ يُعاد إلى خانة التبويب القديم (`358px`) بلا انتقال** |
 * | ٣ | **`+890`** | الأثرُ الخاملُ يقيس أخيراً بالفهرس الجديد → `717px` |
 *
 * **فبين الدفعتين رسمةٌ كاملة**: **التبويبُ الجديد ظاهرٌ والشريطُ
 * الأصفرُ تحت التبويب الذي غادره القارئ.** **وهي علّةُ D-522 نفسُها
 * ناجيةً في المكوّن الوحيد الذي لم يُنقل:** الحالةُ البصريّة والمنطقيّة
 * في التزامين.
 *
 * **والعلاجُ سطر**: القياسُ يقع في **التزام القلب نفسِه** —
 * **فترتيبُ الالتزام يضمن الصحّة**: تنظيفُ هذا الأثر ثمّ `measure()`
 * بالفهرس الجديد يسبقان `setTabDrag(0)` القادمَ من `TabPager` (الشريطُ
 * أعلى الشجرة)، **فالقيمةُ التي تُرسم واحدةٌ صحيحة، ولا إطارَ بينهما.**
 */
export function TabUnderline({ index }: { index: number }) {
  const bar = useRef<HTMLSpanElement>(null);

  useBeforePaint(() => {
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

    const draw = (p: number, ms = 0) => {
      /* **المنحنى منحنى اللوحة حرفاً** (D-279) — والقيمةُ صفرٌ تحت
         الإصبع فيتبعه بلا تأخير */
      el.style.transition = ms
        ? `left ${ms}ms ${EASE}, width ${ms}ms ${EASE}`
        : "none";
      const from = rects[index];
      if (!from) return;
      /* **الجارُ في الاتّجاه المقصود، وإلا فالمختارُ نفسُه** — فلا يتمطّط
         الشريطُ نحو العدم عند الطرف (D-274: ولا التفاف) */
      const to = rects[index + (p > 0 ? 1 : -1)] ?? from;
      const k = Math.min(1, Math.abs(p));
      const x = from.x + (to.x - from.x) * k;
      const w = from.w + (to.w - from.w) * k;
      el.style.left = `${x}px`;
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
      className="pointer-events-none absolute -bottom-px left-0 h-[3px] w-0 rounded-t-full bg-accent"
    />
  );
}
