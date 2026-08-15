"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { tap } from "@/lib/haptics";

/**
 * **السحبُ الأفقيّ يبدّل التبويب** (D-274، طلبُ أحمد: «إذا مرّرت يسار أو
 * يمين في أي مكان في الشاشة يوديني صفحة الأعضاء أو صفحة الاكتيفتي»).
 *
 * ================= لماذا مكوّنٌ لا `prop` على `PageTabs` =================
 *
 * **`PageTabs` مكوّنُ خادم** ولا مستمعَ لمسٍ فيه، **والإيماءةُ تخصّ الشاشة
 * كلَّها لا صفَّ التبويبات** — فلو سكنت الرأس لما عملت في جسم الصفحة، وهو
 * بالضبط ما طلبه أحمد. **فمكوّنٌ صامتٌ يُركَّب مرّةً ويعيد `null`** — على
 * وزن `PullToRefresh` و`ScrollMemory`، **ولا عائلةَ إيماءاتٍ ثانية**
 * (D-002): الرأسيُّ هناك والأفقيُّ هنا، ولا يتقاطعان بحكم حارس النسبة.
 *
 * ================= ستّةُ حرّاسٍ كلٌّ منها يمنع عطلاً بعينه =================
 *
 * **١ · حافّةُ الشاشة متروكة** (`EDGE`): سحبُ الحافّة هو **رجوعُ النظام**
 * في iOS وأندرويد — **ومن ابتلعه كسر زرَّ الرجوع الذي لا زرَّ له.**
 *
 * **٢ · ما بدأ داخل مُمرِّرٍ أفقيٍّ ليس لنا**: صفُّ التبويبات نفسُه يمرّر
 * حين تطول الأسماء، **ورفوفُ الملصقات تمرّر** — فسحبُها كان سيقلب صفحةً
 * بدل أن يزيح رفّاً. **والفحصُ على السلف لا على الهدف**: يُصعَد في الشجرة
 * حتى يوجد `overflow-x` قابلٌ للتمرير فعلاً (`scrollWidth > clientWidth`).
 *
 * **٣ · النسبة قبل المسافة** (`RATIO`): تمريرةٌ رأسيّةٌ فيها ميلٌ أفقيّ
 * **ليست سحباً أفقيّاً** — والقارئُ الذي يقلب صفحةً بالخطأ وهو ينزل في
 * الخطّ يفقد موضعَه. **فالمسافةُ وحدَها لا تكفي حَكَماً.**
 *
 * **٤ · الزمن مسقوف** (`MAX_MS`): السحبُ حركةٌ لا رحلة، **ومن أمسك إصبعَه
 * ثانيتين يختار نصّاً أو يقرأ، لا يقلب.**
 *
 * **٥ · حقلُ الكتابة والتحديدُ مستثنيان**: تحديدُ نصٍّ حركةٌ أفقيّةٌ
 * بطبيعتها.
 *
 * **٦ · ولا التفاف** (wrap): آخرُ تبويبٍ لا يعود إلى أوّله. **دائرةٌ بلا
 * حدٍّ تُفقد القارئَ إحساسَه بالطرف**، والصفُّ فوقه يقول إن له طرفين.
 *
 * ================= والاتّجاهُ ينعكس في العربية =================
 *
 * **التاليُ في LTR على اليمين فيُجلَب بسحبٍ يساراً؛ وفي RTL على اليسار
 * فيُجلَب بسحبٍ يميناً.** **فـ«يسار» ليست «تالياً»** — وهي قاعدةُ D-216
 * نفسُها في الإيماءة: الموضعُ منطقيٌّ لا جغرافيّ.
 */

/** منطقةُ رجوع النظام على الحافّتين — لا تُلمس */
const EDGE = 24;
/** أقلُّ مسافةٍ تُقرأ سحباً */
const MIN_X = 60;
/** الأفقيُّ يجب أن يغلب الرأسيَّ بهذه النسبة */
const RATIO = 1.6;
/** وسحبٌ أطولُ من هذا ليس سحباً */
const MAX_MS = 700;

/** هل بدأت اللمسةُ داخل شيءٍ يمرّر أفقيّاً؟ */
function insideXScroller(node: Element | null): boolean {
  for (let n: Element | null = node; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}

export function TabSwipe({
  hrefs,
  index,
  rtl,
}: {
  /** روابطُ التبويبات الظاهرة بترتيب الصفّ */
  hrefs: string[];
  /** موضعُ التبويب المفتوح — **و`-1` تعني «لا سحبَ هنا»** */
  index: number;
  rtl: boolean;
}) {
  const router = useRouter();
  /* **الحالةُ في `ref` لا في `state`** (D-250): يقرؤها مستمعُ اللمس في كل
     إطار، **وإعادةُ الرسم لكل حركةِ إصبعٍ ثمنٌ بلا مقابل.** */
  const from = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    if (index < 0 || hrefs.length < 2) return;

    /* **والجارُ يُجلب مسبقاً** فتبدو النقلةُ فوريّة — نداءان لا أكثر */
    for (const step of [-1, 1]) {
      const h = hrefs[index + step];
      if (h) router.prefetch(h);
    }

    const onStart = (e: TouchEvent) => {
      from.current = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      const el = e.target as Element | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (insideXScroller(el)) return;
      from.current = { x: t.clientX, y: t.clientY, t: e.timeStamp };
    };

    const onEnd = (e: TouchEvent) => {
      const s = from.current;
      from.current = null;
      if (!s || e.changedTouches.length !== 1) return;
      if (e.timeStamp - s.t > MAX_MS) return;
      if (!window.getSelection()?.isCollapsed) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < MIN_X || Math.abs(dx) < Math.abs(dy) * RATIO) return;

      /* **سحبٌ يساراً يجلب ما على اليمين** — والعربيّةُ تعكس الطرفين */
      const forward = dx < 0 ? 1 : -1;
      const next = index + forward * (rtl ? -1 : 1);
      const href = hrefs[next];
      if (!href) return;

      tap(6);
      router.push(href);
    };

    /* **`passive` صريحة**: لا نمنع التمريرَ ولا نزاحمه — **والسحبُ يُقرأ
       بعد أن يرفع الإصبعَ لا أثناءه**، فلا يتعارض مع «السحب للتحديث». */
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", () => (from.current = null), { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [hrefs, index, rtl, router]);

  return null;
}
