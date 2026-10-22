import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { StremioState } from "@/core/contracts/stremio";

/**
 * 🆕 **إشاراتُ Stremio** — استعلامٌ واحدٌ للرئيسيّة والقائمة وشاشة الربط (`GET /api/v1/me/stremio`).
 * المفتاحُ هو الوسمُ نفسُه (`me:stremio`) فيُسقطه كلُّ ردٍّ يعلنه (`invalidateTags`) بلا سطرٍ آخر.
 * ⚖️ **لغيرِ المشترك لا يُسأل الخادم أصلاً** من الرئيسيّة (`enabled`): البطاقةُ لـLoopz+ وحده، وطلبٌ بلا جوابٍ ثمنٌ بلا معنى.
 */
export const STREMIO_KEY = ["me:stremio"] as const;

export function useStremio(enabled = true) {
  return useQuery({
    queryKey: STREMIO_KEY,
    queryFn: async () => (await api<StremioState>("/api/v1/me/stremio")).data,
    enabled,
    staleTime: 60_000,
  });
}

/** «S1 E5» — أرقامٌ لاتينيّةٌ في اللغتين (D-015)، وللفيلم كلمتُه */
export function episodeLabel(s: { season: number | null; episode: number | null }, movieWord: string): string {
  return s.season != null && s.episode != null ? `S${s.season} E${s.episode}` : movieWord;
}
