"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * تسخينٌ عند النيّة لا قبلها (جولة أداء ٢٠ أغسطس، بديل موجات D-483).
 *
 * الموجتان القديمتان كانتا تجلبان **سبع صفحاتٍ ديناميكيّةً كاملة** فور
 * هدوء الرئيسية — سبعُ استدعاءات خادمٍ يدفعها كلُّ مستخدمٍ في كلِّ جلسة،
 * أغلبُها لصفحاتٍ لن يفتحها، وبعضُها كان يعود 503 تحت الدفعة (تخنيق
 * Vercel المرصود في 18)، **وكاشُ الراوتر ينسى الديناميكيَّ بعد دقائق**
 * فالمُسخَّنُ مبكّراً يبرد قبل أن يُضغط.
 *
 * البديل: الإصبعُ يعلن الوجهة قبل الوصول إليها — `touchstart` يسبق
 * `click` بنحو ١٠٠م.ث على اللمس، و`pointerenter`/`focus` أبكر منه على
 * المؤشّر ولوحة المفاتيح — فنبدأ جلبَ الوجهة **المقصودة وحدها** في تلك
 * الفجوة، فوق هيكل `loading.tsx` الذي يظهر فوراً. لا استدعاءَ لصفحةٍ لم
 * تُقصد، ولا موجةَ طلباتٍ متزامنة.
 *
 * الضوابط نفسها التي كانت في `RoutePrewarm`:
 *  - موفّر البيانات وشبكات 2G لا تُسخَّن.
 *  - كلُّ وجهةٍ مرّةً واحدة في عمر الصفحة (المجموعة أدناه) — الراوتر
 *    يدير صلاحية كاشه بنفسه بعدها.
 */
export function usePrefetchOnIntent() {
  const router = useRouter();
  const done = useRef<Set<string>>(new Set());

  return useCallback(
    (href: string) => {
      if (done.current.has(href)) return;
      const conn = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (conn?.saveData || (conn?.effectiveType ?? "").includes("2g")) return;
      done.current.add(href);
      router.prefetch(href);
    },
    [router],
  );
}
