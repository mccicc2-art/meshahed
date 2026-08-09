"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * تسخين الوجهات — تحميل بيانات بقية التبويبات قبل أن تُطلب (طلب أحمد:
 * «من أول ما الشخص يفتح التطبيق نبدأ نحمّل بيانات باقي الصفحات وننتظر
 * تحركته»).
 *
 * الفكرة: الرئيسية تُرسم أولاً وكاملةً، وبعد أن تهدأ (idle) نطلب صفحات
 * الشريط السفلي واحدةً واحدة عبر `router.prefetch` — فتدخل كاش الراوتر
 * (D-088) جاهزةً، وأول ضغطة تبويبٍ تُعاد من الذاكرة لحظياً بدل رحلة
 * خادم. والخادم لا يتألم: جلبات TMDB/OMDb مخبّأة مشتركة، فالكلفة
 * الحقيقية استعلامات Supabase الشخصية وحدها (~50ms من الرياض).
 *
 * الضوابط — وهي جوهر التصميم لا زينته:
 *  - **بعد الخمول لا قبله** (requestIdleCallback + فواصل ٧٠٠م.ث):
 *    التسخين يجب ألا يزاحم رسم الصفحة التي طلبها المستخدم فعلاً.
 *  - **مرة واحدة في الجلسة** (علم على مستوى الوحدة): التنقّل داخل
 *    التطبيق لا يعيد إطلاق الموجة — الكاش نفسه صار دافئاً.
 *  - **موفّر البيانات يُحترم**: saveData أو شبكة 2G تعني لا تسخين —
 *    تحميلُ صفحاتٍ لم تُطلب على باقةٍ شحيحة خيانةٌ لثقة صاحبها.
 *  - **والتبويب المخفيّ لا يُسخَّن منه**: فتحٌ في خلفية المتصفح ينتظر.
 */

let warmed = false;

export function RoutePrewarm({ routes }: { routes: string[] }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (warmed) return;

    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (conn?.saveData || (conn?.effectiveType ?? "").includes("2g")) return;

    warmed = true;
    const targets = routes.filter((r) => r !== pathname);
    const timers: ReturnType<typeof setTimeout>[] = [];

    const start = () => {
      targets.forEach((href, i) => {
        timers.push(
          setTimeout(() => {
            if (!document.hidden) router.prefetch(href);
          }, i * 700),
        );
      });
    };

    // مهلة قصوى ٤ ثوانٍ: صفحةٌ لا تهدأ أبداً (فيديو خلفي مثلاً) لا
    // يجوز أن تلغي التسخين كلياً
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => start(), { timeout: 4000 });
      return () => {
        window.cancelIdleCallback(id);
        timers.forEach(clearTimeout);
      };
    }
    const t = setTimeout(start, 1500);
    return () => {
      clearTimeout(t);
      timers.forEach(clearTimeout);
    };
  }, [router, pathname, routes]);

  return null;
}
