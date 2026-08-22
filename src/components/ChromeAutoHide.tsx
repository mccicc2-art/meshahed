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

/**
 * 🆕 ⚡ **بابٌ واحدٌ يقول «عُد إلى حال الرأس الآن»** (D-524).
 *
 * ================= لماذا لزم باب =================
 *
 * **الحالةُ تُشتقّ من حدث تمريرٍ مكبوحٍ بـ`requestAnimationFrame`** —
 * وهذا صحيحٌ ما دام القارئُ هو الذي يمرّر. **لكنّ سحبةَ التبويبات
 * تُنقل موضعَ التمرير نقلاً** (`scrollTo(0,0)` في التزام قلب الفهرس،
 * D-523): **الحدثُ يصل بعد الرسم، والإطارُ يُقرأ فيه إطارٌ كاملٌ
 * والصفحةُ عند رأسها والكسوةُ ما تزال مختبئة** — ثمّ تنزلق ٢٠٠م.ث
 * **بعد أن استقرّ كلُّ شيء.** **وهي الرمشةُ التي بلّغ عنها أحمد.**
 *
 * **فالإظهارُ يُطلب صراحةً عند بدء الرحلة** — **فتنزلق الكسوةُ داخل
 * زمن الحركة لا بعده** (وهو ما كان يقع تلقائيّاً قبل D-523، حين كان
 * التصفيرُ عند رفع الإصبع). **ولا رقمَ من أرقام الحركة تغيّر.**
 *
 * ⚠️ **ولا حالةَ ثانيةً تُولد**: البابُ ينادي `set` نفسَها التي يملكها
 * المستمع، **فالمالكُ واحدٌ والحقيقةُ واحدة** — ولو لم يكن هناك مستمعٌ
 * (صفحاتُ الإعدادات) لم يفعل شيئاً.
 */
let revealNow: (() => void) | null = null;
export function revealChrome() {
  revealNow?.();
}

/**
 * Bridges the one compositor transaction where iOS applies a programmatic
 * document scroll and rerasterizes the two sticky bars. The snapshot is made
 * after React rendered the destination tab and lives for four painted frames.
 */
let chromeCover: HTMLDivElement | null = null;
let chromeCoverRaf = 0;
export function coverChromeAcrossScroll() {
  chromeCover?.remove();
  chromeCover = null;
  if (chromeCoverRaf) {
    cancelAnimationFrame(chromeCoverRaf);
    chromeCoverRaf = 0;
  }

  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.setAttribute("inert", "");
  holder.dataset.chromeCover = "";
  Object.assign(holder.style, {
    position: "fixed",
    inset: "0",
    zIndex: "119",
    pointerEvents: "none",
  });

  for (const source of document.querySelectorAll<HTMLElement>(".chrome-top, .chrome-sub")) {
    const rect = source.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    Object.assign(clone.style, {
      position: "absolute",
      inset: "auto",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      maxWidth: "none",
      margin: "0",
      transform: "none",
      transition: "none",
      pointerEvents: "none",
    });
    holder.appendChild(clone);
  }

  if (!holder.childElementCount) return;
  document.body.appendChild(holder);
  chromeCover = holder;

  let paints = 0;
  const retire = () => {
    paints += 1;
    if (paints <= 4) {
      chromeCoverRaf = requestAnimationFrame(retire);
      return;
    }
    holder.remove();
    if (chromeCover === holder) chromeCover = null;
    chromeCoverRaf = 0;
  };
  chromeCoverRaf = requestAnimationFrame(retire);
}

export function ChromeAutoHide() {
  const pathname = usePathname();

  /* حزامُ أمانِ شاشة الإقلاع في المتصفّح (عطلُ آيفون ٢٠ أغسطس): التطبيق
     المثبّت يخفيها قبل أول رسم لأن iOS يملك splash أصلية. الأثر يعمل بعد
     الترطيب حتماً — فلو أعاد React في المتصفّح رسم `#lz-launch`
     بلا صنف الإذابة، أذابه هذا النداء بدل أن يعلق فوق الصفحة.
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
    /* **والبابُ يُفتح على `set` نفسِها** (D-524): يُصفّر التراكمَ كذلك
       **وإلا عاد الإخفاءُ ببكسلاتٍ قليلةٍ متبقّيةٍ من نزولٍ سابق.** */
    const mine = () => {
      acc = 0;
      set(false);
    };
    revealNow = mine;
    return () => {
      /* **ولا يُغلق إلا صاحبُه** — مستمعٌ ينتهي بعد أن وُلد غيرُه كان
         سيُغلق باباً ليس له (نفسُ درس `releaseGesture`). */
      if (revealNow === mine) revealNow = null;
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      /* السمةُ تُمحى عند المغادرة — الصفحةُ التالية تبدأ بكسوةٍ ظاهرة */
      root.removeAttribute("data-chrome");
    };
  }, [pathname]);

  return null;
}
