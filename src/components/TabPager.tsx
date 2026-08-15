"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { tap } from "@/lib/haptics";
import { setTabDrag, claimGesture, releaseGesture, gestureTakenBy } from "@/lib/tabDrag";

/**
 * **صفحاتٌ تنزلق مع الإصبع** (D-276، طلبُ أحمد بلقطةٍ من X: «احتاج فيه
 * انميشن أنه صفحة… حتى الشريط اللي تحت الاسم يمشي معك»).
 *
 * ================= الثمنُ الذي قِيل قبل البناء، ودُفع =================
 *
 * **تبويباتُ المجتمع ثلاثُ صفحاتِ خادمٍ منفصلة**، و`page.tsx` كان يشترط
 * كلَّ نداءٍ بتبويبه (D-194: «لا يُدفع إلا نداءُ القسم المفتوح»).
 * **وصفحةٌ تنزلق تحتاج جارَها مرسوماً قبل أن يُلمَس** — فلا سبيل إلى
 * الانزلاق إلا بتركيب الثلاثة معاً.
 * **فسقط الاشتراطُ وصارت كلُّ فتحةٍ تدفع نداءات الثلاثة.** **وأحمد
 * اختار هذا بعد أن قُرئ عليه الثمنُ صريحاً** — والنقضُ مسجَّلٌ في `07`.
 *
 * ================= وأربعةٌ كانت مهدَّدة، ونجت =================
 *
 * **والمخاطرةُ الحقيقيّة لم تكن النداءات بل تمريرُ الصفحة**: pager يضع
 * ثلاثَ لوحاتٍ متجاورة، **فإن صار لكلٍّ صندوقُ تمريرٍ خاصّ سقط معه**
 * الرأسُ اللاصق (`--sticky-top` يحسب على المستند)، **والسحبُ للتحديث**،
 * **وذاكرةُ التمرير**، **وشريطُ التنقّل السفليّ.**
 *
 * **فالعلاجُ أن تمريرَ المستند يبقى كما هو**: **اللوحةُ المفتوحة وحدَها
 * في التدفّق** فهي التي تحدّد ارتفاعَ الصفحة، **وجاراتُها مطلقةُ الموضع
 * ومخفيّاتٌ حتى تُلمَس.** **ولا صندوقَ تمريرٍ ثانٍ في الصفحة كلِّها** —
 * ولهذا نجت الأربعةُ بلا سطرٍ واحدٍ يمسّها.
 *
 * ⚠️ **والجارُ يُوضع عند موضع القراءة لا عند رأس اللوحة**: من مرّر ثمانمئة
 * بكسل ثم سحب، **لو وُضع الجارُ عند `top: 0` لظهر خارج الشاشة من فوق** —
 * فيُقرأ السحبُ فراغاً. **فيُوضع عند `scrollY` لحظةَ اللمس.**
 *
 * ================= والاتّجاهُ ينعكس في العربية =================
 *
 * **في LTR اللوحةُ الأولى في اليسار فالمسارُ يُزاح سالباً؛ وفي RTL هي في
 * اليمين فيُزاح موجباً.** — **وهي قاعدةُ D-216 في الإيماءة** (الموضعُ
 * منطقيٌّ لا جغرافيّ)، ونفسُ انعكاس D-274.
 */

/** منطقةُ رجوع النظام على الحافّتين — لا تُلمس (D-274) */
const EDGE = 24;
/** الأفقيُّ يجب أن يغلب الرأسيَّ بهذه النسبة قبل أن يُقفل الاتّجاه */
const RATIO = 1.4;
/** بعد هذا القدر من العرض يُسلَّم إلى التبويب التالي */
const COMMIT = 0.28;
/** أو بهذه السرعة (px/ms) وإن قصُرت المسافة — الرميةُ السريعة نيّةٌ واضحة */
const FLING = 0.45;
/** شدُّ المطاط عند الطرف الذي لا تبويبَ بعده */
const RUBBER = 0.28;
/**
 * **أزمنةُ الاستقرار ومنحناها** (D-279، طلبُ أحمد: «التمرير سريع، احتاج
 * يكون مرن وانسيابي مثل تويتر، بطيء شوي»).
 *
 * **وكان `260ms` بمنحنى `(.22,.61,.36,1)`** — وهو تباطؤٌ لطيفٌ **لكنّه
 * يبدأ سريعاً**، فتُقرأ الحركةُ قفزةً لا انزلاقاً.
 *
 * **والمنحنى الجديد `(.32,.72,0,1)` ينتهي بصفرِ ميلٍ تماماً** — **فآخرُ
 * البكسلات تزحف** وهو ما يصنع إحساسَ «الرزانة» في iOS وتويتر. **والزمنُ
 * أطول، والرجوعُ أقصرُ من الذهاب**: العودةُ إلغاءٌ يريده القارئُ سريعاً،
 * **والذهابُ رحلةٌ تُشاهَد** — وطولُها يملأ زمنَ رسم الصفحة الجديدة على
 * الخادم بدل أن يقف الشيءُ ساكناً (D-250).
 */
const EASE = "cubic-bezier(.32,.72,0,1)";
/** الرجوعُ بعد سحبٍ لم يبلغ الحدّ */
const SNAP_MS = 320;
/** والذهابُ حين يبلغه */
const FLY_MS = 420;

/** هل بدأت اللمسةُ داخل شيءٍ يمرّر أفقيّاً؟ (D-274) */
function insideXScroller(node: Element | null): boolean {
  for (let n: Element | null = node; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}

export function TabPager({
  panes,
  index,
  hrefs,
  rtl,
  children,
}: {
  /** لوحاتُ التبويبات بترتيب الصفّ الظاهر — **مكوّناتُ خادمٍ تمرّ كأبناء** */
  panes: React.ReactNode[];
  index: number;
  hrefs: string[];
  rtl: boolean;
  /** بديلٌ حين لا يكون التبويبُ من الصفّ (`?tab=all` و`?tab=news`) */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const viewport = useRef<HTMLDivElement>(null);
  /* **الحالةُ في `ref` لا في `state`** (D-250/D-246): تُقرأ في كل إطارِ
     حركة، **وإعادةُ الرسم لكل حركةِ إصبعٍ ثمنٌ بلا مقابل** — والحركةُ
     تُكتب على `style` مباشرةً. */
  const drag = useRef<{
    x: number;
    y: number;
    t: number;
    lock: null | "x" | "y";
    dx: number;
    last: number;
    lastT: number;
  } | null>(null);
  /** مؤقّتُ الحارس — انظر `reset` أدناه (D-278) */
  const guard = useRef<number | undefined>(undefined);
  /**
   * ⚠️ **مفتاحٌ نصّيٌّ لا المصفوفة نفسُها** (D-278): `hrefs` تُبنى في كل
   * رسمةٍ فهويّتُها جديدةٌ دائماً — **فالتأثيرُ كان يُعاد تركيبه مع كل
   * رسمة، ومعه `reset`.** ولو وقعت رسمةٌ من مكوّنٍ أبٍ **أثناء** سحبٍ
   * جارٍ لانقطعت الحركةُ تحت الإصبع. **والمقارنةُ بالمحتوى لا بالهويّة**
   * تجعل التركيبَ يقع عند تبدّل التبويب وحدَه.
   */
  const hrefsKey = hrefs.join("|");

  useEffect(() => {
    const vp = viewport.current;
    if (!vp || index < 0 || panes.length < 2) return;

    const track = vp.firstElementChild as HTMLElement | null;
    if (!track) return;
    const list = hrefsKey.split("|");
    const sides = [...track.children] as HTMLElement[];
    const sign = rtl ? 1 : -1;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /** **الشريطُ يمشي مع اللوحة** — رقمٌ واحدٌ يقرؤه رأسُ التبويبات */
    const publish = setTabDrag;

    /**
     * يُظهر الجارَ عند موضع القراءة الحاليّ لا عند رأس اللوحة.
     *
     * ⚠️ **ويُفتح للنافذة ارتفاعُها لحظتَها**: الصندوقُ يقصّ (`overflow:
     * clip`) وارتفاعُه ارتفاعُ اللوحة المفتوحة — **فلو كانت قصيرةً
     * (٣٩٨px) والجارُ طويلاً لظهر منه شريطٌ بقدرها وحدَه.** فيُمدّ إلى
     * أسفل الشاشة أثناء السحب ثم يُعاد. **والمدُّ نزولاً لا يزحزح موضعَ
     * القراءة** — الصفحةُ تطول تحت الإصبع لا فوقه.
     */
    const armNeighbours = () => {
      const top = Math.max(0, window.scrollY - vp.offsetTop);
      vp.style.minHeight = `${top + window.innerHeight}px`;
      sides.forEach((el, i) => {
        if (i === index) return;
        el.style.top = `${top}px`;
        el.style.visibility = "visible";
      });
    };
    const disarm = () => {
      vp.style.minHeight = "";
      sides.forEach((el, i) => {
        if (i !== index) el.style.visibility = "hidden";
      });
    };

    const setX = (dx: number, ms = 0) => {
      track.style.transition = ms ? `transform ${ms}ms ${EASE}` : "none";
      track.style.transform = `translate3d(${dx}px,0,0)`;
    };

    /**
     * **الصفرُ الأوّل — وهو ما كان ناقصاً** (D-278، بلاغُ أحمد: «بعض
     * الأحيان تختفي»).
     *
     * **العطل:** حين ينجح السحبُ **يطير المسارُ بعرض شاشةٍ كاملة** ثم
     * تُفتح الصفحة. **وReact يعيد استعمالَ العُقَد نفسِها** (نفسُ
     * الصفحة، تبويبٌ آخر) — **والأنماطُ التي كتبتُها بيدي على `style`
     * ليست ملكَه فلا يمسحها.** فتبقى `translate3d(-390px)` على مسارٍ
     * محتواه الجديد سليم: **صفحةٌ مرسومةٌ بالكامل خارج الشاشة** — وهي
     * «تختفي» التي رآها أحمد. **ولا تقع دائماً**: حين تُبنى العُقَد من
     * جديد تولد نظيفة، فالعطلُ متقطّعٌ بطبعه — **وهذا أخطرُ من عطلٍ
     * ثابت.**
     *
     * **والقاعدة:** ما يُكتب على `style` بيدٍ خارج React **يُمسح بيدٍ
     * عند كل تبدّل** — **ولا يُنتظر منه أن يُنظّف نفسَه.**
     */
    const reset = () => {
      track.style.transition = "none";
      track.style.transform = "translate3d(0,0,0)";
      vp.style.minHeight = "";
      sides.forEach((el) => {
        el.style.top = "";
        el.style.visibility = "";
      });
      setTabDrag(0);
    };
    reset();

    const onStart = (e: TouchEvent) => {
      drag.current = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      const el = e.target as Element | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (insideXScroller(el)) return;
      drag.current = {
        x: t.clientX,
        y: t.clientY,
        t: e.timeStamp,
        lock: null,
        dx: 0,
        last: t.clientX,
        lastT: e.timeStamp,
      };
    };

    const onMove = (e: TouchEvent) => {
      const s = drag.current;
      if (!s || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;

      if (s.lock === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        /* **الاتّجاهُ يُقفل مرّةً ولا يتردّد**: قارئٌ ينزل في الخطّ ويميل
           إصبعُه قليلاً **يجب ألّا تنزلق تحته الصفحة** (D-274). */
        const wantX = Math.abs(dx) > Math.abs(dy) * RATIO;
        /* **ومن سبق مَلَك** (D-277، بلاغُ أحمد «أقدر ألفّ وأسحب تحت في
           نفس الوقت»): **إن كان السحبُ للتحديث قد بدأ فاللمسةُ له**،
           ونقف نحن ساكنين إلى أن يُرفع الإصبع. */
        if (wantX && !claimGesture("x")) {
          s.lock = "y";
          return;
        }
        s.lock = wantX ? "x" : "y";
        if (s.lock === "x") armNeighbours();
      }
      if (s.lock !== "x") return;
      /* ⚠️ **وهنا كان نصفُ العطل**: المستمعُ كان `passive` **فلا يستطيع
         منعَ التمرير أصلاً** — فتنزلق اللوحاتُ وتنزل الصفحةُ معاً تحت
         الإصبع نفسِه. **والمنعُ هو ما يجعل الإيماءةَ واحدة**، ولذلك صار
         `passive: false` (انظر التسجيل أدناه). */
      if (e.cancelable) e.preventDefault();
      if (gestureTakenBy("x")) return;

      const w = vp.clientWidth || 1;
      const next = index + (dx < 0 ? 1 : -1) * (rtl ? -1 : 1);
      /* **ولا التفاف**: الطرفُ يشدّ كالمطاط ولا يعبر (D-274) */
      const damped = list[next] ? dx : dx * RUBBER;
      s.dx = damped;
      s.last = t.clientX;
      s.lastT = e.timeStamp;
      setX(damped);
      publish((sign * damped) / w);
    };

    const finish = (s: NonNullable<typeof drag.current>, e: TouchEvent) => {
      const w = vp.clientWidth || 1;
      const t = e.changedTouches[0];
      const dt = Math.max(1, e.timeStamp - s.lastT);
      const v = (t.clientX - s.last) / dt;
      const dx = s.dx;
      const next = index + (dx < 0 ? 1 : -1) * (rtl ? -1 : 1);
      const href = list[next];
      const go =
        !!href &&
        (Math.abs(dx) > w * COMMIT || (Math.abs(v) > FLING && Math.sign(v) === Math.sign(dx)));

      if (!go) {
        const ms = reduced ? 0 : SNAP_MS;
        setX(0, ms);
        publish(0, ms);
        window.setTimeout(disarm, ms);
        return;
      }

      tap(6);
      /* **تُكمل الرحلةَ ثم تُفتح** — والصفحةُ الجديدة تُرسم على الخادم،
         **فالإكمالُ يملأ زمنَ الرحلة بدل أن يقف الشيءُ ساكناً** (D-250:
         الانتظارُ حدثٌ لا مؤقّت — وهنا الحدثُ نهايةُ الحركة). */
      const ms = reduced ? 0 : FLY_MS;
      setX(Math.sign(dx) * w, ms);
      publish(Math.sign(sign * dx), ms);
      router.push(href);
      /* ⚠️ **وحارسٌ إن لم تصل** (D-278): الطبيعيُّ أن يتبدّل `index`
         فيُصفّر التأثيرُ كلَّ شيء عند إعادة تركيبه. **لكنّ نداءً يفشل أو
         يعود إلى التبويب نفسِه يترك الصفحةَ طائرةً خارج الشاشة إلى
         الأبد** — **وحالةٌ لا مخرجَ منها إلا بإعادة التحميل ليست حالة.**
         والمؤقّتُ يُلغى في التنظيف إن وصلت. */
      window.clearTimeout(guard.current);
      guard.current = window.setTimeout(() => {
        setX(0, SNAP_MS);
        publish(0, SNAP_MS);
        window.setTimeout(disarm, SNAP_MS);
      }, 1200);
    };

    const onEnd = (e: TouchEvent) => {
      const s = drag.current;
      drag.current = null;
      releaseGesture("x");
      if (!s || s.lock !== "x" || e.changedTouches.length !== 1) return;
      finish(s, e);
    };

    const onCancel = () => {
      releaseGesture("x");
      if (drag.current?.lock === "x") {
        setX(0, SNAP_MS);
        publish(0, SNAP_MS);
        window.setTimeout(disarm, SNAP_MS);
      }
      drag.current = null;
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    /* **غيرُ خاملٍ عمداً** — وهو الفرقُ بين إيماءةٍ تعمل وإيماءتين
       تتزاحمان: **`passive` تمنع `preventDefault`**، وبلا منعٍ يبقى
       المستندُ ينزل تحت الإصبع بينما اللوحاتُ تنزلق (D-277). */
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });

    /* **والجارُ يُجلب مسبقاً** فلا تنتظر الرحلةُ الشبكة */
    for (const step of [-1, 1]) {
      const h = list[index + step];
      if (h) router.prefetch(h);
    }

    return () => {
      window.clearTimeout(guard.current);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      releaseGesture("x");
      publish(0);
    };
  }, [index, hrefsKey, rtl, panes.length, router]);

  /* **خارجَ الصفّ لا pager**: `?tab=all` و`?tab=news` سطحا رابطٍ بلا
     شريحة (D-219) — **وسحبٌ منهما يقفز بالقارئ إلى مكانٍ لم يدخل منه.** */
  if (index < 0) return <>{children}</>;

  return (
    /* ⚠️ **`clip` لا `hidden`**: `hidden` يصنع صندوقَ تمريرٍ يكسر
       `position: sticky` لِما بداخله ويبتلع تمريرَ المستند في بعض
       المحرّكات، **و`clip` تقصّ ولا تُنشئ صندوقاً** — وهو الفرقُ الذي
       يُبقي الرأسَ اللاصق والسحبَ للتحديث يعملان بلا مساس.

       ⚠️⚠️ **وعلى المحورين لا على الأفقيّ وحده — وهذا عطلٌ قِيس بعد
       الشحن**: اللوحاتُ المخفيّة مطلقةُ الموضع **فلا ترفع ارتفاعَ أبيها،
       لكنّها تفيض منه** — ومع قصِّ الأفقيّ وحدَه **بقي الفيضُ الرأسيُّ
       يمدّ صفحةَ المستند**: تبويبُ «نقاش» ارتفاعُه ٣٩٨px والصفحةُ
       ٧٣٣٠px، **لأن خطَّ النشاط المخفيَّ (٧١٩٢px) كان يمدّها من تحته.**
       فيُقرأ شريطُ التمرير كذباً وتُسحب الصفحةُ إلى فراغ.
       **والقصُّ على المحورين يُنهيه** — ولا يخسر شيئاً: لا شيءَ في
       اللوحات يحتاج أن يفيض. */
    <div ref={viewport} className="relative [overflow:clip]">
      <div className="relative will-change-transform">
        {panes.map((pane, i) => (
          <div
            key={i}
            aria-hidden={i !== index}
            /* **المفتوحةُ في التدفّق وحدَها** فهي التي تعطي الصفحةَ
               ارتفاعَها، **والجاراتُ مطلقاتٌ مخفيّاتٌ حتى تُلمَس** —
               ولا صندوقَ تمريرٍ ثانٍ في الصفحة (انظر رأس الملفّ). */
            className={i === index ? "" : "absolute inset-x-0 top-0 invisible"}
            style={
              i === index
                ? undefined
                : {
                    transform: `translate3d(${(i - index) * (rtl ? -100 : 100)}%,0,0)`,
                  }
            }
          >
            {pane}
          </div>
        ))}
      </div>
    </div>
  );
}
