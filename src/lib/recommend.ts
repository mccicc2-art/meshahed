// محرّك الاقتراحات — يمزج أربع إشارات بنِسَب ثابتة مع مكافأة للتوافق بين المصادر
import type { SearchResult } from "@/lib/tmdb";

export type Source = "rated" | "follows" | "recent" | "genres";

export interface Candidate {
  result: SearchResult;
  source: Source;
  /** العمل الذي وُلِّد منه الاقتراح (لعرض سبب الترشيح) */
  seedTitle?: string;
  /** ترتيب العنصر داخل نتائج مصدره — كلما قلّ كان أقوى */
  rank: number;
}

export interface Recommendation {
  result: SearchResult;
  source: Source;
  seedTitle?: string;
  score: number;
}

/** النِّسَب المطلوبة لكل مصدر داخل القائمة النهائية */
export const MIX: Record<Source, number> = {
  rated: 0.25, // ما أعطيته ٤ أو ٥ نجوم — أصدق إشارة، لأنك قلتها صراحةً
  follows: 0.3, // ما تتابعه — أوسع صورة عن ذوقك
  recent: 0.25, // آخر ما شاهدته — مزاجك الحالي
  genres: 0.2, // أنواعك المفضّلة — تفضيل صريح لكنه عام
};

const SOURCE_WEIGHT: Record<Source, number> = {
  rated: 1.1, // تقييمك الشخصي أثقل من مجرّد المتابعة
  follows: 1.0,
  recent: 0.95,
  genres: 0.85,
};

/** مكافأة لكل مصدر إضافي يقترح نفس العمل — التوافق دليل قوة */
const CONSENSUS_BONUS = 0.35;

function baseScore(c: Candidate) {
  const rankDecay = 1 / (1 + c.rank * 0.12);
  const rating = Math.max(0, Math.min(10, c.result.vote_average ?? 0)) / 10;
  return SOURCE_WEIGHT[c.source] * (0.75 * rankDecay + 0.25 * rating);
}

/**
 * يدمج المرشّحين، يحذف المكرر والمتابَع والمشاهَد، ثم يوزّع الأماكن حسب النِّسَب.
 * أي حصة غير مكتملة تُملأ من المصادر الأخرى حتى لا يقصر عدد النتائج.
 */
export function blendRecommendations(
  candidates: Candidate[],
  opts: { exclude: Set<number>; limit: number },
): Recommendation[] {
  const byId = new Map<number, { best: Candidate; sources: Set<Source>; score: number }>();

  for (const c of candidates) {
    if (!c.result?.id || !c.result.poster_path) continue;
    if (c.result.media_type !== "tv" && c.result.media_type !== "movie") continue;
    if (opts.exclude.has(c.result.id)) continue;

    const score = baseScore(c);
    const prev = byId.get(c.result.id);
    if (!prev) {
      byId.set(c.result.id, { best: c, sources: new Set([c.source]), score });
    } else {
      prev.sources.add(c.source);
      if (score > prev.score) {
        prev.score = score;
        prev.best = c;
      }
    }
  }

  const scored: Recommendation[] = [...byId.values()].map((e) => ({
    result: e.best.result,
    source: e.best.source,
    seedTitle: e.best.seedTitle,
    score: e.score * (1 + CONSENSUS_BONUS * (e.sources.size - 1)),
  }));

  const buckets: Record<Source, Recommendation[]> = {
    rated: [],
    follows: [],
    recent: [],
    genres: [],
  };
  for (const r of scored) buckets[r.source].push(r);
  for (const k of Object.keys(buckets) as Source[]) {
    buckets[k].sort((a, b) => b.score - a.score);
  }

  const out: Recommendation[] = [];
  const taken = new Set<number>();

  // المرحلة الأولى: كل مصدر يأخذ حصته
  for (const src of ["rated", "follows", "recent", "genres"] as Source[]) {
    const quota = Math.round(opts.limit * MIX[src]);
    for (const r of buckets[src]) {
      if (out.filter((o) => o.source === src).length >= quota) break;
      if (taken.has(r.result.id)) continue;
      taken.add(r.result.id);
      out.push(r);
    }
  }

  // المرحلة الثانية: نكمّل الناقص من الأعلى تقييماً أياً كان مصدره
  if (out.length < opts.limit) {
    for (const r of scored.sort((a, b) => b.score - a.score)) {
      if (out.length >= opts.limit) break;
      if (taken.has(r.result.id)) continue;
      taken.add(r.result.id);
      out.push(r);
    }
  }

  // ترتيب نهائي بالنقاط مع الحفاظ على التنوّع: لا يزيد عملان متتاليان من نفس المصدر كثيراً
  out.sort((a, b) => b.score - a.score);
  return interleave(out).slice(0, opts.limit);
}

/** يوزّع العناصر حتى لا تتجمّع اقتراحات مصدر واحد في أول الصف */
function interleave(items: Recommendation[]): Recommendation[] {
  const queues: Record<Source, Recommendation[]> = { rated: [], follows: [], recent: [], genres: [] };
  for (const i of items) queues[i.source].push(i);

  const order: Source[] = ["rated", "follows", "recent", "genres"];
  const out: Recommendation[] = [];
  let idx = 0;
  while (out.length < items.length) {
    let moved = false;
    for (let n = 0; n < order.length; n++) {
      const src = order[(idx + n) % order.length];
      const q = queues[src];
      if (q.length) {
        out.push(q.shift()!);
        moved = true;
        break;
      }
    }
    idx++;
    if (!moved) break;
  }
  return out;
}
