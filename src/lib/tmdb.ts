// TMDB API client (v3). Requires TMDB_API_KEY in the environment.
// Server-only: never expose the key to the browser.

import { cookies } from "next/headers";
import { normalizeTerm, type MediaType } from "@/lib/media";
import { REGION_COOKIE, DEFAULT_REGION, normalizeRegion, regionChain } from "@/lib/region";

export {
  IMG,
  posterUrl,
  backdropUrl,
  profileUrl,
  titleOf,
  yearOf,
  GENRES,
  genreName,
} from "@/lib/media";
export type { MediaType } from "@/lib/media";

const BASE = "https://api.themoviedb.org/3";

// لغة بيانات TMDB تتبع لغة الواجهة **من مصدرها نفسه** (getLocale):
// الكوكي ثم لغة الجهاز. كانت هذه الدالة تسقط عند غياب الكوكي إلى العربية
// مباشرةً بينما تسقط الواجهة إلى Accept-Language — فمن جهازُه إنجليزيٌّ
// ولم يحفظ اختياراً صريحاً كان يرى واجهةً إنجليزية بعناوين عربية
// (بلاغ أحمد بلقطة الشاشة، D-072). حقيقةٌ واحدة للّغة لا اثنتان.
async function tmdbLanguage(): Promise<string> {
  try {
    const { getLocale } = await import("@/lib/locale");
    return (await getLocale()) === "en" ? "en-US" : "ar-SA";
  } catch {
    return "ar-SA";
  }
}

/**
 * بلد المشاهدة من الكوكي — يُقرأ هنا مباشرةً كما تُقرأ اللغة أعلاه.
 *
 * كل دالّةٍ تسأل TMDB عن التوفّر تبدأ من بلد المستخدم لا من ثابتٍ مكتوب،
 * لأن جواب «أين أشاهده» بلا بلدٍ ليس جواباً.
 */
async function watchRegion(): Promise<string> {
  try {
    const store = await cookies();
    return normalizeRegion(store.get(REGION_COOKIE)?.value);
  } catch {
    return DEFAULT_REGION;
  }
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not set");
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", await tmdbLanguage());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    // Cache TMDB responses for an hour; content changes slowly.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`TMDB ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface SearchResult {
  id: number;
  media_type: MediaType | "person";
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date?: string;
  release_date?: string;
  vote_average: number;
  /** عدد المصوّتين عالمياً — تُستخدم كعتبة حتى لا يتصدّر عمل بصوتين */
  vote_count?: number;
  popularity?: number;
  /** أرقام أنواع TMDB — تُستخدم لاستبعاد الرسوم من قوائم المسلسلات */
  genre_ids?: number[];
  origin_country?: string[];
  /** لغة العمل الأصلية (ISO 639-1) — تُصفّى بها القوائم الجاهزة محلياً */
  original_language?: string;
  /** العنوان بلغته الأصلية — يُطابَق في البحث إلى جانب المعروض */
  original_title?: string;
  original_name?: string;
  /** تقييم IMDb عبر OMDb — يُلحقه `withImdbRatings` بعد الجلب؛
      null = بحثنا فلم نجد، undefined = لم نبحث (لا شارة في الحالتين) */
  imdb_rating?: number | null;
  /** عدد أصوات IMDb — بلا هذا الرقم يعلو فيلمٌ بألف صوت على «الأب
      الروحي»، وهي علّة قوائمنا التي انتُقدت (D-132) */
  imdb_votes?: number | null;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
}

export interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

export interface TvDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  genres: { id: number; name: string }[];
  vote_average: number;
  status: string;
  seasons: Season[];
  next_episode_to_air: Episode | null;
  last_episode_to_air: Episode | null;
  networks: { id: number; name: string; logo_path: string | null }[];
  origin_country?: string[];
}

export interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  status: string;
  /** السلسلة التي ينتمي إليها الفيلم — مصدر «الأجزاء»، ويأتي في الاستجابة افتراضياً */
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string | null;
  } | null;
  /** معرّف IMDb (tt…) — جسر تقييمات OMDb (طلب أحمد: IMDb/طماطم) */
  imdb_id?: string | null;
}

export interface SeasonDetails {
  id: number;
  name: string;
  season_number: number;
  overview: string;
  poster_path: string | null;
  episodes: Episode[];
}

/**
 * ترتيب النتائج بجودة المطابقة لا بترتيب TMDB.
 *
 * ترتيب TMDB خليطٌ من التطابق والشعبية، فيتصدّر أحياناً عملٌ مغمور يحمل
 * الكلمة داخل عنوانه الطويل على عملٍ عنوانه هو الكلمة نفسها. السلّم هنا:
 * تطابقٌ تامّ، فبدايةٌ بالكلمة، فاحتواءٌ لها — والشعبية تفصل داخل الدرجة
 * الواحدة فقط لا فوقها. ويُقارَن العنوان المعروض والعنوان الأصلي معاً:
 * من يكتب «Breaking Bad» في واجهةٍ عربية يجب أن يجده وإن عُرض باسمٍ
 * عربي، والعكس.
 */
function matchScore(names: string[], term: string) {
  let best = 0;
  for (const n of names) {
    if (n === term) return 3;
    if (n.startsWith(term)) best = Math.max(best, 2);
    else if (n.includes(term)) best = Math.max(best, 1);
  }
  return best;
}

export async function searchMulti(query: string): Promise<SearchResult[]> {
  const raw = query.trim();
  if (!raw) return [];
  const data = await tmdb<{ results: SearchResult[] }>("/search/multi", {
    query: raw,
    include_adult: "false",
  });
  const rows = (data.results ?? []).filter(
    (r) => (r.media_type === "tv" || r.media_type === "movie") && r.poster_path,
  );

  const term = normalizeTerm(raw);
  if (!term) return rows;

  return rows
    .map((r, i) => ({
      r,
      i,
      score: matchScore(
        [r.title, r.name, r.original_title, r.original_name]
          .filter((n): n is string => !!n)
          .map(normalizeTerm),
        term,
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.r.popularity ?? 0) - (a.r.popularity ?? 0) ||
        // ترتيب TMDB يفصل عند تساوي كل شيء — لا ترتيبٌ عشوائي
        a.i - b.i,
    )
    .map((x) => x.r);
}

export async function trending(): Promise<SearchResult[]> {
  const data = await tmdb<{ results: SearchResult[] }>("/trending/all/week");
  return data.results.filter(
    (r) => (r.media_type === "tv" || r.media_type === "movie") && r.poster_path,
  );
}

// أخبار: أفلام قادمة قريباً + مسلسلات تُعرض حالياً
/**
 * أدنى ما يليق بصفّ «قادم قريباً».
 *
 * **بلاغ أحمد ٩ Aug: «خليه يعرض أقرب ١٠ أقل شي عشان يكون متناسق مع
 * البقية».** كان الصفّ يعرض ثلاث بطاقات بجانب صفوفٍ من عشرة وخمسين،
 * فيُقرأ عطلاً لا ندرة. والسبب أن `/movie/upcoming` و`/tv/on_the_air`
 * نافذتاهما فضفاضتان: أكثر ما تُرجعانه **قد صدر فعلاً**، فيسقط عند
 * تصفية «القادم فقط» ولا يبقى إلا نَفَر.
 */
const SOON_MIN = 12;

/**
 * يُكمل صفَّ «القادم» من `/discover` حين تقصّر النافذة الجاهزة.
 *
 * `/movie/upcoming` أفضل ما يُبدأ به لأنه **يعرف بلدك**: مواعيد دور
 * العرض تختلف بين البلدان، و`/discover` لا يعرفها. فنبدأ به ونكمل من
 * `discover` بترتيب الشعبية — أدقُّ ما نملك أوّلاً، ثم ما يملأ الصفّ.
 */
async function fillSoon(
  mediaType: MediaType,
  have: SearchResult[],
): Promise<SearchResult[]> {
  const today = new Date().toISOString().slice(0, 10);
  const future = have.filter((r) => ((r.release_date ?? r.first_air_date) ?? "") >= today);
  if (future.length >= SOON_MIN) return future;

  const more = await upcomingByFilter(mediaType, {} as DiscoverFilter).catch(
    () => [] as SearchResult[],
  );
  const seen = new Set(future.map((r) => r.id));
  for (const r of more) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    future.push(r);
  }
  return future;
}

export async function upcomingMovies(): Promise<SearchResult[]> {
  const data = await tmdb<{ results: SearchResult[] }>("/movie/upcoming", {
    region: await watchRegion(),
  });
  return fillSoon(
    "movie",
    data.results
      .filter((r) => r.poster_path)
      .map((r) => ({ ...r, media_type: "movie" as const })),
  );
}

/**
 * يُعرض الآن في دور السينما.
 *
 * TMDB تحصر النتيجة بمنطقة، والتوفّر يختلف بين البلدان — نبدأ ببلد
 * المستخدم ثم جيرانه ثم أمريكا حتى لا يعود القسم فارغاً لمن ليس في بلدٍ
 * مغطّى، والصفّ يسمّي البلد الذي أجاب عنه.
 */
export async function nowPlayingMovies(
  regions?: string[],
): Promise<{ region: string; results: SearchResult[] } | null> {
  const chain = regions ?? regionChain(await watchRegion());
  for (const region of chain) {
    try {
      const data = await tmdb<{ results: SearchResult[] }>("/movie/now_playing", { region });
      const rows = (data.results ?? [])
        .filter((r) => r.poster_path)
        .map((r) => ({ ...r, media_type: "movie" as const }));
      if (rows.length) return { region, results: rows.slice(0, 15) };
    } catch {
      /* نجرّب المنطقة التالية */
    }
  }
  return null;
}

export async function airingTv(): Promise<SearchResult[]> {
  const data = await tmdb<{ results: SearchResult[] }>("/tv/on_the_air");
  return fillSoon(
    "tv",
    data.results
      .filter((r) => r.poster_path)
      .map((r) => ({ ...r, media_type: "tv" as const })),
  );
}

// اقتراحات حسب الأنواع المفضّلة في البروفايل
export async function discoverByGenres(
  genreIds: number[],
  mediaType: MediaType = "tv",
): Promise<SearchResult[]> {
  if (!genreIds.length) return [];
  /* ثلاث صفحات (~٦٠) — الرافد العريض لبِركة الاقتراحات (D-064) */
  const fetched = await Promise.all(
    [1, 2, 3].map((page) =>
      tmdb<{ results: SearchResult[] }>(`/discover/${mediaType}`, {
        with_genres: genreIds.join("|"),
        sort_by: "popularity.desc",
        include_adult: "false",
        page: String(page),
      }).catch(() => ({ results: [] as SearchResult[] })),
    ),
  );
  const seen = new Set<number>();
  const rows: SearchResult[] = [];
  for (const d of fetched)
    for (const r of d.results ?? []) {
      if (!r.poster_path || seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push({ ...r, media_type: mediaType });
    }
  return rows;
}


// ترشيحات TMDB المبنية على عمل معيّن (تُستخدم كبذور لمحرّك الاقتراحات)
export async function recommendationsFor(
  mediaType: MediaType,
  id: number,
  /* صفحتان للبذرة الواحدة: ~٤٠ مرشّحاً بدل ٢٠ — طلبُ المالك بِركةً كبيرة
     تكفي تحديثاً عشوائياً لا يكرّر نفسه (D-064) */
  pages = 1,
): Promise<SearchResult[]> {
  const fetched = await Promise.all(
    Array.from({ length: Math.min(pages, 3) }, (_, i) =>
      tmdb<{ results: SearchResult[] }>(`/${mediaType}/${id}/recommendations`, {
        page: String(i + 1),
      }).catch(() => ({ results: [] as SearchResult[] })),
    ),
  );
  const seen = new Set<number>();
  const rows: SearchResult[] = [];
  for (const d of fetched)
    for (const r of d.results ?? []) {
      if (!r.poster_path || seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push({ ...r, media_type: mediaType });
    }
  return rows;
}

// ============================================================
//  الأشخاص — ممثلون ومخرجون
// ============================================================

export interface PersonResult {
  id: number;
  name: string;
  profile_path: string | null;
  /** «Acting» أو «Directing» … — يُترجَم عندنا لا عند TMDB */
  known_for_department?: string | null;
  popularity?: number;
  /** أشهر أعماله — تأتي مع نتيجة البحث بلا طلبٍ إضافي */
  known_for?: SearchResult[];
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string | null;
  /**
   * هل النبذة المعروضة إنجليزية رغم أن الواجهة عربية؟
   *
   * TMDB قاعدةٌ يحرّرها متطوّعون، والنبذ العربية شحيحة جداً خارج الأعمال
   * العربية. فبدل صفحةٍ نصفها فارغ، نسقط إلى الإنجليزية ونقولها للقارئ
   * صراحةً — لا نترجم ولا ندّعي.
   */
  biographyIsFallback: boolean;
}

/** البحث عن الأشخاص وحدهم — لصفّ «أشخاص» فوق نتائج البحث */
export async function searchPeople(query: string, limit = 12): Promise<PersonResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const data = await tmdb<{ results: PersonResult[] }>("/search/person", {
      query: q,
      include_adult: "false",
    });
    return (data.results ?? [])
      .filter((p) => p.profile_path)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * تفاصيل شخص، مع سقوطٍ للنبذة الإنجليزية عند فراغ العربية.
 *
 * الطلب الثاني لا يُرسَل إلا عند الحاجة، وهو مخبّأ ساعةً كغيره.
 */
export async function getPerson(id: number): Promise<PersonDetails | null> {
  try {
    const d = await tmdb<Omit<PersonDetails, "biographyIsFallback">>(`/person/${id}`);
    let biography = (d.biography ?? "").trim();
    let biographyIsFallback = false;

    if (!biography) {
      try {
        const en = await tmdb<{ biography?: string }>(`/person/${id}`, { language: "en-US" });
        const fallback = (en.biography ?? "").trim();
        if (fallback) {
          biography = fallback;
          biographyIsFallback = true;
        }
      } catch {
        /* بلا نبذة — الصفحة تبقى صالحة بأعماله */
      }
    }

    return { ...d, biography, biographyIsFallback };
  } catch {
    return null;
  }
}


/** أنواع «البرامج» عند TMDB: أخبار، واقع، توك شو — ليست دراما تُتابع */
const PROGRAM_TV_GENRES = new Set([10763, 10764, 10767]);

/**
 * هل هذا الظهور برنامجٌ تلفزيوني لا عملاً درامياً؟ (دفعة أحمد الثالثة)
 * ظهورات الممثلين في التوك شو تُغرق سيرتهم وقوائمهم (قائمة توم هانكس
 * كانت أغلبها برامج) — التصنيف بأنواع TMDB الثابتة لا بالاسم.
 */
export function isTvProgram(r: { media_type?: string; genre_ids?: number[] }): boolean {
  return r.media_type === "tv" && (r.genre_ids ?? []).some((g) => PROGRAM_TV_GENRES.has(g));
}

/**
 * كل أعمال الشخص، تمثيلاً وإخراجاً، أفلاماً ومسلسلات.
 *
 * `combined_credits` تُرجع كل ظهورٍ مسجَّل — بما فيه حلقةُ برنامجٍ حواري
 * ودورٌ بلا اسم. فيُصفّى ما لا ملصق له، وتُدمج الأدوار المتكرّرة لنفس
 * العمل (الممثل الذي أخرج فيلمه يظهر في `cast` و`crew` معاً)، ويُرتَّب
 * بالشعبية: صفحة الممثل سيرةٌ تبدأ بما يُعرف به، لا أرشيفٌ بترتيب TMDB.
 */
export async function getPersonCredits(id: number): Promise<SearchResult[]> {
  try {
    const data = await tmdb<{
      cast?: (SearchResult & { media_type?: string })[];
      crew?: (SearchResult & { media_type?: string; job?: string })[];
    }>(`/person/${id}/combined_credits`);

    const seen = new Set<string>();
    const out: SearchResult[] = [];
    for (const r of [...(data.cast ?? []), ...(data.crew ?? [])]) {
      if (!r.poster_path) continue;
      if (r.media_type !== "tv" && r.media_type !== "movie") continue;
      const key = `${r.media_type}-${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...r, media_type: r.media_type });
    }
    return out.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  } catch {
    return [];
  }
}

export interface CastMember {
  id: number;
  name: string;
  character: string | null;
  profile_path: string | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  profile_path: string | null;
}

/**
 * طاقم العمل — الممثلون وأهمّ من خلف الكاميرا.
 *
 * هذا الصفّ هو الباب الوحيد العملي إلى صفحات الأشخاص: بلا اسمٍ قابلٍ
 * للنقر تحت العمل، لن يصل أحدٌ إلى صفحة ممثل إلا بالبحث عنه بالاسم —
 * وهو ما لا يفعله إلا من يعرفه أصلاً.
 *
 * ومن خلف الكاميرا نأخذ المخرج والكاتب والمنتج المنفّذ وحدهم: قائمة
 * `crew` الكاملة تبلغ مئتَي اسمٍ فيها منسّق الأزياء ومساعد المونتاج،
 * وهي أرشيفٌ لا معلومة.
 */
const KEY_JOBS = ["Director", "Creator", "Writer", "Screenplay", "Executive Producer"];

export async function getCredits(
  mediaType: MediaType,
  id: number,
): Promise<{ cast: CastMember[]; crew: CrewMember[] }> {
  try {
    const data = await tmdb<{
      cast?: (CastMember & { order?: number })[];
      crew?: CrewMember[];
    }>(`/${mediaType}/${id}/credits`);

    const cast = (data.cast ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .slice(0, 20);

    const seen = new Set<number>();
    const crew: CrewMember[] = [];
    for (const job of KEY_JOBS) {
      for (const c of data.crew ?? []) {
        if (c.job !== job || seen.has(c.id)) continue;
        seen.add(c.id);
        crew.push(c);
        if (crew.length >= 6) break;
      }
      if (crew.length >= 6) break;
    }

    return { cast, crew };
  } catch {
    return { cast: [], crew: [] };
  }
}

// ============================================================
//  الأجزاء والأعمال المرتبطة
// ============================================================

export interface Collection {
  id: number;
  name: string;
  poster_path: string | null;
  /** أجزاء السلسلة مرتّبةً بتاريخ الصدور — لا بشعبيتها */
  parts: SearchResult[];
}

/**
 * أجزاء السلسلة التي ينتمي إليها فيلم.
 *
 * هذه العلاقة الوحيدة التي يمثّلها TMDB تمثيلاً صريحاً: `belongs_to_collection`
 * في تفاصيل الفيلم يعطي معرّف السلسلة، و`/collection/{id}` يعطي أجزاءها.
 * فالصفّ هنا دقيقٌ لا تخمين فيه — ولذلك يُعرض وحده فوق «أعمال مرتبطة».
 *
 * والترتيب بتاريخ الصدور تصاعدياً: من يفتح الجزء الثالث يريد أن يرى أين
 * موقعه من السلسلة، والشعبية تُقدّم الجزء الأشهر فتُخفي الترتيب الذي جاء
 * يبحث عنه.
 */
export async function getCollection(id: number): Promise<Collection | null> {
  try {
    const data = await tmdb<{
      id: number;
      name: string;
      poster_path: string | null;
      parts?: (SearchResult & { release_date?: string })[];
    }>(`/collection/${id}`);

    const parts = (data.parts ?? [])
      .filter((p) => p.poster_path)
      .map((p) => ({ ...p, media_type: "movie" as const }))
      .sort((a, b) => (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999"));

    if (!parts.length) return null;
    return { id: data.id, name: data.name, poster_path: data.poster_path, parts };
  } catch {
    return null;
  }
}

/**
 * معرّفات مجموعةٍ منسّقة (دفعة القوائم الثالثة).
 *
 * المكتوبة يدوياً (movieIds — ترتيب أحداث) تُعاد كما هي؛ ومجموعةُ
 * collectionId تُحلّ من سلسلة TMDB بترتيب الإصدار — فتتحدّث بالأجزاء
 * الجديدة وحدها بلا صيانة قاموسٍ يدوي.
 */
export async function resolveSetIds(u: {
  movieIds?: number[];
  collectionId?: number;
}): Promise<number[]> {
  if (u.movieIds?.length) return u.movieIds;
  if (!u.collectionId) return [];
  const c = await getCollection(u.collectionId).catch(() => null);
  return (c?.parts ?? []).map((p) => p.id);
}

/**
 * أفلامٌ بمعرّفاتها، بترتيب المعرّفات نفسه — لقوائم العوالم (D-074).
 *
 * العالم قاموسُ معرّفاتٍ مرتّبةٍ عندنا (universes.ts)، وTMDB لا يجمعه في
 * طلبٍ واحد — فتُجلب التفاصيل بالتوازي (مخبّأةً ساعةً ككل طلبات tmdb)،
 * والمعرّفُ الفاشل يسقط بصمت بدل أن يُفشل القائمة كلّها: قائمةُ ٣٦ فيلماً
 * أصدق من لا قائمة لأن فيلماً واحداً تعثّر.
 */
export async function moviesByIds(
  ids: number[],
): Promise<{ id: number; title: string; poster_path: string | null; release_date?: string | null }[]> {
  const rows = await Promise.all(
    ids.map((id) =>
      tmdb<{ id: number; title: string; poster_path: string | null; release_date?: string | null }>(`/movie/${id}`)
        .then((m) => ({ id: m.id, title: m.title, poster_path: m.poster_path, release_date: m.release_date ?? null }))
        .catch(() => null),
    ),
  );
  return rows.filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * أعمال مرتبطة.
 *
 * TMDB لا يمثّل «العمل المشتقّ» علاقةً — لا حقل له ولا مسار. فأقرب ما يُنال
 * مصدران: `/recommendations` (مبنيّ على سلوك المستخدمين، وهو الأدقّ) ثم
 * `/similar` (مبنيّ على الأنواع والكلمات المفتاحية، وهو الأوسع). نبدأ
 * بالأول ونُكمل بالثاني عند القصور، فلا يعود الصفّ فارغاً لعملٍ قليل
 * المشاهدة — ولذلك يُسمّى الصفّ «أعمال مرتبطة» لا «مشتقّة»: العنوان لا
 * يَعِد بما لا نملكه.
 */
export async function relatedTitles(
  mediaType: MediaType,
  id: number,
  limit = 20,
): Promise<SearchResult[]> {
  const seen = new Set<number>([id]);
  const out: SearchResult[] = [];

  for (const path of ["recommendations", "similar"] as const) {
    if (out.length >= limit) break;
    try {
      const data = await tmdb<{ results: SearchResult[] }>(`/${mediaType}/${id}/${path}`);
      for (const r of data.results ?? []) {
        if (!r.poster_path || seen.has(r.id)) continue;
        seen.add(r.id);
        out.push({ ...r, media_type: mediaType });
        if (out.length >= limit) break;
      }
    } catch {
      /* المصدر التالي */
    }
  }
  return out;
}

export function getTv(id: number): Promise<TvDetails> {
  return tmdb<TvDetails>(`/tv/${id}`);
}

export function getMovie(id: number): Promise<MovieDetails> {
  return tmdb<MovieDetails>(`/movie/${id}`);
}


/** معرّف IMDb لمسلسل — من /external_ids؛ جسر تقييمات OMDb (مخبّأ ساعةً) */
export async function tvImdbId(id: number): Promise<string | null> {
  try {
    const data = await tmdb<{ imdb_id?: string | null }>(`/tv/${id}/external_ids`);
    return data.imdb_id ?? null;
  } catch {
    return null;
  }
}

/** معرّف IMDb لفيلم — نتائج /discover لا تحمله فنسأل /external_ids؛
    نظير tvImdbId حرفياً حتى تبقى صفوف ديسكفري المرتّبة بمصدر واحد */
export async function movieImdbId(id: number): Promise<string | null> {
  try {
    const data = await tmdb<{ imdb_id?: string | null }>(`/movie/${id}/external_ids`);
    return data.imdb_id ?? null;
  } catch {
    return null;
  }
}

export function getSeason(tvId: number, seasonNumber: number): Promise<SeasonDetails> {
  return tmdb<SeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`);
}

/**
 * الأعلى تقييماً عالمياً هذا الأسبوع.
 *
 * TMDB لا يوفّر «أعلى تقييماً لهذا الأسبوع» جاهزاً — قائمة top_rated عنده
 * تاريخية لا أسبوعية. فالمعيار هنا: رائج هذا الأسبوع + تجاوز عتبة أصوات
 * تمنع عملاً بثلاثة أصوات من التصدّر.
 */
export async function topRatedThisWeek(minVotes = 150): Promise<SearchResult[]> {
  const rows = await trending();
  return rows
    .filter((r) => (r.vote_count ?? 0) >= minVotes && r.vote_average > 0)
    .sort((a, b) => b.vote_average - a.vote_average);
}

/** معرّف كلمة «anime» المفتاحية في TMDB — أدقّ من الاعتماد على نوع الرسوم وحده */
export const ANIME_KEYWORD = "210024";

/**
 * هل هذا العمل أنمي؟
 *
 * المعيار: رسوم متحركة (النوع ١٦) + بلد المنشأ اليابان. الاكتفاء بنوع
 * الرسوم كان يصنّف «عائلة سمبسون» أنمي، والاكتفاء باليابان يصنّف كل دراما
 * يابانية أنمي.
 */
export function isAnime(tv: {
  genres?: { id: number }[];
  origin_country?: string[];
}): boolean {
  const animated = (tv.genres ?? []).some((g) => g.id === 16);
  const japanese = (tv.origin_country ?? []).includes("JP");
  return animated && japanese;
}

/**
 * أفضل عشرة أنمي هذا الأسبوع.
 *
 * لا يوجد «رائج» مقصور على الأنمي في TMDB، فنستخدم الاستكشاف بكلمة الأنمي
 * المفتاحية مرتّباً بالرواج، ثم نرتّب بالتقييم بنفس منطق القائمتين
 * الأخريين — لتبقى الصفوف الثلاثة متّسقة في معناها.
 */
export async function topTenAnimeThisWeek(
  limit = 10,
  /** نافذة زمنية اختيارية (D-099): شهر/سنة = أنمي بدأ بثّه في المدى،
      مرتّباً بالشعبية — نفس دلالة نافذتَي الأفلام والمسلسلات */
  range?: { from: string; to: string },
): Promise<SearchResult[]> {
  const data = await tmdb<{ results: SearchResult[] }>("/discover/tv", {
    with_keywords: ANIME_KEYWORD,
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": "50",
    ...(range ? { "first_air_date.gte": range.from, "first_air_date.lte": range.to } : {}),
  });
  const rows = (data.results ?? [])
    .filter((r) => r.poster_path && r.vote_average > 0)
    .map((r) => ({ ...r, media_type: "tv" as const }));

  for (const floor of [300, 100, 25, 0]) {
    const picked = rows
      .filter((r) => (r.vote_count ?? 0) >= floor)
      .sort((a, b) => b.vote_average - a.vote_average);
    if (picked.length >= limit || floor === 0) return picked.slice(0, limit);
  }
  return [];
}

/**
 * أفضل عشرة من نوع واحد هذا الأسبوع.
 *
 * الرائج أسبوعياً مُرشَّحاً بعتبة أصوات ثم مرتَّباً بالتقييم. العتبة تنزل
 * تدريجياً إن لم تكتمل العشرة، فالقائمة لا تعود ناقصة في أسبوع هادئ.
 */
/** رقم نوع «رسوم متحركة» في TMDB — واحد للأفلام والمسلسلات معاً */
const ANIMATION_GENRE = 16;

export async function topTenThisWeek(
  mediaType: MediaType,
  limit = 10,
): Promise<SearchResult[]> {
  const data = await tmdb<{ results: SearchResult[] }>(`/trending/${mediaType}/week`);
  const rows = (data.results ?? [])
    .filter((r) => r.poster_path && r.vote_average > 0)
    // المسلسلات وحدها تُصفّى من الرسوم: للأنمي صفّه الخاص تحتها مباشرةً،
    // وكان «أفضل ١٠ مسلسلات» يتصدّره ون بيس وريك آند مورتي فيتكرّر الصفّان.
    // الأفلام تبقى كما هي — فيلم الرسوم فيلمٌ ولا صفَّ بديلاً له.
    .filter((r) => mediaType !== "tv" || !(r.genre_ids ?? []).includes(ANIMATION_GENRE))
    .map((r) => ({ ...r, media_type: mediaType }));

  for (const floor of [300, 100, 25, 0]) {
    const picked = rows
      .filter((r) => (r.vote_count ?? 0) >= floor)
      .sort((a, b) => b.vote_average - a.vote_average);
    if (picked.length >= limit || floor === 0) return picked.slice(0, limit);
  }
  return [];
}

/** الأكثر رواجاً عالمياً هذا الأسبوع — ترتيب TMDB نفسه */
export async function mostPopularThisWeek(): Promise<SearchResult[]> {
  const rows = await trending();
  return [...rows].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

// ============================================================
//  الترايلر وأين تشاهده
// ============================================================

export interface Video {
  key: string;
  site: string;
  type: string;
  name: string;
  official: boolean;
  size: number;
}

/**
 * أفضل ترايلر متاح لعمل معيّن.
 *
 * الترتيب: ترايلر رسمي ← ترايلر ← تيزر ← أي مقطع يوتيوب. ويُطلب باللغة
 * المختارة أولاً، فإن لم يوجد مقطع عربي رجعنا للإنجليزية — أغلب الأعمال
 * الأجنبية ليس لها ترايلر مرفوع بالعربية.
 */
export async function getTrailer(
  mediaType: MediaType,
  id: number,
): Promise<{ key: string; name: string } | null> {
  const pick = (vids: Video[]) => {
    const yt = vids.filter((v) => v.site === "YouTube" && v.key);
    return (
      yt.find((v) => v.type === "Trailer" && v.official) ??
      yt.find((v) => v.type === "Trailer") ??
      yt.find((v) => v.type === "Teaser") ??
      yt[0] ??
      null
    );
  };

  try {
    const local = await tmdb<{ results: Video[] }>(`/${mediaType}/${id}/videos`);
    const found = pick(local.results ?? []);
    if (found) return { key: found.key, name: found.name };
  } catch {
    /* نكمل للإنجليزية */
  }

  try {
    const en = await tmdb<{ results: Video[] }>(`/${mediaType}/${id}/videos`, {
      language: "en-US",
    });
    const found = pick(en.results ?? []);
    return found ? { key: found.key, name: found.name } : null;
  } catch {
    return null;
  }
}

export interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  /** أولوية العرض العالمية — تقريبيةٌ ولا تصلح وحدها لترتيب قائمة بلد */
  display_priority?: number;
  /** أولوية العرض داخل كل بلد — هي الصحيحة عند ترتيب قائمة بلدٍ بعينه */
  display_priorities?: Record<string, number>;
}

export interface WatchOptions {
  /** اشتراك — نتفلكس وشاهد وغيرها */
  flatrate: Provider[];
  /** إيجار */
  rent: Provider[];
  /** شراء */
  buy: Provider[];
  /** مجاني بإعلانات */
  free: Provider[];
  /** رابط JustWatch الرسمي — TMDB تشترط عرضه مع البيانات */
  link: string | null;
}

/**
 * منصّات المشاهدة في بلد المستخدم.
 *
 * TMDB تُرجع خريطة بكل الدول؛ نأخذ بلد المستخدم أولاً ثم جيرانه ثم
 * أمريكا، لأن كثيراً من الأعمال غير مُدرجة تحت بلدٍ بعينه فتظهر الصفحة
 * بلا فائدة. والبلد المُجيب يعود مع النتيجة كي تسمّيه الواجهة حين يختلف
 * عن بلد المستخدم — إجابةٌ عن الجوار مقبولة، وإجابةٌ صامتة عنه ليست.
 */
export async function getWatchProviders(
  mediaType: MediaType,
  id: number,
  regions?: string[],
): Promise<{ region: string; options: WatchOptions } | null> {
  const chain = regions ?? regionChain(await watchRegion());
  try {
    const data = await tmdb<{
      results: Record<
        string,
        { link?: string; flatrate?: Provider[]; rent?: Provider[]; buy?: Provider[]; free?: Provider[] }
      >;
    }>(`/${mediaType}/${id}/watch/providers`);

    for (const region of chain) {
      const r = data.results?.[region];
      if (!r) continue;
      const options: WatchOptions = {
        flatrate: r.flatrate ?? [],
        rent: r.rent ?? [],
        buy: r.buy ?? [],
        free: r.free ?? [],
        link: r.link ?? null,
      };
      const any =
        options.flatrate.length || options.rent.length || options.buy.length || options.free.length;
      if (any) return { region, options };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * أفضل عشرة من نوعٍ درامي محدّد هذا الأسبوع.
 *
 * الرائج أسبوعياً صفحةٌ واحدة (عشرون عملاً)، وتصفيتها بنوعٍ ضيّق كالغربيّ
 * قد تُخرج صفّاً من عملين. فإن لم تكتمل العشرة أكملناها من `discover`
 * بالنوع نفسه مرتّباً بالشعبية: الصفّ يبقى ممتلئاً، وصدارته تبقى لِما
 * يروج فعلاً هذا الأسبوع لأن الرائج يُوضع أوّلاً.
 */
export async function topTenGenreThisWeek(
  mediaType: MediaType,
  genreIds: number[],
  limit = 10,
): Promise<SearchResult[]> {
  if (!genreIds.length) return [];

  let picked: SearchResult[] = [];
  try {
    const data = await tmdb<{ results: SearchResult[] }>(`/trending/${mediaType}/week`);
    picked = (data.results ?? [])
      .filter((r) => r.poster_path && r.vote_average > 0)
      .filter((r) => (r.genre_ids ?? []).some((id) => genreIds.includes(id)))
      .map((r) => ({ ...r, media_type: mediaType }))
      .sort((a, b) => b.vote_average - a.vote_average);
  } catch {
    /* تعذّر الرائج — نكمل من discover وحده */
  }
  if (picked.length >= limit) return picked.slice(0, limit);

  try {
    const data = await tmdb<{ results: SearchResult[] }>(`/discover/${mediaType}`, {
      with_genres: genreIds.join("|"),
      sort_by: "popularity.desc",
      include_adult: "false",
      "vote_count.gte": mediaType === "movie" ? "50" : "20",
    });
    const seen = new Set(picked.map((r) => r.id));
    const extra = (data.results ?? [])
      .filter((r) => r.poster_path && !seen.has(r.id))
      .map((r) => ({ ...r, media_type: mediaType }));
    return [...picked, ...extra].slice(0, limit);
  } catch {
    return picked.slice(0, limit);
  }
}

/**
 * القادم قريباً من نوعٍ درامي محدّد.
 *
 * `upcoming` و`on_the_air` لا يقبلان نوعاً درامياً، فنطلب `discover`
 * بتاريخٍ مستقبليّ مرتّباً تصاعدياً — الأقرب صدوراً أوّلاً، كما يُقرأ صفّ
 * العدّ التنازلي.
 */
export async function upcomingByGenre(
  genreIds: number[],
  mediaType: MediaType,
): Promise<SearchResult[]> {
  if (!genreIds.length) return [];
  const today = new Date().toISOString().slice(0, 10);

  const params: Record<string, string> = {
    with_genres: genreIds.join("|"),
    include_adult: "false",
  };
  if (mediaType === "movie") {
    params.sort_by = "primary_release_date.asc";
    params["primary_release_date.gte"] = today;
  } else {
    params.sort_by = "first_air_date.asc";
    params["first_air_date.gte"] = today;
    params.include_null_first_air_dates = "false";
  }

  try {
    const data = await tmdb<{ results: SearchResult[] }>(`/discover/${mediaType}`, params);
    return (data.results ?? [])
      .filter((r) => r.poster_path)
      .map((r) => ({ ...r, media_type: mediaType }));
  } catch {
    return [];
  }
}

// ============================================================
//  التصفّح بالفلتر الكامل — لغة، حقبة، تقييم
// ============================================================

/**
 * فلترُ تصفّحٍ كما يفهمه TMDB.
 *
 * حقولٌ خام لا كائنات `browse.ts`: هذه الطبقة لا تعرف الرقائق ولا الروابط،
 * تعرف معاملات `/discover` وحدها — فتبقى قابلةً للاستعمال من أي شاشة.
 */
export interface DiscoverFilter {
  /** معرّفات النوع الدرامي — تُجمع بـ«أو» */
  genreIds?: number[];
  /** لغة العمل الأصلية (ISO 639-1) */
  lang?: string | null;
  /** بلد الإنتاج (ISO 3166-1) — هو وحده ما يفصل السعوديّ عن المصريّ */
  country?: string | null;
  /** معرّف منصّة اشتراك عند TMDB — يلزمه `watch_region` */
  provider?: number | null;
  /** بلد المشاهدة الذي يُقاس عليه توفّر المنصّة */
  watchRegion?: string | null;
  /** أوّل تاريخ إصدارٍ مقبول (شامل) */
  from?: string | null;
  /** آخر تاريخ إصدارٍ مقبول (شامل) */
  to?: string | null;
  /** أدنى متوسّط تقييم */
  minRate?: number | null;
}

/**
 * فلتر المنصّات: منطقةٌ واحدة لا تسلسل.
 *
 * `with_watch_providers` لا يعمل بلا `watch_region`. وهنا — بخلاف صفحة
 * العمل — لا سقوطَ إلى بلدٍ آخر: الفلتر يجيب «ما الذي أستطيع مشاهدته
 * باشتراكي؟»، وقائمةٌ من نتفلكس الأمريكية جوابٌ لا يستطيع صاحب السؤال
 * فتحه. البلد بلدُ المستخدم، ويُكتب في عنوان المجموعة كي لا تُقرأ
 * القائمة عالمية.
 */
export interface ProviderOption {
  id: number;
  name: string;
  logo_path: string | null;
}

/**
 * منصّات الاشتراك المتاحة في المنطقة، **كاملةً** ومرتّبةً بأولوية البلد.
 *
 * القائمة تُجلب من TMDB ولا تُكتب عندنا: معرّفات المنصّات تتغيّر وتُدمَج
 * (شاهد و OSN غيّرا هويّتهما مرّتين)، وقائمةٌ مكتوبةٌ بخطّ اليد تصمت يوم
 * تتغيّر بدل أن تُخطئ بصوتٍ مسموع.
 *
 * **الترتيب بأولوية البلد لا بالعالمية.** `display_priority` رقمٌ عالميّ،
 * وترتيبُ قائمة السعودية به كان يرفع FlixOlé الإسبانية و iWant الفلبينية
 * و Sun Nxt الهندية فوق ما يشترك فيه الناس هنا فعلاً. TMDB يعطي
 * `display_priorities` مفهرسةً بالبلد، وهي الرقم الصحيح لهذا السؤال.
 *
 * **وبلا سقف.** كان اثنَي عشر، فكانت القائمة تقصّ نصف السوق بلا أن تقول.
 * الاثنا عشر كانا حدّاً لعرضٍ برقائق تلتفّ في جدار؛ وبعد أن صارت قائمةً
 * منسدلة لم يعد للحدّ سبب — والقائمة الكاملة هي الجواب الصادق عن «ما
 * المتاح في بلدي».
 */
export async function listWatchProviders(
  mediaType: MediaType = "movie",
): Promise<ProviderOption[]> {
  try {
    const region = await watchRegion();
    const data = await tmdb<{ results?: Provider[] }>(`/watch/providers/${mediaType}`, {
      watch_region: region,
    });
    const rank = (p: Provider) =>
      p.display_priorities?.[region] ?? p.display_priority ?? 9999;
    return (data.results ?? [])
      .slice()
      .sort((a, b) => rank(a) - rank(b) || a.provider_name.localeCompare(b.provider_name))
      .map((p) => ({ id: p.provider_id, name: p.provider_name, logo_path: p.logo_path }));
  } catch {
    return [];
  }
}

/** أسماء حقول التاريخ تختلف بين الأفلام والمسلسلات في `/discover` */
function dateKeys(mediaType: MediaType) {
  return mediaType === "movie"
    ? { gte: "primary_release_date.gte", lte: "primary_release_date.lte" }
    : { gte: "first_air_date.gte", lte: "first_air_date.lte" };
}

function discoverParams(mediaType: MediaType, f: DiscoverFilter) {
  const p: Record<string, string> = { include_adult: "false" };
  if (f.genreIds?.length) p.with_genres = f.genreIds.join("|");
  if (f.lang) p.with_original_language = f.lang;
  if (f.country) p.with_origin_country = f.country;
  if (f.provider) {
    p.with_watch_providers = String(f.provider);
    p.watch_region = f.watchRegion ?? DEFAULT_REGION;
    // الاشتراك وحده: الإيجار والشراء متاحان للجميع، فإدراجهما يُفرغ الفلتر من معناه
    p.with_watch_monetization_types = "flatrate";
  }
  const k = dateKeys(mediaType);
  if (f.from) p[k.gte] = f.from;
  if (f.to) p[k.lte] = f.to;
  if (f.minRate) p["vote_average.gte"] = String(f.minRate);
  return p;
}

/**
 * أفضل ما يطابق الفلتر.
 *
 * `vote_average.desc` وحده يُصعّد أعمالاً بصوتين إلى القمّة، فتُقرن دائماً
 * بعتبة أصوات. والعتبة تنزل درجةً درجة: «عربي، تسعينات، ٨ فما فوق» لا يجد
 * عشرة أعمالٍ بمئتَي صوت، وصفٌّ من ثلاثة أصدق من صفٍّ فارغ. ونتوقّف عند
 * أوّل عتبةٍ تكفي فلا نطلب ما لا نحتاج.
 */
export async function topByFilter(
  mediaType: MediaType,
  f: DiscoverFilter,
  limit = 10,
  /* الترتيب حسب نافذة «اكتشف»: `vote_average.desc` للأفضل تقييماً (أسبوعي
     المُصفّى)، `popularity.desc` لأعلى سنةٍ، `vote_count.desc` للأعلى
     تاريخياً (الأكثر أصواتاً = الأكثر مشاهدةً). العتبةُ تبقى شرطاً في
     الأحوال كي لا يتصدّر عملٌ بصوتين. */
  sort: "vote_average.desc" | "popularity.desc" | "vote_count.desc" = "vote_average.desc",
): Promise<SearchResult[]> {
  let best: SearchResult[] = [];
  for (const floor of [200, 50, 10]) {
    try {
      const data = await tmdb<{ results: SearchResult[] }>(`/discover/${mediaType}`, {
        ...discoverParams(mediaType, f),
        sort_by: sort,
        "vote_count.gte": String(floor),
      });
      const rows = (data.results ?? [])
        .filter((r) => r.poster_path)
        .map((r) => ({ ...r, media_type: mediaType }));
      if (rows.length > best.length) best = rows;
      if (rows.length >= limit) break;
    } catch {
      /* عتبةٌ فشلت — نجرّب الأدنى منها */
    }
  }
  return best.slice(0, limit);
}

/**
 * أعلى ٥٠ عملاً على الإطلاق — لصفّ ذيل «اكتشف» (طلب المالك).
 *
 * «كل الأوقات» = الأكثر أصواتاً (`vote_count.desc`): أعلى متوسّطٍ يُصعّد
 * أعمالاً محدودة الجمهور، وعدد الأصوات أصدق دلالةً على «ما شاهده الجميع».
 * صفحة TMDB عشرون، فنطلب ثلاثاً لبلوغ الخمسين، ونحترم الفلتر لو وُجد.
 */
/**
 * كم صفحةً من TMDB لبلوغ `limit` صفّاً — الصفحة عشرون.
 *
 * كان العدد ثابتاً (ثلاث صفحات = ستّون) فطلبُ ثمانين لا يزيد شيئاً: مرّر
 * `limit` ولا يتغيّر المُرجَع. وقد صار الطلب أكبر منذ D-132 (بِركةٌ فائضة
 * لأن غير المقيَّم يسقط كاملاً)، فالعدد يتبع الطلب. وسقفُ عشر صفحاتٍ حاجزٌ
 * ضدّ حلقةٍ مفتوحة تطلب مئة صفحة بلا قصد.
 */
function pagesFor(limit: number): number[] {
  const n = Math.min(10, Math.max(1, Math.ceil(limit / 20)));
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** أفضل ٥٠ أنمي على الإطلاق (طلب أحمد) — نفس محرّك top50 لكن على
    مفتاح الأنمي: الأكثر أصواتاً تاريخياً، ثم يعيد withImdbRatings
    ترتيبها بتقييم IMDb كسائر الصفوف المرتّبة (D-093). العتبة 200 لا
    500: بِركة أصوات الأنمي في TMDB أصغر من الأفلام العالمية */
export async function top50Anime(limit = 50): Promise<SearchResult[]> {
  const pages = await Promise.all(
    pagesFor(limit).map((page) =>
      tmdb<{ results: SearchResult[] }>("/discover/tv", {
        with_keywords: ANIME_KEYWORD,
        sort_by: "vote_count.desc",
        "vote_count.gte": "200",
        include_adult: "false",
        page: String(page),
      }).catch(() => ({ results: [] as SearchResult[] })),
    ),
  );
  const seen = new Set<number>();
  const rows: SearchResult[] = [];
  for (const p of pages) {
    for (const r of p.results ?? []) {
      if (!r.poster_path || seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push({ ...r, media_type: "tv" });
    }
  }
  return rows.slice(0, limit);
}

export async function top50(
  mediaType: MediaType,
  f: DiscoverFilter = {},
  limit = 50,
): Promise<SearchResult[]> {
  const pages = await Promise.all(
    pagesFor(limit).map((page) =>
      tmdb<{ results: SearchResult[] }>(`/discover/${mediaType}`, {
        ...discoverParams(mediaType, f),
        sort_by: "vote_count.desc",
        "vote_count.gte": "500",
        page: String(page),
      }).catch(() => ({ results: [] as SearchResult[] })),
    ),
  );
  const seen = new Set<number>();
  const rows: SearchResult[] = [];
  for (const p of pages) {
    for (const r of p.results ?? []) {
      if (!r.poster_path || seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push({ ...r, media_type: mediaType });
    }
  }
  return rows.slice(0, limit);
}

/**
 * الأعلى تقييماً على الإطلاق — لقوائم TOP 250 (طلب أحمد 9 Aug).
 *
 * **TMDB هنا بِركةُ مرشّحين لا مصدرَ ترتيب** (D-132 يُصلح D-116).
 * كان الترتيب بتقييم TMDB لأن «٢٥٠ ×٣ بترتيب IMDb تعني حرق حصة OMDb
 * كلها» — وقد سقط هذا العذر بالمخزن ذي العمر المتدرّج، وبقيت نتيجته:
 * قائمةٌ فيها أعمالٌ ضعيفة وغيرُ مقيَّمة، وهو ما أُبلغنا به.
 *
 * فالدالّة تعيد **بِركةً أوسع ممّا يُطلب** (`pool`)، ويقع الترتيب
 * والاقتطاع عند المستدعي بعد `withImdbRatings` + `rankByImdb`: أعلى
 * ٢٥٠ بالصيغة البايزيّة من بين ٤٠٠ مرشّح، وغيرُ المقيَّم خارجٌ تماماً.
 *
 * الأفلام والمسلسلات من قوائم TMDB الرسمية `top_rated` (عتبات أصواتها
 * مبنية فيها)، والأنمي — لا top_rated له — من `/discover` بمفتاح الأنمي
 * فوق عتبة أصوات. الصفحات متوازية ومخبّأة ساعةً في طبقة tmdb().
 */
export async function topRatedRows(
  media: "movie" | "tv" | "anime",
  limit = 250,
): Promise<SearchResult[]> {
  const pageCount = Math.min(25, Math.ceil(limit / 20));
  const pageNums = Array.from({ length: pageCount }, (_, i) => i + 1);
  const mt: MediaType = media === "movie" ? "movie" : "tv";

  const pages = await Promise.all(
    pageNums.map((page) =>
      (media === "anime"
        ? tmdb<{ results: SearchResult[] }>("/discover/tv", {
            with_keywords: ANIME_KEYWORD,
            sort_by: "vote_average.desc",
            "vote_count.gte": "200",
            include_adult: "false",
            page: String(page),
          })
        : tmdb<{ results: SearchResult[] }>(`/${mt}/top_rated`, {
            page: String(page),
          })
      ).catch(() => ({ results: [] as SearchResult[] })),
    ),
  );

  const seen = new Set<number>();
  const rows: SearchResult[] = [];
  for (const p of pages) {
    for (const r of p.results ?? []) {
      if (!r.poster_path || seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push({ ...r, media_type: mt });
    }
  }
  return rows.slice(0, limit);
}

/**
 * بحثٌ بالكلمات المفتاحية — بديل بحث الذكاء حين لا مفتاح للنموذج
 * (طلب أحمد 9 Aug: «الـAI ما زال سيء جداً»).
 *
 * TMDB يحمل قاموس كلماتٍ مفتاحية ضخماً («time loop»، «heist»، «amnesia»…)
 * وهو أقرب ما عنده إلى الفهم الدلاليّ: نحوّل كلمات الوصف إلى معرّفات
 * كلمات، ثم نطلب `/discover` بها. ليس ذكاءً — لكنه يجيب «فيلم عن سرقة
 * بنك» بأفلام سرقةٍ فعلية بدل مطابقة عناوين. الكلمات إنجليزية عند TMDB،
 * فالوصف العربي يعتمد المسار الآخر (النوع والحقبة) في actions.
 */
export async function keywordDiscover(
  words: string[],
  media: MediaType,
  limit = 12,
): Promise<SearchResult[]> {
  const terms = words.filter((w) => /^[a-z][a-z' -]{2,}$/i.test(w)).slice(0, 4);
  if (!terms.length) return [];

  const ids: string[] = [];
  await Promise.all(
    terms.map(async (w) => {
      try {
        const data = await tmdb<{ results: { id: number; name: string }[] }>("/search/keyword", {
          query: w,
        });
        const hit = (data.results ?? [])[0];
        if (hit) ids.push(String(hit.id));
      } catch {
        /* كلمةٌ بلا مفتاح — تسقط وحدها */
      }
    }),
  );
  if (!ids.length) return [];

  try {
    const data = await tmdb<{ results: SearchResult[] }>(`/discover/${media}`, {
      // «أو» بين الكلمات: التقاطع الصارم يُفرغ النتيجة غالباً
      with_keywords: ids.join("|"),
      sort_by: "vote_count.desc",
      "vote_count.gte": "80",
      include_adult: "false",
    });
    return (data.results ?? [])
      .filter((r) => r.poster_path)
      .map((r) => ({ ...r, media_type: media }))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * الفائزون بجائزةٍ — مثبَّتين على TMDB، الأحدث أولاً (طلب أحمد 9 Aug).
 *
 * القاموس يحمل الاسم والسنة (awards.ts)، وهذه الدالة تثبّت كل سطرٍ
 * بنتيجة TMDB حقيقية — نفس مثبِّت بحث الذكاء (`searchByName`). السنة
 * تقيّد بحث الأفلام ولا تقيّد المسلسلات: سنة الإيمي سنةُ حفلٍ لا سنةُ
 * أول بثّ. وما لا يُطابَق يسقط بصمت.
 *
 * `awarded` سنةُ الفوز — تُعرض في صدر الصفّ وتُرتَّب بها القائمة، ولا
 * تُستبدل بسنة الإصدار (فيلمٌ فاز متأخراً يبقى في موضع فوزه).
 */
export interface AwardRow extends SearchResult {
  awarded: number;
}

export async function awardWinners(slug: string, limit?: number): Promise<AwardRow[]> {
  const { awardBySlug, awardWins } = await import("./awards");
  const award = awardBySlug(slug);
  if (!award) return [];
  /* `limit` للبطاقة وحدها (أربعة ملصقات): تثبيت خمسةٍ وثلاثين فائزاً
     لبطاقةٍ تعرض أربعة إسرافٌ في طلبات TMDB — والقائمة الكاملة تُحلّ
     عند الفتح أو الحفظ */
  const wins = limit ? awardWins(award).slice(0, limit) : awardWins(award);

  const rows: AwardRow[] = [];
  const CHUNK = 12;
  for (let i = 0; i < wins.length; i += CHUNK) {
    const found = await Promise.all(
      wins.slice(i, i + CHUNK).map((w) =>
        searchByName(w.title, award.kind, award.kind === "movie" ? w.year : undefined)
          .then((r) => (r ? { ...r, awarded: w.year } : null))
          .catch(() => null),
      ),
    );
    for (const r of found) if (r) rows.push(r);
  }
  return rows.sort((a, b) => b.awarded - a.awarded);
}

/**
 * أعمال فنّانيك — لصفّ «من فنّانيك» في اكتشف (person_follows.sql).
 *
 * `/discover/movie` بـ`with_people` (الشرطة العمودية = «أو»). أفلامٌ فقط:
 * TMDB لا يدعم `with_people` في `/discover/tv` — قيدُ المصدر لا اختيارنا.
 * الأحدث إصداراً أولاً (السؤال «ما جديد فنّاني؟» لا «ما أشهر أعمالهم؟» —
 * الأشهر يعرفه المتابع أصلاً)، مع عتبة أصواتٍ صغيرة تُسقط مشاريعَ لم
 * تُعرض بعد، وقصٌّ بتاريخ اليوم للسبب نفسه. عشرون فنّاناً حدّاً أعلى:
 * رابط أطول من ذلك يعود خطأً من TMDB.
 */
export async function worksByPeople(personIds: number[], limit = 20): Promise<SearchResult[]> {
  if (!personIds.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  try {
    const data = await tmdb<{ results: SearchResult[] }>("/discover/movie", {
      with_people: personIds.slice(0, 20).join("|"),
      sort_by: "primary_release_date.desc",
      "vote_count.gte": "20",
      "primary_release_date.lte": today,
    });
    return (data.results ?? [])
      .filter((r) => r.poster_path)
      .map((r) => ({ ...r, media_type: "movie" as const }))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * القادم قريباً ضمن الفلتر.
 *
 * الحقبة تُقصّ بـ«اليوم» لا تُلغيه: من اختار «٢٠٢٠ فما بعد» يريد قادمها،
 * ومن اختار حقبةً منتهية لا قادمَ فيها أصلاً — فيُترك الصفّ فارغاً بلا
 * طلبٍ يُهدر. والتقييم يُتجاهل هنا عمداً: العمل الذي لم يصدر لا أصوات له،
 * فعتبةُ ٨ تُفرغ الصفّ لا تُجوّده.
 *
 * والانتقاء بالترقّب لا بقُرب الموعد: الترتيب الزمني التصاعدي يملأ
 * الصفّ بإصدارات اليوم المغمورة (لا جمهور لها فلا بديل عن الشعبية
 * مقياساً)، والصفحة تعيد ترتيب ما انتُقي بالتاريخ قبل العرض — فيبقى
 * العدّ التنازلي زمنياً والوجوه فيه معروفة.
 */
export async function upcomingByFilter(
  mediaType: MediaType,
  f: DiscoverFilter,
): Promise<SearchResult[]> {
  const today = new Date().toISOString().slice(0, 10);
  if (f.to && f.to < today) return [];

  const from = f.from && f.from > today ? f.from : today;
  const k = dateKeys(mediaType);
  const params: Record<string, string> = {
    ...discoverParams(mediaType, { ...f, from, minRate: null }),
    sort_by: "popularity.desc",
  };
  delete params["vote_average.gte"];
  params[k.gte] = from;
  if (mediaType === "tv") params.include_null_first_air_dates = "false";

  try {
    const data = await tmdb<{ results: SearchResult[] }>(`/discover/${mediaType}`, params);
    return (data.results ?? [])
      .filter((r) => r.poster_path)
      .map((r) => ({ ...r, media_type: mediaType }));
  } catch {
    return [];
  }
}

// ============================================================
//  المطابقة الخارجية — للاستيراد من TV Time و Trakt
// ============================================================

interface FindResponse {
  tv_results?: SearchResult[];
  movie_results?: SearchResult[];
  tv_episode_results?: {
    id: number;
    show_id: number;
    season_number: number;
    episode_number: number;
    name?: string;
  }[];
}

/**
 * مطابقة معرّفٍ خارجي (TVDB/IMDb) بمعرّف TMDB.
 *
 * `/find` مسارٌ رخيص ودقيق: لا يخمّن بالاسم بل يعبر الجسر الذي بنته
 * TMDB بين قواعد المعرّفات. تصديرُ TV Time القديم يحمل معرّفات TVDB
 * وحدها، و Trakt يحمل الثلاثة — فما وُجد له معرّف لا يُبحث باسمه.
 */
export async function findByExternalId(
  id: string,
  source: "tvdb_id" | "imdb_id",
): Promise<FindResponse | null> {
  try {
    return await tmdb<FindResponse>(`/find/${encodeURIComponent(id)}`, {
      external_source: source,
    });
  } catch {
    return null;
  }
}

/**
 * البحث بالاسم — آخر ما يُلجأ إليه.
 *
 * السنة تُمرَّر حين تُعرف: «The Office» ثلاثة مسلسلات، والسنة تفصل.
 * والاختيار أوّلُ نتيجةٍ لها ملصق: ترتيب TMDB للبحث بالاسم مبنيٌّ على
 * الشعبية، وهي في الاستيراد الترجيح الأصدق — من شاهد «Friends» شاهد
 * المشهور لا وثائقياً بالاسم نفسه.
 */
export async function searchByName(
  name: string,
  media: "tv" | "movie",
  year?: number,
): Promise<SearchResult | null> {
  const q = name.trim();
  if (!q) return null;
  const params: Record<string, string> = { query: q, include_adult: "false" };
  if (year && year > 1870 && year < 2200) {
    params[media === "tv" ? "first_air_date_year" : "year"] = String(year);
  }
  try {
    const data = await tmdb<{ results: SearchResult[] }>(`/search/${media}`, params);
    const rows = (data.results ?? []).map((r) => ({ ...r, media_type: media }));
    return rows.find((r) => r.poster_path) ?? rows[0] ?? null;
  } catch {
    return null;
  }
}
