import {
  getFollows,
  getProfile,
  getContentPrefs,
  getMyRatings,
  getWatchedMovieIds,
  getWatchSummary,
  getDismissedTitles,
  getLoopzPopular,
} from "@/lib/data";
import {
  discoverByGenres,
  dropKids,
  recommendationsFor,
  resultsByIds,
  topByFilter,
  trendingWeekOf,
  ANIME_KEYWORD,
  type SearchResult,
} from "@/lib/tmdb";
import { railGuard, looksAnime } from "@/lib/topChart";
import { localizeRows } from "@/lib/localize";
import { cache } from "react";
import { getDict, type Locale } from "@/core/i18n";
import { blendRecommendations, type Candidate, type Recommendation } from "@/core/recommend";
import { hasAnyPrefs, isExcludedLanguage } from "@/core/contentPrefs";
import { BROWSE_GENRES, browseGenreForId, browseGenreName, type BrowseGenre } from "@/core/browse";

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

/**
 * 🆕 D-1217 — **بذورُ الأنمي** (بلاغُ أحمد بلقطة، ١ أكتوبر: «مقترح لك» والتريلراتُ
 * غائبان عن تبويب الأنمي وهما مفعّلان في «الطريقة»).
 * 🔑 **السببُ في البذور لا في الصفّ**: `getSuggestions` تبذر من أوّل ثمانِ متابعاتٍ
 * وأحدثِ أربعٍ وما قُيِّم عالياً — **فمكتبةٌ أغلبُها مسلسلاتٌ لا تُخرج أنمي واحداً**،
 * ويُصفّي التبويبُ (`looksAnime`) البِركةَ إلى صفر فيصمت الصفّ (D-219). فهنا البذورُ
 * من متابعاته التي نوعُها «رسوم متحرّكة» (16) — **حقلُ `genres` في صفِّ المتابعة
 * نفسِه، بلا نداء** — والناتجُ يُحرس بـ`looksAnime` كالتبويب.
 * ⚠️ **ومن لا أنمي في مكتبته يأخذ الأكثرَ أصواتاً ممّا لم يضفه** (مفتاحُ الأنمي) —
 * صفٌّ «لك» بلا بذرةٍ أصدقُ من صفٍّ غائبٍ في تبويبٍ فتحه ليكتشف.
 * **مخبَّأةٌ للطلب** كأختها: «مقترح لك» والتريلراتُ يقرآنها في الطلب نفسِه.
 */
const ANIMATION_GENRE_ID = 16;
export const getAnimeSuggestions = cache(async function getAnimeSuggestions(
  locale: Locale = "ar",
): Promise<Recommendation[]> {
  const [rawFollows, rawRatings, watchedMovieIds, dismissed] = await Promise.all([
    getFollows(),
    getMyRatings(),
    getWatchedMovieIds(),
    getDismissedTitles(),
  ]);
  const excluded = new Set<number>([
    ...rawFollows.map((f) => f.tmdb_id),
    ...watchedMovieIds,
    ...rawRatings.filter((r) => r.rating <= 4).map((r) => r.tmdb_id),
    ...dismissed,
  ]);
  const seedRows = rawFollows.filter((f) => (f.genres ?? []).includes(ANIMATION_GENRE_ID) && !f.dropped).slice(0, 8);
  const candidates: Candidate[] = [];
  if (seedRows.length) {
    const seeds = await localizeRows(seedRows, locale);
    const recs = await Promise.all(
      seeds.map((f) =>
        recommendationsFor(f.media_type, f.tmdb_id, 2)
          .then((rs) => ({ seed: f.title, rs }))
          .catch(() => ({ seed: f.title, rs: [] as SearchResult[] })),
      ),
    );
    for (const { seed, rs } of recs)
      rs.filter(looksAnime).forEach((r, i) => candidates.push({ result: r, source: "follows", seedTitle: seed, rank: i }));
  }
  if (candidates.length < 10) {
    const rows = await topByFilter("tv", { keywords: [ANIME_KEYWORD] }, 40, "vote_count.desc").catch(() => [] as SearchResult[]);
    rows
      .map((r) => ({ ...r, media_type: r.media_type ?? ("tv" as const) }))
      .filter(looksAnime)
      .forEach((r, i) => candidates.push({ result: r, source: "genres", rank: i }));
  }
  return blendRecommendations(candidates, { exclude: excluded, limit: 120, prefs: await getContentPrefs() });
});

/**
 * ====== بِركةُ تبويبَي الأفلام والمسلسلات بثلاث درجات — D-1486 (أحمد ٢٠ أكتوبر ٢٠٢٦) ======
 *
 * **لماذا**: «نبي المسلسلات والأفلام أيضاً نفس نظام الأنمي — تظهر أوّل شيءٍ اللي يناسبك من أعمالٍ تابعتها، ثمّ من تصنيفاتٍ
 * تتابعها، ثمّ الأشهر حاليّاً والأكثر متابعةً». كانت الأفلامُ والمسلسلاتُ تأخذ من `getSuggestions` وحدَها، **فإن خلت خلا
 * الصفُّ** — بينما الأنمي يكمّل (`animePool`/D-1217). وهو ما أظهر التريلرات للأنمي وأخفاها عن جاريه.
 *
 * ١ · **من أعماله**: ما في البِركة العامّة لهذه الجهة (بلا أنمي) — كما كان، وهو الأوّلُ دائماً.
 * ٢ · **من أنواعه** (إن قلّ الأوّلُ عن ٢٠): أكثرُ ثلاثةِ أنواعٍ في مكتبته لهذه الجهة، **ثمّ أنواعُ ملفّه المفضّلة** («2 ب»)،
 *     الأشهرُ فيها — نداءٌ لكلِّ نوع، مخبّأٌ ساعة. السببُ «لأنك تتابع «دراما»».
 * ٣ · **الأشهر** (إن قلّ المجموعُ عن ٢٠): الأكثرُ إضافةً في مكتبات أعضاء Loopz («3 ب»، هجرة 214)، ثمّ رائجُ الأسبوع في
 *     TMDB إن لم يكفِ. السببُ «رائج الآن» («4 أ»).
 *
 * ⚖️ **حرّاسُ البِركة العامّة نفسُها في الدرجتين**: لا ما في مكتبته ولا ما شاهده ولا ما رفضه («غير مهتم» أو تقييمٌ ٤ فأقل)،
 * وأرضيّةُ التقييم ٦٫٥ (طلبُه القديم في `recommend.ts`)، واللغاتُ المستبعدة في تفضيلاته، ولا أنمي ولا أطفال ولا توك شو.
 * ⚖️ **وسقفُ التكملة أربعون**: نافذةُ قرعة التريلرات ثلاثةُ أضعاف المسبار (٤٢)، و«مقترح لك» يعرض عشراً — ما فوقها نداءاتٌ لا تُعرض.
 */
const TIER_MIN = 20;
const TIER_CAP = 40;
const TIER_GENRES_FROM_LIBRARY = 3;
const NO_GENRE_TIER = new Set(["animation"]);

async function tierGuards() {
  const [rawFollows, rawRatings, watchedMovieIds, dismissed, prefs] = await Promise.all([
    getFollows(),
    getMyRatings(),
    getWatchedMovieIds(),
    getDismissedTitles(),
    getContentPrefs(),
  ]);
  const excluded = new Set<number>([
    ...rawFollows.map((f) => f.tmdb_id),
    ...watchedMovieIds,
    ...rawRatings.filter((r) => r.rating <= 4).map((r) => r.tmdb_id),
    ...dismissed,
  ]);
  const personalize = hasAnyPrefs(prefs);
  const pass = (r: SearchResult, side: "movie" | "tv") =>
    !!r.poster_path &&
    !excluded.has(r.id) &&
    (r.vote_average ?? 0) > 6.5 &&
    !looksAnime(r) &&
    !(personalize && isExcludedLanguage(r, prefs)) &&
    railGuard([r], { anime: "drop" }).length === 1 &&
    dropKids([r], side).length === 1;
  return { follows: rawFollows, pass };
}

/** أنواعُ الدرجة الثانية لجهةٍ: أكثرُ ثلاثةٍ في مكتبته (المتروكُ لا يُعدّ) ثمّ مفضّلاتُ ملفّه، بلا تكرارٍ وبلا «رسوم متحرّكة» */
function tierGenres(
  follows: { media_type: string; genres?: number[] | null; dropped?: boolean | null }[],
  favorite: number[],
  side: "movie" | "tv",
): BrowseGenre[] {
  const count = new Map<string, number>();
  for (const f of follows) {
    if (f.media_type !== side || f.dropped) continue;
    const seen = new Set<string>();
    for (const id of f.genres ?? []) {
      const g = browseGenreForId(id);
      if (!g || seen.has(g.slug)) continue;
      seen.add(g.slug);
      count.set(g.slug, (count.get(g.slug) ?? 0) + 1);
    }
  }
  const usable = (g: BrowseGenre | null | undefined): g is BrowseGenre =>
    !!g && !NO_GENRE_TIER.has(g.slug) && (side === "movie" ? g.movie : g.tv).length > 0;
  const fromLibrary = [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => BROWSE_GENRES.find((g) => g.slug === slug))
    .filter(usable)
    .slice(0, TIER_GENRES_FROM_LIBRARY);
  const out = [...fromLibrary];
  for (const id of favorite) {
    const g = browseGenreForId(id);
    if (usable(g) && !out.some((o) => o.slug === g.slug)) out.push(g);
  }
  return out;
}

/** الدرجتان الثانية والثالثة لجهةٍ واحدة — تُنادى فقط إن قصرت الأولى. `have` ما أُخذ قبلها (يُسقط المكرّر) */
async function tierFill(side: "movie" | "tv", have: Set<string>, need: number, headCount: number): Promise<Recommendation[]> {
  const out: Recommendation[] = [];
  if (need <= 0) return out;
  const { follows, pass } = await tierGuards();
  const key = (id: number) => `${side}-${id}`;
  const take = (r: SearchResult, rec: Omit<Recommendation, "result" | "score">) => {
    const row = { ...r, media_type: side } as SearchResult;
    if (out.length >= need || have.has(key(row.id)) || !pass(row, side)) return;
    have.add(key(row.id));
    out.push({ result: row, score: 0, ...rec });
  };

  /* ٢ · من أنواعه — قوائمُ الأنواع تُدمج بالتناوب (الأوّلُ من كلٍّ ثمّ الثاني…) فلا يحتكر نوعٌ واحدٌ الصفّ */
  const profile = await getProfile().catch(() => null);
  const genres = tierGenres(follows, profile?.favorite_genres ?? [], side);
  if (genres.length) {
    const lists = await Promise.all(
      genres.map((g) =>
        topByFilter(side, { genreIds: side === "movie" ? g.movie : g.tv }, 20, "popularity.desc")
          .then((rows) => ({ g, rows }))
          .catch(() => ({ g, rows: [] as SearchResult[] })),
      ),
    );
    const longest = Math.max(0, ...lists.map((l) => l.rows.length));
    for (let i = 0; i < longest && out.length < need; i++)
      for (const { g, rows } of lists) if (rows[i]) take(rows[i], { source: "genres", tier: "genre", genreSlug: g.slug });
  }
  /* المجموعُ (الأولى + الأنواع) بلغ العتبة — الدرجةُ الثالثة لا تُطلب */
  if (headCount + out.length >= TIER_MIN) return out;

  /* ٣ · الأشهر — Loopz أوّلاً (أنواعُ الصفّ تُسقط الأنمي قبل أيِّ نداء)، ثمّ رائجُ الأسبوع */
  const loopz = (await getLoopzPopular(side))
    .filter((p) => !have.has(key(p.tmdb_id)) && !(p.genres ?? []).includes(16))
    .slice(0, need - out.length + 10);
  if (loopz.length) for (const r of await resultsByIds(side, loopz.map((p) => p.tmdb_id))) take(r, { source: "genres", tier: "trending" });
  if (out.length < need) {
    const trend = await trendingWeekOf(side).catch(() => [] as SearchResult[]);
    for (const r of trend) take(r, { source: "genres", tier: "trending" });
  }
  return out;
}

/**
 * بِركةُ تبويب الأفلام أو المسلسلات (أو «لك» بالجهتين معاً `"all"`) — الأولى من البِركة العامّة، والتكملةُ إن قلّت عن ٢٠.
 * **القارئُ الواحدُ لـ«مقترح لك» وصفِّ التريلرات وتبويب «لك» في صفحة التريلرات** («1 ج») فلا يفترق ما يقترحه كلٌّ منها.
 */
export async function tabPool(general: Recommendation[], side: "movie" | "tv" | "all"): Promise<Recommendation[]> {
  const head =
    side === "all"
      ? general
      : general.filter((s) => s.result.media_type === side && !looksAnime(s.result));
  if (head.length >= TIER_MIN) return head;
  const have = new Set(head.map((s) => `${s.result.media_type === "movie" ? "movie" : "tv"}-${s.result.id}`));
  const sides: ("movie" | "tv")[] = side === "all" ? ["movie", "tv"] : [side];
  const room = TIER_CAP - head.length;
  /* الجهتان في «لك» تتقاسمان المساحةَ بالعدل ثمّ تُدمجان بالتناوب */
  const headOf = (s: "movie" | "tv") => head.filter((h) => (h.result.media_type === "movie" ? "movie" : "tv") === s).length;
  const parts = await Promise.all(
    sides.map((s) => tierFill(s, have, Math.ceil(room / sides.length), headOf(s)).catch(() => [] as Recommendation[])),
  );
  const fill: Recommendation[] = [];
  const longest = Math.max(0, ...parts.map((p) => p.length));
  for (let i = 0; i < longest; i++) for (const p of parts) if (p[i]) fill.push(p[i]);
  /* درجةُ الأنواع قبل «رائج الآن» في الترتيب النهائيّ — الأقربُ إليه أوّلاً */
  fill.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === "genre" ? -1 : 1));
  return [...head, ...fill];
}

/** سطرُ السبب تحت البطاقة — واحدٌ لـ«مقترح لك» والتريلرات على الويب والتطبيق */
export function recoNote(s: Pick<Recommendation, "seedTitle" | "tier" | "genreSlug">, locale: Locale): string {
  const t = getDict(locale);
  if (s.seedTitle) return t.recoFrom(s.seedTitle);
  if (s.tier === "trending") return t.recoTrendingNow;
  if (s.tier === "genre") {
    const g = BROWSE_GENRES.find((x) => x.slug === s.genreSlug);
    if (g) return t.recoBecauseGenre(browseGenreName(g, locale === "en" ? "en" : "ar"));
  }
  return t.recoFromGenre;
}

/** بِركةُ تبويب الأنمي: أنميُ البِركة العامّة أوّلاً ثمّ بذورُ الأنمي، بلا تكرار */
export async function animePool(general: Recommendation[], locale: Locale): Promise<Recommendation[]> {
  const head = general.filter((s) => looksAnime(s.result));
  if (head.length >= 20) return head;
  const extra = await getAnimeSuggestions(locale).catch(() => [] as Recommendation[]);
  const seen = new Set(head.map((s) => `${s.result.media_type}-${s.result.id}`));
  return [...head, ...extra.filter((s) => !seen.has(`${s.result.media_type}-${s.result.id}`))];
}
