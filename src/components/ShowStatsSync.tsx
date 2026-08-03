"use client";

import { useEffect, useRef } from "react";
import { cacheShowStats } from "@/lib/actions";

export interface ShowStat {
  tmdbId: number;
  total: number;
  aired: number;
  nextAirDate: string | null;
}

/**
 * يخزّن إحصاءات المسلسلات في قاعدة البيانات بعد رسم الصفحة.
 * لا يرسم شيئاً ولا يؤخّر المحتوى — والصفحة التي تستدعيه ترسل
 * الصفوف المتغيّرة فقط، فلا كتابة بلا داعٍ في كل زيارة.
 */
export function ShowStatsSync({ stats }: { stats: ShowStat[] }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || stats.length === 0) return;
    sent.current = true;
    void cacheShowStats(stats).catch(() => {});
  }, [stats]);

  return null;
}
