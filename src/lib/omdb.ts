/**
 * تقييمات IMDb وRotten Tomatoes — عبر OMDb (طلب أحمد: «أظهر تقييمات
 * IMDb وطماطم، لا أريد تقييمات TMDB» — ينقض قرار D-027 بقرار المالك).
 *
 * TMDB لا يوزّع هذه الأرقام (حقوق)، وOMDb يوزّعها بمفتاح مجاني
 * (‏1000 طلب/يوم). المفتاح بالاسم (قاعدة المشروع): `OMDB_API_KEY`
 * يضعه أحمد في Vercel؛ غيابه يُرجع null فتختفي الشارة كلها — قرار
 * أحمد اللاحق: «التقييم فقط من IMDb أو طماطم»، فلا احتياط TMDB
 * (نجمة TMDB كانت تعرض 9.3 لعملٍ تقييمه الحقيقي 7.8).
 *
 * الجسر معرّف IMDb (tt…): يأتي مع تفاصيل الفيلم من TMDB مباشرةً،
 * وللمسلسل عبر /external_ids. والردّ مخبّأ يوماً كاملاً: التقييم يتغير
 * ببطء، والحصّة اليومية تُصان.
 */

import { movieImdbId, tvImdbId, type SearchResult } from "./tmdb";
import { createClient } from "./supabase/server";

export interface ExternalRatings {
  /** «8.1» — من IMDb */
  imdb: string | null;
  /** «92%» — من Rotten Tomatoes (يغيب عن كثير من المسلسلات) */
  rt: string | null;
}

export async function externalRatings(imdbId: string | null | undefined): Promise<ExternalRatings | null> {
  const key = process.env.OMDB_API_KEY;
  if (!key || !imdbId || !/^tt\d+$/.test(imdbId)) return null;
  try {
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${key}&i=${imdbId}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      Response?: string;
      imdbRating?: string;
      Ratings?: { Source: string; Value: string }[];
    };
    if (j.Response === "False") return null;
    const imdb = j.imdbRating && j.imdbRating !== "N/A" ? j.imdbRating : null;
    const rt = j.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value ?? null;
    if (!imdb && !rt) return null;
    return { imdb, rt };
  } catch {
    return null;
  }
}

/**
 * تقييمات IMDb لحلقات موسمٍ كامل — طلبٌ واحد للموسم كلّه.
 *
 * OMDb يعيد الموسم بحلقاته في ردٍّ واحد (`&Season=n`)، فالكلفة حلقة
 * OMDb واحدة لكل موسمٍ في اليوم لا واحدة لكل حلقة — مئات الحلقات كانت
 * ستأكل الحصة. تُجلب عند طلب المستخدم وحده (زرّ كشف التقييمات في
 * متتبّع الحلقات — مخفية افتراضياً لأنها قد تحرق الأحداث).
 * حلقة بلا تقييم («N/A» — لم تُبثّ أو لا أصوات) لا تدخل الخريطة أصلاً.
 */
export async function seasonImdbRatings(
  imdbId: string | null | undefined,
  season: number,
): Promise<Record<number, number>> {
  const key = process.env.OMDB_API_KEY;
  if (!key || !imdbId || !/^tt\d+$/.test(imdbId)) return {};
  try {
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${key}&i=${imdbId}&Season=${season}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return {};
    const j = (await res.json()) as {
      Response?: string;
      Episodes?: { Episode?: string; imdbRating?: string }[];
    };
    if (j.Response === "False" || !j.Episodes) return {};
    const out: Record<number, number> = {};
    for (const e of j.Episodes) {
      const num = Number(e.Episode);
      const rating = Number(e.imdbRating);
      if (Number.isInteger(num) && Number.isFinite(rating)) out[num] = rating;
    }
    return out;
  } catch {
    return {};
  }
}

/** عمر الصفّ المخزَّن قبل أن يستحق تجديداً من OMDb — «كل يوم مرة» */
const STORE_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredRating {
  media_type: string;
  tmdb_id: number;
  imdb_rating: number | null;
  updated_at: string;
}

/**
 * يُلحق تقييم IMDb بصفٍّ من النتائج ويعيد ترتيبه به تنازلياً (طلب أحمد:
 * «الترتيب في ديسكفري بأعلى تقييم حسب IMDb» — يُتمّ نقض D-027).
 *
 * **المخزن أولاً (طلب أحمد 9 Aug: «اسحبها واحفظها عندك وحدّثها كل يوم
 * مرة»):** جدول `imdb_ratings` في Supabase هو المصدر الأول — قراءةٌ
 * واحدة للصفّ كلّه، ولا يذهب إلى OMDb إلا ما غاب عن الجدول أو تجاوز
 * عمرُه يوماً، ثم تُكتب النتائج فيه دفعةً (`set_imdb_ratings`). هكذا
 * يدفع أولُ زائرٍ بعد انتهاء العمر كلفةَ التجديد وحده، ويقرأ الباقون
 * — عبر النشرات وإخلاءات الخبيئة كلها — من الجدول بصفر طلب OMDb.
 * والجدول غير موجود بعد (الهجرة 44 لم تُشغَّل)؟ يسقط كل شيء بصمتٍ
 * إلى مسار OMDb المباشر القديم.
 *
 * بلا مفتاح OMDb: المخزَّن يُقرأ ويُعرض، والمفقود يبقى بلا رقم IMDb
 * (وتُظهر له الواجهة رقم TMDB بنجمته الزرقاء — تعديل 9 Aug).
 * ومن لا تقييم له ينزل إلى الذيل مرتّباً بعدد الأصوات.
 */
export async function withImdbRatings<T extends SearchResult>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const out = rows.map((r) => ({ ...r }));
  const keyOf = (r: SearchResult) => `${r.media_type}-${r.id}`;

  // ===== ١ · المخزن: ما زال حيّاً (< ٢٤ ساعة) يُعتمد كما هو =====
  const stale = new Map(out.map((r) => [keyOf(r), r]));
  try {
    const supabase = await createClient();
    const ids = [...new Set(out.map((r) => r.id))];
    const { data } = await supabase
      .from("imdb_ratings")
      .select("media_type, tmdb_id, imdb_rating, updated_at")
      .in("tmdb_id", ids);
    const now = Date.now();
    for (const s of (data ?? []) as StoredRating[]) {
      const r = stale.get(`${s.media_type}-${s.tmdb_id}`);
      if (!r) continue;
      r.imdb_rating = s.imdb_rating == null ? null : Number(s.imdb_rating);
      if (now - new Date(s.updated_at).getTime() < STORE_TTL_MS) {
        stale.delete(`${s.media_type}-${s.tmdb_id}`);
      }
    }
  } catch {
    // الجدول غائب أو القراءة فشلت — الكل يمضي إلى OMDb كما قبل الهجرة
  }

  // ===== ٢ · OMDb: الغائب والمنتهي عمره فقط، بدفعات ٢٥ =====
  const toFetch = [...stale.values()];
  const fetched: { media_type: string; tmdb_id: number; imdb_id: string | null; imdb_rating: number | null }[] = [];
  if (process.env.OMDB_API_KEY && toFetch.length) {
    const CHUNK = 25;
    for (let i = 0; i < toFetch.length; i += CHUNK) {
      await Promise.all(
        toFetch.slice(i, i + CHUNK).map(async (r) => {
          const iid =
            r.media_type === "tv" ? await tvImdbId(r.id) : await movieImdbId(r.id);
          const ext = await externalRatings(iid);
          const n = ext?.imdb ? Number(ext.imdb) : NaN;
          r.imdb_rating = Number.isFinite(n) ? n : null;
          fetched.push({
            media_type: r.media_type === "tv" ? "tv" : "movie",
            tmdb_id: r.id,
            imdb_id: iid ?? null,
            imdb_rating: r.imdb_rating,
          });
        }),
      );
    }
  }

  // ===== ٣ · الكتابة للمخزن — دفعةً واحدة، وفشلها لا يعطّل العرض =====
  if (fetched.length) {
    try {
      const supabase = await createClient();
      await supabase.rpc("set_imdb_ratings", { p_rows: fetched });
    } catch {
      /* الهجرة لم تُشغَّل بعد — الخبيئة اليومية لطبقة fetch تبقى الشبكة */
    }
  }

  // لا مخزن ولا مفتاح — الصفّ يعود كما جاء بترتيب TMDB (تدهور صريح)
  if (!out.some((r) => r.imdb_rating !== undefined)) return rows;

  return out.sort(
    (a, b) =>
      (b.imdb_rating ?? -1) - (a.imdb_rating ?? -1) ||
      (b.vote_count ?? 0) - (a.vote_count ?? 0),
  );
}
