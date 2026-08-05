"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { flushQueue } from "@/lib/offline";

/**
 * حارس المزامنة — لا يرسم شيئاً.
 *
 * عند فتح التطبيق وعند عودة الاتصال: يعيد تشغيل طابور الأوفلاين،
 * وإن أنجز شيئاً جدّد بيانات الصفحة بصمت. لا شريط أصفر مرعب —
 * الأفعال كانت متفائلة أصلاً، فالمزامنة تفصيلٌ خلفي.
 */
export function OfflineSync() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    async function flush() {
      try {
        const done = await flushQueue();
        if (alive && done > 0) router.refresh();
      } catch {
        /* لا شيء */
      }
    }

    flush();
    window.addEventListener("online", flush);
    return () => {
      alive = false;
      window.removeEventListener("online", flush);
    };
  }, [router]);

  return null;
}
