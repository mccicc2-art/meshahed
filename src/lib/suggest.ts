import {
  getFollows,
  getProfile,
  getContentPrefs,
  getMyRatings,
  getWatchedMovieIds,
  getWatchSummary,
  getDismissedTitles,
} from "@/lib/data";
import { discoverByGenres, recommendationsFor, type SearchResult } from "@/lib/tmdb";
import { railGuard } from "@/lib/topChart";
import { localizeRows } from "@/lib/localize";
import { cache } from "react";
import type { Locale } from "@/core/i18n";
import { blendRecommendations, type Candidate, type Recommendation } from "@/core/recommend";

/**
 * محرّك الاقتراحات.
 *
 * كان يعيش داخل الصفحة الرئيسية، ونُقل هنا حين انتقل صفّ «مقترح لك» إلى
 * اكتشف: المكان الذي يُستكشف فيه الجديد. والبذور ثلاث — ما قيّمته عالياً،
 * وما تتابعه، وما شاهدته أخيراً — لأن بذرة واحدة تُنتج صفّاً كلّه من عائلة
 * عمل واحد.
 *
 * **والبذور تُترجَم قبل أن تُقتبس (D-048).** سطرُ السبب تحت كل ملصق يقتبس
 * اسم البذرة حرفياً — «لأنك تتابع «الحفرة»» — والاسم مأخوذٌ من صفٍّ مخزَّن
 * بلغة يوم الإضافة. فكان صفُّ «مقترح لك» يكتب أسماءً عربية داخل واجهةٍ
 * إنجليزية بينما كل ما حوله مترجَم: العنوان مترجَم، والملصق من TMDB
 * باللغة الصحيحة، والسبب وحده عربيّ. وهو أظهر موضعٍ يقع فيه التسرّب لأن
 * الاسم يُقرأ داخل جملة لا وحده.
 */
/**
 * 🆕 **ومخبَّأةٌ للطلب الواحد** (D-726) — `cache()` كـ`getFollows` حرفاً.
 * 🔑 **والسببُ قارئٌ ثانٍ ظهر اليوم**: «مختار لك» وصفُّ الترايلرات
 * **يقرآن الترشيحَ نفسَه في الصفحة نفسِها** — **وبلا خبيئةٍ يُخلط
 * الترشيحُ مرّتين ويُنادى TMDB مرّتين في كلِّ فتحةٍ لاكتشف.**
 * ⚠️ **والمفتاحُ هو الوسائط**: **فليطلب القارئان السقفَ نفسَه ثمّ
 * يقصّ كلٌّ حاجتَه** — **وسقفان مختلفان يُبطلان الخبيئةَ صامتين.**
 */
export const getSuggestions = cache(async function getSuggestions(
  limit = 12,
  locale: Locale = "ar",
): Promise<Recommendation[]> {
  const [rawFollows, profile, rawRatings, watchedMovieIds, summary, dismissed] =
    await Promise.all([
      getFollows(),
      getProfile(),
      getMyRatings(),
      getWatchedMovieIds(),
      getWatchSummary(),
      getDismissedTitles(),
    ]);

  if (!rawFollows.length) return [];

  /* تُترجَم البذور وحدها لا كل المكتبة: البذور ثلاثٌ من المتابعات وثلاثٌ من
     التقييمات، والسقف في `localizeRows` يحمي الباقي على كل حال */
  const [follows, myRatings] = await Promise.all([
    localizeRows(rawFollows, locale),
    localizeRows(rawRatings, locale),
  ]);

  const lastWatchedOrder = (summary ?? [])
    .slice()
    .sort((a, b) => (b.last_watched ?? "").localeCompare(a.last_watched ?? ""))
    .map((s) => s.show_tmdb_id);

  const titleById = new Map<number, string>(follows.map((f) => [f.tmdb_id, f.title]));
  const recentShowIds = lastWatchedOrder.slice(0, 4);
  /* بذورٌ أكثر وصفحتان لكلٍّ منها: بِركةٌ بمئات الأعمال حسب ذوقه —
     طلب المالك تحديثاً عشوائياً «كل مرة القائمة تتغير» (D-064) */
  const followSeeds = follows.filter((f) => !recentShowIds.includes(f.tmdb_id)).slice(0, 8);

  // ثماني درجات فأكثر بذرة، وأربع فأقل استبعاد — السلّم من عشرة
  const lovedSeeds = myRatings
    .filter((r) => r.rating >= 8)
    .sort((a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at))
    .slice(0, 8);
  const dislikedIds = myRatings.filter((r) => r.rating <= 4).map((r) => r.tmdb_id);

  const favGenres = profile?.favorite_genres ?? [];

  const [genreDiscover, followRecs, recentRecs, ratedRecs] = await Promise.all([
    /* 🆕 **وهذا المصدرُ وحدَه يُحرَس من بين الأربعة** (D-321، قاعدةُ أحمد
       «لا يظهرون إلا للشخص الذي يتابعهم»): الثلاثةُ تحته بذرتُها **عملٌ في
       مكتبته أو تقييمٌ كتبه** — فما تُرجعه امتدادُ ذوقه، وكتمُه تجاهلٌ له
       (D-194). **وهذا بذرتُه نوعٌ في ملفّه لا عملٌ يتابعه**، فكان يُدخل
       الكوريَّ والهنديَّ إلى صفٍّ شخصيٍّ **لمن لا يتابع منهما شيئاً** —
       **و«الشخصيّ» صفةُ المصدر لا صفةُ العنوان.** */
    favGenres.length
      ? discoverByGenres(favGenres, "tv")
          .then((rows) => railGuard(rows, { anime: "keep" }))
          .catch(() => [] as SearchResult[])
      : Promise.resolve([] as SearchResult[]),
    Promise.all(
      followSeeds.map((f) =>
        recommendationsFor(f.media_type, f.tmdb_id, 2)
          .then((rs) => ({ seed: f.title, rs }))
          .catch(() => ({ seed: f.title, rs: [] as SearchResult[] })),
      ),
    ),
    Promise.all(
      recentShowIds.map((id) =>
        recommendationsFor("tv", id, 2)
          .then((rs) => ({ seed: titleById.get(id) ?? "", rs }))
          .catch(() => ({ seed: titleById.get(id) ?? "", rs: [] as SearchResult[] })),
      ),
    ),
    Promise.all(
      lovedSeeds.map((r) =>
        recommendationsFor(r.media_type, r.tmdb_id, 2)
          .then((rs) => ({ seed: r.title ?? "", rs }))
          .catch(() => ({ seed: r.title ?? "", rs: [] as SearchResult[] })),
      ),
    ),
  ]);

  const candidates: Candidate[] = [];
  for (const { seed, rs } of ratedRecs)
    rs.forEach((r, i) => candidates.push({ result: r, source: "rated", seedTitle: seed, rank: i }));
  for (const { seed, rs } of followRecs)
    rs.forEach((r, i) => candidates.push({ result: r, source: "follows", seedTitle: seed, rank: i }));
  for (const { seed, rs } of recentRecs)
    rs.forEach((r, i) => candidates.push({ result: r, source: "recent", seedTitle: seed, rank: i }));
  genreDiscover.forEach((r, i) => candidates.push({ result: r, source: "genres", rank: i }));

  // «غير مهتم» يُستبعد ككل ما شوهد أو رُفض بتقييمٍ منخفض — قال «لا» صراحةً
  const excluded = new Set<number>([
    ...follows.map((f) => f.tmdb_id),
    ...watchedMovieIds,
    ...dislikedIds,
    ...dismissed,
  ]);

  /* 🆕 **تفضيلاتُ المحتوى تدخل هنا وحدها** (D-545): **قراءةٌ واحدةٌ
     مخبَّأةٌ للطلب** (`getContentPrefs` تقرأ صفَّ الملفّ المقروءَ أعلاه
     نفسَه) — **ولا استعلامَ لكلِّ مرشّح.** **ومن لا تفضيلاتِ له يمرّ
     بالمسار القديم بايتاً ببايت.** */
  return blendRecommendations(candidates, {
    exclude: excluded,
    limit,
    prefs: await getContentPrefs(),
  });
});
