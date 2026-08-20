"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * تسخينُ **الوجهة المرجَّحة التالية وحدها** (جولة أداء ٢٠ أغسطس —
 * ⚖️ نقضٌ جزئيٌّ لموجتَي D-483 بطلب أحمد: «لا prefetch لكل الصفحات
 * بشكل أعمى»).
 *
 * ما كان: موجتان تجلبان سبع صفحاتٍ ديناميكيّةً كاملة فور هدوء الرئيسية.
 * ولماذا سقط:
 *  ١) **سبعُ استدعاءات خادمٍ لكلِّ جلسة** أغلبُها لصفحاتٍ لا تُفتح —
 *     ومن لم يفتح `/news` يوماً كان يدفع كلفتها في كلِّ فتحة.
 *  ٢) **الدفعةُ نفسُها كانت تخنق Vercel** (503 المتقطّعة المرصودة).
 *  ٣) **كاشُ الراوتر ينسى الديناميكيَّ بعد دقائق** (`staleTimes`)،
 *     فالمُسخَّن عند الفتح يبرد قبل أن يُضغط غالباً — كلفةٌ بلا مكسب.
 *
 * البديل من جهتين:
 *  - **هنا**: وجهةٌ واحدةٌ — الأرجحُ إحصائياً بعد الرئيسية هي المكتبة —
 *    تُسخَّن بعد الخمول، فتكون أوّلُ ضغطةٍ شبهَ فوريّة.
 *  - **وفي الشريطين** (`usePrefetchOnIntent`): لمسةُ الإصبع نفسُها تسخّن
 *    وجهتها في فجوة الـ~١٠٠م.ث بين `touchstart` و`click` — لكلِّ
 *    الوجهات، بلا حدس.
 *
 * الضوابط القديمة باقية: بعد الخمول لا قبله، مرّةً في الجلسة، موفّرُ
 * البيانات و2G يُحترمان، والتبويبُ المخفيّ لا يُسخَّن منه.
 */

let warmed = false;

export function RoutePrewarm({
  likely = "/library",
  /** @deprecated D-483 — تُقبل ولا تُقرأ لرفعةٍ واحدة (وصفة D-028)، تُنزع مع مستدعيها */
  routes,
  /** @deprecated D-483 — كما فوقها */
  laterRoutes,
}: {
  likely?: string;
  routes?: string[];
  laterRoutes?: string[];
}) {
  void routes;
  void laterRoutes;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (warmed || pathname === likely) return;

    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (conn?.saveData || (conn?.effectiveType ?? "").includes("2g")) return;

    warmed = true;
    const start = () => {
      if (!document.hidden) router.prefetch(likely);
    };

    // مهلة قصوى ٤ ثوانٍ: صفحةٌ لا تهدأ أبداً لا يجوز أن تلغي التسخين كلياً
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => start(), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(start, 1500);
    return () => clearTimeout(t);
  }, [router, pathname, likely]);

  return null;
}
