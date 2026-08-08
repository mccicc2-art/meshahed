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
 * يُلحق تقييم IMDb بصفٍّ من النتائج ويعيد ترتيبه به تنازلياً (طلب أحمد:
 * «الترتيب في ديسكفري بأعلى تقييم حسب IMDb» — يُتمّ نقض D-027).
 *
 * رحلتان لكل عمل: /external_ids ثم OMDb — كلتاهما مخبّأتان (ساعة/يوم)،
 * فالكلفة الحقيقية أول عرضٍ بعد انتهاء الخبيئة فقط. والدفعات من ٢٥
 * تُبقي التوازي مريحاً بدل ١٢٠ طلباً دفعةً واحدة.
 *
 * بلا مفتاح OMDb يعود الصفّ كما جاء: ترتيب TMDB القديم بلا شارات —
 * تدهورٌ صريح لا عطلٌ صامت. ومن لا تقييم له ينزل إلى الذيل مرتّباً
 * بعدد الأصوات، ولا يحمل شارةً أبداً.
 */
export async function withImdbRatings<T extends SearchResult>(rows: T[]): Promise<T[]> {
  if (!process.env.OMDB_API_KEY || rows.length === 0) return rows;
  const out = rows.map((r) => ({ ...r }));
  const CHUNK = 25;
  for (let i = 0; i < out.length; i += CHUNK) {
    await Promise.all(
      out.slice(i, i + CHUNK).map(async (r) => {
        const iid =
          r.media_type === "tv" ? await tvImdbId(r.id) : await movieImdbId(r.id);
        const ext = await externalRatings(iid);
        const n = ext?.imdb ? Number(ext.imdb) : NaN;
        r.imdb_rating = Number.isFinite(n) ? n : null;
      }),
    );
  }
  return out.sort(
    (a, b) =>
      (b.imdb_rating ?? -1) - (a.imdb_rating ?? -1) ||
      (b.vote_count ?? 0) - (a.vote_count ?? 0),
  );
}
