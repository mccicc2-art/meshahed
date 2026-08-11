import { getImdbChart } from "./data";
import { localizeRows } from "./localize";
import type { Locale } from "./i18n";
import type { SearchResult } from "./tmdb";
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
  /** تقييم IMDb وعدد أصواته — يأتيان مع صفّ القائمة نفسه، بلا نداءِ OMDb.
      الصفّ المرقّم يرسم الشارة منهما (D-164). */
  imdb_rating?: number;
  imdb_votes?: number;
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
    imdb_rating: typeof c.rating === "number" ? c.rating : Number(c.rating),
    imdb_votes: typeof c.votes === "number" ? c.votes : Number(c.votes),
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
      imdb_rating: r.imdb_rating ?? undefined,
      imdb_votes: r.imdb_votes ?? undefined,
    });
  }
  return out;
}

/**
 * نفس القائمة، بشكل صفٍّ جاهزٍ للعرض ومترجَمةً — لرفوف «أفضل ٥٠» (D-164).
 *
 * **ولماذا هنا لا في الصفحة:** الصفحة كانت المكان الثالث الذي يبني
 * «الأفضل» بطريقته الخاصّة، وهو أصل العطل. فالتحويل والترجمة يقعان مرّةً
 * واحدة إلى جانب المصدر، فلا يُولد مكانٌ رابع.
 *
 * **والترجمة عند العرض لا عند البناء (D-048/D-147):** الجدول يخزّن العنوان
 * مرّةً بلغة من بناه، وهذا صفٌّ لا يملكه أحد ويقرؤه الناس بلغتين — فلو
 * عُرض كما خُزّن لرأى نصفُ المستخدمين لغةَ النصف الآخر. والمحرّك مخبّأ
 * ساعةً والقائمة واحدةٌ للجميع، فالكلفة تُدفع مرّةً لا لكل زائر.
 */
export async function topChartRail(
  kind: "movie" | "tv" | "anime",
  want: number,
  locale: Locale,
): Promise<SearchResult[]> {
  const rows = await topChartRows(kind, want);
  if (rows.length === 0) return [];

  const localized = await localizeRows(
    rows.map((r) => ({
      tmdb_id: r.id,
      media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie",
      title: r.title ?? null,
      poster_path: r.poster_path,
    })),
    locale,
    want,
  );

  return rows.map((r, i) => {
    const l = localized[i];
    return {
      id: r.id,
      media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie",
      title: l?.title ?? r.title,
      name: l?.title ?? r.name,
      poster_path: l?.poster_path ?? r.poster_path,
      backdrop_path: null,
      overview: "",
      vote_average: 0,
      release_date: r.release_date,
      first_air_date: r.first_air_date,
      imdb_rating: r.imdb_rating,
      imdb_votes: r.imdb_votes,
    } as SearchResult;
  });
}
