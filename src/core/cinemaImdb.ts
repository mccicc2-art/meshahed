/**
 * 🆕 T522 — **تقييمُ IMDb للسينما بجهدٍ أكبر** (أحمد ٢٢ نوفمبر ٢٠٢٦: «ما ابغى يجي عمل بدون تقييم .. imdb نحاول بقوة
 * اذا ما قدرنا عادي tmdb»، ثمّ «نفذ ثم ارفع»).
 *
 * **ما قِيس قبلها**: من ٢١ فيلماً معروضاً في صالات السعوديّة ستّةٌ لها رقمُ IMDb من OMDb. وOMDb تتأخّر في الجديد:
 * «Godzilla Minus Zero» على IMDb ‏٧٫٩ بثمانيةٍ وعشرين ألف صوت (في بِركتنا من ملفّ IMDb نفسِه)، وOMDb تقول «لا تقييم».
 *
 * دوالُّ صافيةٌ بلا شبكة — تُختبر وحدها، ويناديها `omdb.ts` و`cinemaImdb.ts` في `lib`.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** عمرُ «لا تقييم» لفيلمٍ صدر قبل أقلّ من ٩٠ يوماً — يُعاد سؤالُ OMDb بعده لا بعد يوم */
export const RECENT_ABSENT_TTL_MS = 6 * HOUR_MS;
/** ما يُعدّ «جديداً» — النافذةُ التي تتأخّر فيها OMDb عن IMDb */
export const RECENT_DAYS = 90;

/** فيلمٌ جديد؟ بلا تاريخٍ = جديد (لم يصدر أو لا يُعرف) */
export function isRecentRelease(date: string | null | undefined, now: number): boolean {
  const t = date ? Date.parse(date) : NaN;
  if (!Number.isFinite(t)) return true;
  return now - t < RECENT_DAYS * DAY_MS;
}

/**
 * سطرٌ من `title.ratings.tsv` (`tconst \t averageRating \t numVotes`) — **لمن نريده وحدَه**: مليونٌ ونصف سطر يُقرأ،
 * وعشرون يُحفظ. ما لا يُقرأ رقمُه يسقط بدل أن يُكتب رقماً كاذباً.
 */
export function ratingLine(
  line: string,
  wanted: ReadonlySet<string>,
): { tconst: string; rating: number; votes: number } | null {
  const a = line.indexOf("\t");
  if (a < 0) return null;
  const tconst = line.slice(0, a);
  if (!wanted.has(tconst)) return null;
  const b = line.indexOf("\t", a + 1);
  if (b < 0) return null;
  const rating = Number(line.slice(a + 1, b));
  const votes = Number(line.slice(b + 1));
  if (!Number.isFinite(rating) || rating <= 0 || rating > 10) return null;
  return { tconst, rating, votes: Number.isFinite(votes) && votes > 0 ? votes : 0 };
}

/**
 * **رقمٌ معروفٌ لا يُمحى بجواب «لا تقييم»**: ملفُّ IMDb اليوميُّ أو البِركةُ أعطيا رقماً، ثمّ أعادت OMDb سؤالَها فقالت
 * «لا تقييم» لأنها متأخّرة — فيبقى الرقمُ المعروف. وإلّا لتذبذب الملصقُ بين IMDb وTMDB كلَّ ست ساعات.
 */
export function keepKnown(
  fresh: number | null,
  known: number | null | undefined,
): number | null {
  if (fresh != null) return fresh;
  return known ?? null;
}
