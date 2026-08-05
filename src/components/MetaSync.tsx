"use client";

import { useEffect, useRef } from "react";
import { cacheFollowMeta, cacheMovieStats } from "@/lib/actions";
import type { MediaType } from "@/lib/media";

export interface FollowMeta {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
}

/**
 * يكتب الاسم المترجَم في صفّ المتابعة بعد رسم الصفحة.
 *
 * الترجمة كانت تُحسب بطلبات TMDB في كل فتحٍ للرئيسية والمكتبة إلى الأبد؛
 * الكتابة مرة واحدة تجعل الفتحات التالية صفر طلبات. لا يرسم شيئاً.
 */
export function FollowMetaSync({ rows }: { rows: FollowMeta[] }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || rows.length === 0) return;
    sent.current = true;
    void cacheFollowMeta(rows).catch(() => {});
  }, [rows]);
  return null;
}

/** نفس الفكرة لتواريخ عرض الأفلام — تاريخ الفيلم لا يُسأل TMDB عنه مرتين */
export function MovieStatsSync({ rows }: { rows: { tmdbId: number; releaseDate: string | null }[] }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || rows.length === 0) return;
    sent.current = true;
    void cacheMovieStats(rows).catch(() => {});
  }, [rows]);
  return null;
}
