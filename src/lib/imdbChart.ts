import { createClient } from "./supabase/server";

/**
 * قائمة IMDb الحقيقية — من ملفّاتها المفتوحة لا من بِركة TMDB (D-135).
 *
 * **المشكلة التي يحلّها هذا الملف:** في D-132 صار الترتيب والأرقام من
 * IMDb، لكن **من يدخل القائمة** بقي قرار TMDB: نأخذ أربعمئة عملٍ من
 * `top_rated` ونرتّبها. فعملٌ في قائمة IMDb الحقيقية قد يغيب عندنا لأنه
 * لم يدخل تلك الأربعمئة أصلاً — نقصٌ لا يراه إلا من يحفظ القائمة، وهم
 * بالضبط من يختبروننا.
 *
 * IMDb تنشر `title.ratings.tsv.gz` مجاناً وتحدّثه يومياً: **تقييمٌ وعددُ
 * أصواتٍ لكل عملٍ عندها** — مليونٌ ونصف سطر في ثمانية ميغابايت مضغوطة.
 * منه تُبنى البِركة الحقيقية بلا وسيط.
 *
 * **ثلاثة قيودٍ حكمت التصميم، وكلّها مذكورةٌ صراحةً:**
 *
 *  ١) **الحاوية محجوبة عن `datasets.imdbws.com`** (‏403 على وكيلها)، فلا
 *     يمكن تنزيله ومعالجته في جلسة التطوير. لذلك يعيش هذا الملف في
 *     الإنتاج ويُشغَّل عبر `/api/imdb-chart`.
 *
 *  ٢) **`title.basics` لا يُقرأ**: ملفُّ الأنواع والعناوين حجمه ١٫٥
 *     جيجابايت — يقتل أي وظيفةٍ بلا خادمٍ دائم. فنوعُ العمل يُعرف من
 *     TMDB عند حلّ المعرّف. ولولا ذلك لتصدّرت **حلقاتُ المسلسلات**
 *     القائمة: «Ozymandias» تقييمها ٩٫٩ بمئتَي ألف صوت.
 *
 *  ٣) **الحلّ يمرّ بـTMDB لا محالة** — وهذا هو موضع البوسترات: ملفّات
 *     IMDb أرقامٌ بلا صور. `/find` يعطينا في ردٍّ واحد: أفيلمٌ هو أم
 *     مسلسل، ومعرّف TMDB، والعنوان، **والملصق**. فما لا يُحلّ يسقط —
 *     بطاقةٌ بلا ملصقٍ ولا وجهة ليست عملاً في قائمة.
 */

/** أدنى أصواتٍ يدخل بها العمل بِركة المرشّحين — عتبةُ المسلسلات، وهي الأدنى */
const CANDIDATE_MIN_VOTES = 5_000;
/** وأدنى تقييم: دون ٧٫٥ لا يدخل قائمة «أفضل» مهما كثرت أصواته */
const CANDIDATE_MIN_RATING = 7.5;
/** كم مرشّحاً نحتفظ به بعد الترتيب المبدئي — خمسة أضعاف المطلوب لكل صنف */
export const CANDIDATE_POOL = 4_000;
/** كم مرشّحاً يُحلّ في النداء الواحد — بحيث تنتهي الوظيفة دون مهلتها */
export const RESOLVE_BATCH = 250;

/** متوسّط تقييمات IMDb العام تقريباً — ثابتُ الصيغة البايزيّة المبدئية */
const GLOBAL_MEAN = 6.9;
/** عتبةٌ وسطى للترتيب المبدئي وحده — العتبةُ الحقيقية لكل صنفٍ في SQL */
const PROVISIONAL_M = 10_000;

export interface Candidate {
  tconst: string;
  rating: number;
  votes: number;
}

/**
 * يبثّ ملفّاً مضغوطاً من IMDb سطراً سطراً.
 *
 * **يُبثّ ولا يُحمَّل كاملاً**: ستّة وعشرون ميغابايت من النصّ مقسومةً على
 * مليونٍ ونصف سطر تعني مصفوفةً بمئات الميغابايت لو `split`. هنا تُقرأ
 * القطعة تلو الأخرى — فالذاكرة ثابتةٌ مهما كبر الملف. وملفّ الحلقات
 * تسعةُ ملايين سطر: بلا بثٍّ لا يُقرأ أصلاً.
 */
async function streamTsv(url: string, onLine: (line: string) => void): Promise<void> {
  const res = await fetch(url, {
    // يومٌ كامل: IMDb تحدّثه مرّةً يومياً، وإعادة تنزيله بين الدفعات هدر
    next: { revalidate: 86_400 },
  });
  if (!res.ok || !res.body) throw new Error(`IMDb datasets ${res.status} ${url}`);

  const reader = res.body.pipeThrough(new DecompressionStream("gzip")).getReader();
  const decoder = new TextDecoder();
  let tail = "";
  let first = true;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = tail + decoder.decode(value, { stream: true });
    const lines = text.split("\n");
    // آخر سطرٍ قد يكون مقطوعاً في منتصفه — يُؤجَّل للقطعة التالية
    tail = lines.pop() ?? "";
    for (const line of lines) {
      if (first) {
        first = false; // ترويسة الملف
        continue;
      }
      onLine(line);
    }
  }
}

/**
 * يعيد أقوى `CANDIDATE_POOL` مرشّحاً من ملفّات IMDb — **بلا حلقات**.
 *
 * **لماذا يُقرأ ملفّ الحلقات:** أوّل تشغيلٍ حقيقيّ حلّ ٣٧ عملاً من ٢٥٠ —
 * لأن صدارة الترتيب البايزيّ حلقاتُ مسلسلات لا أفلام: «Ozymandias» ٩٫٩
 * بمئتَي ألف صوت تسبق «الأب الروحي». `title.basics` (١٫٥ جيجابايت) يعرف
 * النوع لكنه يقتل الوظيفة؛ و`title.episode` ثلاثون ميغابايت فقط ويكفي:
 * لا نحتاج أن نعرف **ما هو** كل عمل، بل أن نُسقط ما هو **حلقة**. فبدل
 * بناء مجموعةٍ من تسعة ملايين معرّف (غيغابايت ذاكرة) نحذف من خريطة
 * المرشّحين وحدها — ذاكرةٌ ثابتة، ونداءات TMDB كلّها تذهب إلى أعمالٍ حقيقية.
 */
export async function fetchCandidates(): Promise<Candidate[]> {
  const byId = new Map<string, Candidate>();

  await streamTsv("https://datasets.imdbws.com/title.ratings.tsv.gz", (line) => {
    // tconst \t averageRating \t numVotes
    const a = line.indexOf("\t");
    if (a < 0) return;
    const b = line.indexOf("\t", a + 1);
    if (b < 0) return;
    const votes = Number(line.slice(b + 1));
    if (!(votes >= CANDIDATE_MIN_VOTES)) return;
    const rating = Number(line.slice(a + 1, b));
    if (!(rating >= CANDIDATE_MIN_RATING)) return;
    const tconst = line.slice(0, a);
    byId.set(tconst, { tconst, rating, votes });
  });

  await streamTsv("https://datasets.imdbws.com/title.episode.tsv.gz", (line) => {
    // tconst \t parentTconst \t seasonNumber \t episodeNumber
    const a = line.indexOf("\t");
    if (a > 0) byId.delete(line.slice(0, a));
  });

  /* ترتيبٌ مبدئيّ بايزيّ بعتبةٍ وسطى: غرضُه اختيار من يستحقّ نداءَ TMDB،
     لا ترتيب القائمة النهائية — ذاك يقع في `build_imdb_chart` بعتبة كل
     صنفٍ الحقيقية. عتبةٌ وسطى هنا تُبقي المسلسلات القوية في البِركة ولا
     تُغرقها بأفلامٍ حدّية. */
  const score = (c: Candidate) =>
    (c.votes / (c.votes + PROVISIONAL_M)) * c.rating +
    (PROVISIONAL_M / (c.votes + PROVISIONAL_M)) * GLOBAL_MEAN;

  return [...byId.values()].sort((x, y) => score(y) - score(x)).slice(0, CANDIDATE_POOL);
}

export interface ResolvedRow {
  tconst: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string | null;
  poster_path: string | null;
  rating: number;
  votes: number;
  is_anime: boolean;
}

interface FindHit {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  genre_ids?: number[];
  original_language?: string;
}

/** رقم نوع «رسوم متحرّكة» عند TMDB — يخدم الجهتين */
const ANIMATION_GENRE = 16;

/**
 * يحلّ معرّف IMDb إلى عملٍ في TMDB — **وهو مصدر الملصق أيضاً**.
 *
 * `tv_episode_results` تُهمَل عمداً: حلقةٌ واحدة ليست عملاً في قائمة
 * أفضل الأعمال، وهي أكثر ما يتصدّر لو تُرك الحبل. وما لا يُحلّ إلى فيلمٍ
 * أو مسلسل يسقط — ومعه ما لا ملصق له، فالبطاقة بلا صورة عيبٌ ظاهر.
 */
export async function resolveOne(c: Candidate): Promise<ResolvedRow | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/find/${c.tconst}?api_key=${key}&external_source=imdb_id`,
      { next: { revalidate: 604_800 } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      movie_results?: FindHit[];
      tv_results?: FindHit[];
    };
    const movie = j.movie_results?.[0];
    const tv = j.tv_results?.[0];
    const hit = movie ?? tv;
    if (!hit || !hit.poster_path) return null;
    const mt: "movie" | "tv" = movie ? "movie" : "tv";
    return {
      tconst: c.tconst,
      tmdb_id: hit.id,
      media_type: mt,
      title: hit.title ?? hit.name ?? null,
      poster_path: hit.poster_path,
      rating: c.rating,
      votes: c.votes,
      /* الأنمي مسلسلٌ رسومٌ متحرّكة لغتُه الأصلية يابانية — الحقلان في
         ردّ `/find` نفسه، فلا نداء ثانٍ لتصنيفه */
      is_anime:
        mt === "tv" &&
        (hit.genre_ids ?? []).includes(ANIMATION_GENRE) &&
        hit.original_language === "ja",
    };
  } catch {
    return null;
  }
}

/** كتابة دفعةٍ في المسوّدة — الجدول غائب؟ يرتدّ صفراً بلا ضجيج */
export async function saveResolved(rows: ResolvedRow[]): Promise<number> {
  if (!rows.length) return 0;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_imdb_pool", { p_rows: rows });
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}
