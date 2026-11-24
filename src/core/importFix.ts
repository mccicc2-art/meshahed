/**
 * 🆕 T537 — **تصحيحُ مطابقةٍ قديمةٍ عند إعادة الاستيراد** (أحمد ٢٤ نوفمبر «١أ»).
 *
 * لماذا: استيرادٌ بالاسم قبل T536 أخذ أوّلَ نتيجةٍ بملصق — فدخل «Harmony and Me» مكان «Harmony» ٢٠١٠. والقاعدةُ القديمة
 * ثابتة، فإعادةُ رفع الملفّ نفسِه تعرف ما كانت ستختاره (`ResolveResult.was`) وما يُختار اليوم. ولأنّ المكتبةَ لا تقول من أين
 * جاء العمل (لا علامةَ مصدرٍ على `follows`)، يُعرض الخطأُ بثلاثة شروطٍ معاً (أحمد «١أ»: الوقت، والملف، وتأكيدُه):
 *   1. العملُ الخطأ في مكتبته **وأُضيف في نافذة استيرادٍ مسجَّل** (`import_runs`) — لا ما أضافه بيده في يومٍ آخر.
 *   2. القاعدةُ القديمة تعطيه لسطرٍ في ملفّه، والجديدةُ تعطي غيرَه — ولا يطلبه سطرٌ آخرُ في الملفّ نفسِه (يقرّره العميل).
 *   3. لم يلمسه بعد الاستيراد: لا قائمة، ولا صورةٌ اختارها، ولا إعجابٌ أو ردٌّ على رأيه، ولا تقييمٌ عُدّل بعد النافذة —
 *      ولا تقييمٌ على الصحيح يتعارض معه. وما يمرّ يُعرض عليه ليؤكّد، ولا يُنقل شيءٌ بلا ضغطته.
 * نقيّةٌ ومختبَرة (`importFix.test.ts`)؛ القراءةُ والكتابةُ في `lib/importFix.ts`.
 */

/** نافذةُ الاستيراد حول سطر «استيراداتك» (يُكتب عند الختام): من ثلاث ساعاتٍ قبله إلى عشر دقائق بعده */
export const FIX_WINDOW_BEFORE_MS = 3 * 60 * 60_000;
export const FIX_WINDOW_AFTER_MS = 10 * 60_000;
/** سقفُ ما يُفحص ويُعرض في المرّة الواحدة */
export const FIX_CAP = 300;

export type FixPair = { wrongId: number; rightId: number; rightTitle: string; rightPoster: string | null };

export type FixContext = {
  /** أوقاتُ ختام الاستيرادات المسجّلة (ISO) */
  runs: string[];
  /** المكتبة: العملُ الخطأ (فيلم) ⇐ وقتُ إضافته واسمُه */
  wrongFollows: Map<number, { addedAt: string; title: string }>;
  /** ما لمسه بعد الاستيراد: قائمة، صورةٌ مختارة، إعجابٌ أو ردٌّ على رأيه */
  touched: Set<number>;
  /** تقييمُه على العمل الخطأ: آخرُ تعديل */
  wrongRatings: Map<number, { updatedAt: string | null }>;
  /** أعمالٌ صحيحةٌ عليها تقييمٌ منه من قبل */
  rightRated: Set<number>;
};

export type FixItem = FixPair & { wrongTitle: string };

/**
 * أزواجُ «القديمُ ⇐ الجديد» من نتائج المطابقة (`ResolveResult.was`، أفلامٌ وحدها) — **وما يطلبه سطرٌ آخرُ في الملفّ نفسِه لا يُعدّ
 * خطأً** (الشرطُ الثاني): فيلمٌ اختارته القاعدةُ القديمة لسطرٍ هو الاختيارُ الصحيح لسطرٍ غيره.
 */
export function fixPairsFrom(
  resolved: Iterable<{ tmdbId: number; mediaType: "tv" | "movie"; title: string; posterPath: string | null; was?: { tmdbId: number } } | null>,
): FixPair[] {
  const rows = [...resolved].filter((r): r is NonNullable<typeof r> => !!r && r.mediaType === "movie");
  const wanted = new Set(rows.map((r) => r.tmdbId));
  const out: FixPair[] = [];
  const seen = new Set<number>();
  for (const r of rows) {
    const w = r.was?.tmdbId;
    if (!w || w === r.tmdbId || wanted.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push({ wrongId: w, rightId: r.tmdbId, rightTitle: r.title, rightPoster: r.posterPath });
  }
  return out.slice(0, FIX_CAP);
}

/** نافذةُ الاستيراد التي يقع فيها وقتٌ ما — نهايتُها، أو `null` */
export function importWindowEnd(at: string, runs: string[]): number | null {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return null;
  for (const r of runs) {
    const end = Date.parse(r);
    if (Number.isFinite(end) && t >= end - FIX_WINDOW_BEFORE_MS && t <= end + FIX_WINDOW_AFTER_MS) return end + FIX_WINDOW_AFTER_MS;
  }
  return null;
}

/** ما يُعرض للتصحيح من الأزواج — بالشروط الثلاثة، بلا تكرار، وبالسقف */
export function planImportFixes(pairs: FixPair[], ctx: FixContext): FixItem[] {
  const out: FixItem[] = [];
  const seen = new Set<number>();
  for (const p of pairs) {
    if (out.length >= FIX_CAP) break;
    if (!Number.isInteger(p.wrongId) || !Number.isInteger(p.rightId) || p.wrongId <= 0 || p.rightId <= 0) continue;
    if (p.wrongId === p.rightId || seen.has(p.wrongId)) continue;
    seen.add(p.wrongId);
    const f = ctx.wrongFollows.get(p.wrongId);
    if (!f) continue;
    const windowEnd = importWindowEnd(f.addedAt, ctx.runs);
    if (windowEnd == null) continue;
    if (ctx.touched.has(p.wrongId)) continue;
    const wr = ctx.wrongRatings.get(p.wrongId);
    if (wr) {
      if (ctx.rightRated.has(p.rightId)) continue;
      const u = wr.updatedAt ? Date.parse(wr.updatedAt) : NaN;
      /* تقييمٌ عدّله بعد النافذة = لمسه بيده (الرأيُ المستورد يُكتب بيومه القديم فيقع قبلها) */
      if (Number.isFinite(u) && u > windowEnd) continue;
    }
    out.push({ ...p, wrongTitle: f.title });
  }
  return out;
}
