/**
 * تقييمات IMDb وRotten Tomatoes — عبر OMDb (طلب أحمد: «أظهر تقييمات
 * IMDb وطماطم، لا أريد تقييمات TMDB» — ينقض قرار D-027 بقرار المالك).
 *
 * TMDB لا يوزّع هذه الأرقام (حقوق)، وOMDb يوزّعها بمفتاح مجاني
 * (‏1000 طلب/يوم). المفتاح بالاسم (قاعدة المشروع): `OMDB_API_KEY`
 * يضعه أحمد في Vercel؛ غيابه يُرجع null فتسقط الواجهة إلى نجمة TMDB
 * بدل فراغٍ يوحي بعطل — نمط Gemini/Trakt نفسه (D-077).
 *
 * الجسر معرّف IMDb (tt…): يأتي مع تفاصيل الفيلم من TMDB مباشرةً،
 * وللمسلسل عبر /external_ids. والردّ مخبّأ يوماً كاملاً: التقييم يتغير
 * ببطء، والحصّة اليومية تُصان.
 */

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
