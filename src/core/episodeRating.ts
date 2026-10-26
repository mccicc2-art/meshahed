/**
 * 🆕 D-1554 — تقييمُ الحلقة: IMDb أوّلاً دائماً، وTMDB لما لا رقمَ له في IMDb.
 *
 * بلاغُ أحمد (26 أكتوبر، Lost الموسم الأول): حلقاتٌ بلا تقييم — **ونسخةُ OMDb من IMDb ناقصة**، والسؤالُ عن الحلقة
 * مفردةً لم يجد شيئاً (R97، أُزيل). واختار أحمد: «خلي الفاضية يجي تقييم tmdb لاكن الأولوية دائما ل imdb».
 *
 * **الشروطُ الثلاثة كلُّها هنا** لأنّ الخطأ في أيٍّ منها يعيد شكوى D-132 (٩٫٣ من TMDB لعملٍ تقييمه ٧٫٨):
 * 1. **رقمُ IMDb يغلب دائماً** — لا يُحسب بديلٌ لحلقةٍ لها رقم.
 * 2. **يقينُ الغياب** (D-172): `imdbKnown` = ردَّ OMDb ردّاً صحيحاً. حصّةٌ محروقة ليست غياباً.
 * 3. **عتبةُ أصوات** (`TMDB_EPISODE_MIN_VOTES`، أحمد: «٣٠ تصويت او اكثر»): حلقةٌ بصوتين تعطي ١٠ — رقمٌ مضلِّل.
 */

/** أقلُّ عددِ أصواتٍ على الحلقة في TMDB ليُعرض تقييمُها — قرارُ أحمد ٢٦ أكتوبر */
export const TMDB_EPISODE_MIN_VOTES = 30;

/** تقييمُ TMDB البديل للحلقة، أو `null` حين لا يحقّ عرضُه */
export function episodeTmdbFallback(
  imdb: number | null | undefined,
  imdbKnown: boolean,
  voteAverage: number | null | undefined,
  voteCount: number | null | undefined,
): number | null {
  if (typeof imdb === "number" || !imdbKnown) return null;
  if (typeof voteAverage !== "number" || !(voteAverage > 0)) return null;
  if (typeof voteCount !== "number" || voteCount < TMDB_EPISODE_MIN_VOTES) return null;
  return Math.round(voteAverage * 10) / 10;
}
