"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { allowsAutoHideChrome } from "@/lib/chromeRules";

/**
 * **الكسوةُ الذكيّة** (جولة ١٩ أغسطس ليلاً، طلبُ أحمد: «عند النزول داخل
 * المحتوى يختفي الهيدر والدوك معًا، وعند الرجوع للأعلى يظهران مباشرة»)
 * — نمطُ X ويوتيوب نفسُه.
 *
 * ================= كيف يعمل =================
 *
 * مستمعُ تمريرٍ واحدٌ `passive` على النافذة، مكبوحٌ بـ`requestAnimationFrame`
 * — **فلا تصييرَ React مع أيِّ بكسل**: القرارُ يُكتب سمةً واحدةً على
 * `<html>` (`data-chrome="hidden"`)، **وCSS وحدها تحرّك الترويسةَ
 * والشريطَ** (`globals.css`). مكوّنٌ لا يعيد رسمَ نفسِه أصلاً — يرجع
 * `null` دائماً.
 *
 * ================= خمسةُ حدودٍ تمنع الإزعاج =================
 *
 * **١ · عتبةُ اتجاهٍ لا عتبةُ حركة.** المسافةُ تتراكم في اتجاهٍ واحد
 * (`acc`)، وتغييرُ الاتجاه يصفّرها — **فارتجافُ الإصبع بضعةَ بكسلاتٍ
 * لا يقلب الحالة** (النزولُ يحتاج ٢٨px متّصلة، والرجوعُ ١٢ — الرجوعُ
 * أرخص لأن المستخدم يطلب أدواتِه).
 *
 * **٢ · أعلى الصفحة ظاهران دائماً.** تحت ٢٤px من القمّة تُمحى الحالة —
 * فلا تُفتح صفحةٌ وترويستُها غائبة.
 *
 * **٣ · ولا يُقرأ ارتدادُ iOS.** `scrollY` تُقصّ إلى `[0, أقصى تمرير]`
 * قبل حساب الفرق — **الارتدادُ المطّاطيُّ عند القمّة والقاع كان سيُقرأ
 * نزولاً وهميّاً فيخفي الترويسةَ وأنت واقف.**
 *
 * **٤ · والمسارُ يُفحص عند كلِّ تنقّل** (`pathname` في الاعتماد):
 * المستمعُ القديم يُنظَّف والسمةُ تُمحى — **فلا يرث مسارٌ حالةَ مسارٍ
 * غادرتَه**، والإعداداتُ (`chromeRules`) لا يُركَّب فيها مستمعٌ أصلاً.
 *
 * **٥ · والفتحُ فوق المحتوى لا بدفعه.** الإخفاءُ `transform` خالص —
 * لا يتغيّر ارتفاعُ شيء، فلا يقفز المحتوى ولا يظهر فراغٌ أسود،
 * وموضعُ التمرير لا يتحرّك.
 *
 * ⚠️ **والقوائمُ والأوراقُ في مأمن**: فتحُ ورقةٍ يقفل تمريرَ الصفحة،
 * ولا تمريرَ يعني لا حدثَ يقلب الحالة — فتبقى الكسوةُ حيث كانت.
 */
export function ChromeAutoHide() {
  const pathname = usePathname();

  /* حزامُ أمانِ شاشة الإقلاع (عطلُ آيفون ٢٠ أغسطس): الأثرُ يعمل بعد
     الترطيب حتماً — فلو أعاد React رسمَ الجذر وأعاد معه `#lz-launch`
     بلا صنفِ الإذابة، أذابه هذا النداءُ بدل أن يعلق فوق التطبيق.
     والدالّةُ يعرّفها سكربتُ القشرة (`window.__lzMelt`) وهي idempotent. */
  useEffect(() => {
    (window as Window & { __lzMelt?: () => void }).__lzMelt?.();
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    /* الإعداداتُ وأخواتُها: لا مستمعَ ولا سمةَ — ثباتٌ كامل */
    if (!allowsAutoHideChrome(pathname)) {
      root.removeAttribute("data-chrome");
      return;
    }

    let lastY = window.scrollY;
    let acc = 0;
    let raf = 0;
    let hidden = false;

    const set = (h: boolean) => {
      if (h === hidden) return;
      hidden = h;
      if (h) root.setAttribute("data-chrome", "hidden");
      else root.removeAttribute("data-chrome");
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        /* قصُّ الارتداد — انظر الحدّ ٣ */
        const max = Math.max(0, root.scrollHeight - window.innerHeight);
        const y = Math.min(Math.max(window.scrollY, 0), max);
        const d = y - lastY;
        lastY = y;

        /* قربَ القمّة: ظاهران دائماً — انظر الحدّ ٢ */
        if (y <= 24) {
          acc = 0;
          set(false);
          return;
        }

        /* 🆕 **وقربَ القاع كذلك** (D-506، لقطةُ أحمد: «تحت أصلاً ما فيه
           شي — فيه هامش احذفه»): ذيلُ الصفحة يحجز مقعدَ الدوك، **ودوكٌ
           مختبئٌ يترك مقعدَه فراغاً أسودَ هو عينُ ما خربشه بالأحمر.**
           فحين ينتهي المحتوى تعود الكسوةُ فيمتلئ المقعدُ بصاحبه —
           **ولا شيءَ تحت القاع يستحقّ الإخفاءَ من أجله.** والقياسُ على
           `y` المقصوصة فارتدادُ iOS لا يقلبها (الحدّ ٣). */
        if (max - y <= 24) {
          acc = 0;
          set(false);
          return;
        }

        if (d === 0) return;
        /* تراكمُ اتجاهٍ واحد — انظر الحدّ ١ */
        if ((d > 0) !== (acc > 0)) acc = 0;
        acc += d;
        if (acc > 28) set(true);
        else if (acc < -12) set(false);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      /* السمةُ تُمحى عند المغادرة — الصفحةُ التالية تبدأ بكسوةٍ ظاهرة */
      root.removeAttribute("data-chrome");
    };
  }, [pathname]);

  return null;
}
