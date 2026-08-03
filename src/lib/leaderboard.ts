import type { LeaderRow } from "@/lib/data";
import { titleOf, type SearchResult } from "@/lib/tmdb";

export type LeaderTab = "upcoming" | "rated" | "watched";
export type LeaderRange = "week" | "month" | "all";
export type LeaderType = "all" | "tv" | "movie";
export type LeaderSource = "all" | "community" | "global";

export const RANGE_DAYS: Record<LeaderRange, number> = {
  week: 7,
  month: 30,
  all: 0, // 0 = بلا حدّ زمني
};

export function parseTab(v: string | undefined): LeaderTab {
  return v === "rated" || v === "watched" ? v : "upcoming";
}
export function parseRange(v: string | undefined): LeaderRange {
  return v === "month" || v === "all" ? v : "week";
}
export function parseType(v: string | undefined): LeaderType {
  return v === "tv" || v === "movie" ? v : "all";
}
export function parseSource(v: string | undefined): LeaderSource {
  return v === "community" || v === "global" ? v : "all";
}

export interface LeaderEntry {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  /** تقييم مجتمع مشاهد: المتوسط من ٥ وعدد المقيّمين */
  community: { avg: number; votes: number } | null;
  /** أرقام المشاهدة داخل مشاهد */
  watchers: { followers: number; viewers: number; episodes: number } | null;
  /** تقييم TMDB العالمي من ١٠ */
  globalRating: number | null;
  source: "community" | "global";
}

const key = (id: number, type: string) => `${type}-${id}`;

function fromTmdb(r: SearchResult): LeaderEntry {
  return {
    tmdbId: r.id,
    mediaType: r.media_type as "tv" | "movie",
    title: titleOf(r),
    posterPath: r.poster_path,
    community: null,
    watchers: null,
    globalRating: r.vote_average ? Number(r.vote_average.toFixed(1)) : null,
    source: "global",
  };
}

/**
 * يدمج ترتيب مجتمع مشاهد مع الترتيب العالمي.
 *
 * لماذا الدمج بدل الاكتفاء بواحد: التطبيق جديد، فترتيب المجتمع وحده قد
 * يطلع بثلاثة أعمال أو صفر. وترتيب TMDB وحده لا يقول شيئاً عن ذوق
 * مستخدمي مشاهد. فصفوف المجتمع تتصدّر دائماً، والعالمي يكمّل الفراغ —
 * وكل صفّ يحمل مصدره حتى لا يختلط الأمر على القارئ.
 */
export function mergeLeaders({
  community,
  global,
  type,
  source,
  limit = 30,
}: {
  community: LeaderRow[];
  global: SearchResult[];
  type: LeaderType;
  source: LeaderSource;
  limit?: number;
}): LeaderEntry[] {
  const out: LeaderEntry[] = [];
  const seen = new Set<string>();

  if (source !== "global") {
    for (const r of community) {
      if (!r.title) continue;
      const k = key(r.tmdb_id, r.media_type);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        tmdbId: r.tmdb_id,
        mediaType: r.media_type,
        title: r.title,
        posterPath: r.poster_path,
        community:
          r.avg_rating != null
            ? { avg: Number(r.avg_rating), votes: Number(r.votes ?? 0) }
            : null,
        watchers:
          r.followers != null || r.viewers != null
            ? {
                followers: Number(r.followers ?? 0),
                viewers: Number(r.viewers ?? 0),
                episodes: Number(r.episodes ?? 0),
              }
            : null,
        globalRating: null,
        source: "community",
      });
    }
  }

  if (source !== "community") {
    for (const r of global) {
      if (r.media_type !== "tv" && r.media_type !== "movie") continue;
      const k = key(r.id, r.media_type);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(fromTmdb(r));
    }
  }

  return out.filter((e) => type === "all" || e.mediaType === type).slice(0, limit);
}
