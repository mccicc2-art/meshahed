import { getImdbChart } from "./data";
import { rankByImdb, withImdbRatings } from "./omdb";
import { topRatedRows } from "./tmdb";

/**
 * صفٌّ في قائمة «أفضل ٢٥٠» — بشكل صفّ TMDB عمداً.
 *
 * الشكل ليس اعتباطاً: المستدعيان يمرّرانه إلى `titleOf`/`yearOf`، فلو
 * أعدنا شكلاً خاصاً لاحتاج كلٌّ منهما تحويلاً خاصاً به — وهذا بالضبط
 * موضع الانحراف الذي يوجد هذا الملف لمنعه.
 */
export interface TopRow {
  id: number;
  media_type: string;
  poster_path: string | null;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
}

/**
 * قائمة «أفضل ٢٥٠» لصنفٍ واحد — **مصدرٌ واحد لمكانين** (D-135).
 *
 * كانت المعاينة (`api/franchise`) والحفظ (`saveUniverseList`) ينسخان
 * نفس الخطوات، وفي رأس كلٍّ منهما تعليقٌ يرجو ألّا ينسى أحدٌ نسخ التغيير
 * إلى الآخر. الرجاء ليس آليةً: قائمةٌ محفوظة تخالف ما عايَنه المستخدم
 * قبل ثانية أسوأ من ترتيبٍ رديء، فالخطوات هنا مرّةً واحدة.
 *
 * **ثلاث طبقات، بهذا الترتيب:**
 *  ١) `imdb_chart` — بِركتها ملفّات IMDb كلّها؛ هذه هي القائمة الصحيحة.
 *  ٢) **ذيلٌ من مسار D-132** إن قصُرت: الأنمي خاصّةً قد لا يبلغ ٢٥٠ عملاً
 *     فوق عتبة الأصوات، وقائمةٌ من ١٨٠ بطاقة نقصٌ يراه المستخدم فوراً
 *     بينما اختلاطُ المصدر في الذيل لا يراه أحد.
 *  ٣) لا شيء من (١): كل القائمة من مسار D-132 — أضعفُ لا مكسور.
 */
export async function topChartRows(
  kind: "movie" | "tv" | "anime",
  want: number,
): Promise<TopRow[]> {
  const chart = await getImdbChart(kind, want).catch(() => []);
  const out: TopRow[] = chart.map((c) => ({
    id: c.tmdb_id,
    media_type: c.media_type,
    poster_path: c.poster_path,
    title: c.title ?? undefined,
    name: c.title ?? undefined,
  }));
  if (out.length >= want) return out.slice(0, want);

  /* **البِركة أوسع من الناقص بستّين بالمئة**: `rankByImdb` تُسقط كل عملٍ
     بلا تقييم IMDb إسقاطاً كاملاً — لا إلى الذيل — فبِركةٌ بحجم النقص
     تعني ذيلاً ناقصاً بدوره. */
  const pool = await topRatedRows(kind, Math.round(want * 1.6)).catch(() => []);
  const ranked = rankByImdb(await withImdbRatings(pool), { want });

  const seen = new Set(out.map((r) => `${r.media_type}-${r.id}`));
  for (const r of ranked) {
    if (out.length >= want) break;
    const mt = r.media_type === "tv" ? "tv" : "movie";
    const k = `${mt}-${r.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      id: r.id,
      media_type: mt,
      poster_path: r.poster_path ?? null,
      title: r.title,
      name: r.name,
      release_date: r.release_date,
      first_air_date: r.first_air_date,
    });
  }
  return out;
}
