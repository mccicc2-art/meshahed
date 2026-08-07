"use client";

import { useEffect } from "react";
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
 * **الثانية الاستطلاع:** يبقى كل ست ثوانٍ شبكةَ أمان — قناةٌ تسقط بصمت
 * (شبكة جوال، سبات التبويب) لا يجوز أن تُجمّد المحادثة. ويصمت الاثنان
 * متى غابت الصفحة عن العين (document.hidden)، والعودةُ تجدّد فوراً.
 */
export function useChatPoll(enabled: boolean, tables: string[] = [], intervalMs = 6000) {
  const router = useRouter();
  const tablesKey = tables.join(",");

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
      channel = ch.subscribe();
    })();

    return () => {
      alive = false;
      if (channel) channel.unsubscribe();
    };
  }, [enabled, tablesKey, router]);
}
