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

    /* زائرٌ بلا كوكي جلسة لا يدفع supabase-js إطلاقاً (~66KB gz كانت
       تُجلب وتُفسَّر في **كل** فتحةِ صفحةٍ لمجرّد معرفة صاحب الطابور):
       الكوكي نفسُه الذي يقرؤه التخطيط (`sb-*auth-token`)، ولا طابورَ
       لمن لا حساب له. والمسجَّلُ يدفعها **عند سكون المتصفّح** لا في
       زحمة أوّل رسمة — فلا تُنافس LCP ولا أوّلَ لمسة، والربطُ يتمّ قبل
       أيّ انقطاعٍ واقعيٍّ بثوانٍ. */
    const signedIn = document.cookie
      .split("; ")
      .some((c) => c.startsWith("sb-") && c.includes("auth-token"));

    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    if (signedIn) {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(() => bind(), { timeout: 4000 });
      } else {
        timerId = setTimeout(bind, 2000);
      }
    } else {
      setOfflineUser(null); // يطهّر طوابير حساباتٍ سابقة على نفس الجهاز
    }

    window.addEventListener("online", flush);
    return () => {
      alive = false;
      if (idleId !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timerId !== null) clearTimeout(timerId);
      window.removeEventListener("online", flush);
    };
  }, [router]);

  return null;
}
