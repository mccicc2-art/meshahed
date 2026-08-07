"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { coalescedRefresh } from "./refresh";

/**
 * شبهُ فوريةٍ بلا Realtime — قرار الـ handoff: الاستطلاع أولاً.
 *
 * ما دامت شاشةُ محادثةٍ ظاهرةً نجدّد بيانات الخادم كل ستّ ثوانٍ تجديداً
 * مُجمَّعاً (`coalescedRefresh` — نافذته تمنع تراكم التجديدات مع أفعال
 * المستخدم)، ونصمت متى غابت الصفحة عن العين: الجوّال في الجيب لا يستحق
 * طلباً كل ست ثوانٍ. والعودة للظهور تجدّد فوراً فلا ينتظر العائد دورةً
 * كاملة. Realtime لاحقاً متى ثبت سلوك RLS والدوال المُعرِّفة تحت WALRUS.
 */
export function useChatPoll(enabled: boolean, intervalMs = 6000) {
  const router = useRouter();
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
}
