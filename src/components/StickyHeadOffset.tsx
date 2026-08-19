"use client";

import { useEffect } from "react";

/**
 * قياسُ حافّة الترويسة اللاصقة — **رقمٌ واحدٌ تتكئ عليه رؤوسُ الأقسام**
 * (D-464، طلبُ أحمد: «إذا رفعتها من تحت، كلمة كونتنيو توقف قبل الكارد
 * والبوستر يدخل تحتها»).
 *
 * **ولماذا جافاسكربت في مسألةِ تخطيط:** رأسُ القسم يلتصق عند
 * `top: <ارتفاع الترويسة>` — **وارتفاعُ ترويسة الرئيسية ليس رقماً
 * ثابتاً**: بطاقةُ الأرقام تُخفى وتُظهر، **والتحيّةُ تلتفّ سطرين باسمٍ
 * طويل**، **و`--safe-top` تختلف بين المتصفّح والتطبيق المثبَّت**،
 * **وعلى الشاشة الواسعة تلتصق الترويسةُ تحت الشريط لا في رأس النافذة.**
 * **ورقمٌ مكتوبٌ بيدي يصير خطأً في أوّل حالةٍ من هذه الخمس** — **وخطؤه
 * يُقرأ عنواناً مقصوصاً أو فجوةً تحت الترويسة.**
 *
 * **والقياسُ حدُّ اللصق لا الارتفاعَ وحدَه**: `offsetHeight + top`
 * المحسوبة — **فالمعادلةُ نفسُها تصحّ في المقاسين** بلا فرعٍ للشاشة.
 *
 * ⚠️ **ويُراقَب لا يُقاس مرّةً**: `ResizeObserver` يلتقط تبدّلَ وضع
 * العرض وإظهارَ الأرقام، **وقياسٌ عند التحميل وحده يتخلّف عن أوّل
 * تبديل.**
 */
export function StickyHeadOffset({ id }: { id: string }) {
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const root = document.documentElement;

    const apply = () => {
      const top = parseFloat(getComputedStyle(el).top) || 0;
      root.style.setProperty("--sticky-head", `${Math.round(el.offsetHeight + top)}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      /* **يُنظَّف عند المغادرة**: المتغيّرُ على الجذر يعيش أطولَ من
         الصفحة، **ورقمُ رئيسيّةٍ غادرتَها يُزيح رأسَ صفحةٍ أخرى.** */
      root.style.removeProperty("--sticky-head");
    };
  }, [id]);

  return null;
}
