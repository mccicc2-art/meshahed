"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { flushQueue, setOfflineUser } from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";

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

    // الطابور مُقسَّم على صاحبه: نعرف من هو أولاً (من الجلسة المحلية،
    // بلا رحلة شبكة) ثم نشغّل ما علِق له وحده
    async function bind() {
      try {
        // العميل يُجلب هنا بعد الرسم لا مع الصفحة — انظر supabase/client.ts
        const { data } = await (await createClient()).auth.getSession();
        if (!alive) return;
        setOfflineUser(data.session?.user?.id ?? null);
      } catch {
        setOfflineUser(null);
      }
      flush();
    }

    bind();
    window.addEventListener("online", flush);
    return () => {
      alive = false;
      window.removeEventListener("online", flush);
    };
  }, [router]);

  return null;
}
