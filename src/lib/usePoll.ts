"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { coalescedRefresh } from "./refresh";
import { createClient } from "./supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * فوريةُ المحادثات — طبقتان لا واحدة (D-067 ثم D-069):
 *
 * **الأولى Realtime:** اشتراكٌ في تغييرات الجداول المسمّاة (postgres_changes
 * عبر publication الهجرة 39). وصولُ صفٍّ جديد يدفع تجديداً مُجمَّعاً خلال
 * أعشار الثانية — فالرسالة تظهر لحظة وصولها لا بعد دورة استطلاع. القراءة
 * تبقى من مسار الخادم نفسه (الدوال المحروسة بـ RLS)؛ الحدث إشارةُ إيقاظٍ
 * لا ناقلَ بيانات — فلا مسار قراءةٍ ثانٍ يُفتح ولا سياسةَ تُلتفّ.
 * وسياساتُ القراءة على جداول الرسائل أعمدةٌ مباشرة (auth.uid() = طرف) —
 * وهو ما يقيّمه WALRUS بأمان، والشرط الذي أجّل Realtime سابقاً.
 *
 * **الثانية الاستطلاع:** يبقى كل عشرين ثانية شبكةَ أمان — قناةٌ تسقط بصمت
 * (شبكة جوال، سبات التبويب) لا يجوز أن تُجمّد المحادثة. ويصمت الاثنان
 * متى غابت الصفحة عن العين (document.hidden)، والعودةُ تجدّد فوراً.
 * كانت ستّ ثوانٍ أيام كان الاستطلاعُ الناقلَ الوحيد (D-067)؛ ومنذ صار
 * Realtime هو الفوريّ (D-069) صار عبء ~10 طلبات/دقيقة لكل محادثةٍ مفتوحة
 * ثمناً بلا مقابل — العشرون تخفضه للثلث وأسوأُ حالاتها (قناة ميتة بصمت)
 * تأخيرُ ثوانٍ على مسارِ طوارئ لا على المسار الأول.
 *
 * **القيمة المعادة** حالُ القناة: `"live"` والاشتراك قائم، `"polling"`
 * وشبكةُ الأمان وحدها تعمل (تقييم 9 Aug م٥ — الواجهة تُظهر نقطةً خضراء
 * بدل أن يتساءل المستخدم إن كانت الرسائل تصل فوراً).
 */
export function useChatPoll(
  enabled: boolean,
  tables: string[] = [],
  intervalMs = 20000,
): "live" | "polling" {
  const router = useRouter();
  const tablesKey = tables.join(",");
  const [live, setLive] = useState(false);

  // شبكة الأمان — الاستطلاع (D-067)
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (!document.hidden) coalescedRefresh(router);
    }, intervalMs);
    const onVisibility = () => {
      if (!document.hidden) coalescedRefresh(router);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, router]);

  // الفورية — Realtime (D-069)
  useEffect(() => {
    if (!enabled || !tablesKey) return;
    let alive = true;
    let channel: RealtimeChannel | null = null;

    (async () => {
      const supabase = await createClient();
      if (!alive) return;
      let ch = supabase.channel(`live:${tablesKey}`);
      for (const table of tablesKey.split(",")) {
        ch = ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            // نافذةٌ قصيرة (١٥٠م.ث): تجمع دفقةَ أحداثٍ متتالية في تجديدٍ
            // واحد وتبقي الشعور فورياً
            if (!document.hidden) coalescedRefresh(router, 150);
          },
        );
      }
      // الحال من رد الاشتراك نفسه: SUBSCRIBED فوريّ، وأي انقطاع
      // (خطأ، مهلة، إغلاق) يُرجع المؤشر إلى «استطلاع» بصدق
      channel = ch.subscribe((status) => {
        if (alive) setLive(status === "SUBSCRIBED");
      });
    })();

    return () => {
      alive = false;
      setLive(false);
      if (channel) channel.unsubscribe();
    };
  }, [enabled, tablesKey, router]);

  return live ? "live" : "polling";
}
