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
import { createServiceClient } from "./supabase/service";

export interface ExternalRatings {
  /** «8.1» — من IMDb */
  imdb: string | null;
  /** «92%» — من Rotten Tomatoes (يغيب عن كثير من المسلسلات) */
  rt: string | null;
  /** عدد أصوات IMDb — يأتي في نفس الردّ، وكنّا نرميه (D-132) */
  votes: number | null;
  /**
   * 🆕 **التصنيفُ العمريّ** — «TV-MA» · «PG-13» · «R» (D-286، طلبُ أحمد:
   * «التصنيف العمري حطها في كل صفحات المسلسلات والأفلام»).
   *
   * **ولماذا من OMDb لا من TMDB:** TMDB تعطيه في `content_ratings`
   * للمسلسل و`release_dates` للفيلم — **نداءان بمسارين مختلفين لسؤالٍ
   * واحد** — **ونحن ننادي OMDb أصلاً في هذه الترويسة بعينها** والردُّ
   * مخبّأٌ يوماً كاملاً. **وسؤالان عن سطرٍ واحد نداءٌ واحد** (D-198)،
   * **والحقلُ كان يصلنا ونرميه** (سيرةُ `votes` في D-132 حرفاً).
   *
   * ⚠️ **وحدُّه يُقال:** OMDb تعطي التصنيفَ الأمريكيَّ وحدَه. **وهو ما
   * يعرفه القارئُ فعلاً** (TV-MA كما يراه على نتفلكس)، **ولا تملك TMDB
   * تصنيفاً سعوديّاً أصلاً** — فالبديلُ ليس أدقَّ، هو أغلى فقط.
   *
   * **و«N/A» و«Not Rated» و«Unrated» تقول «لا نعرف» فتُردّ `null`** —
   * **والغيابُ أصدق من البديل** (D-063).
   */
  rated: string | null;
}

/** ما تقوله OMDb حين لا تصنيفَ عندها — **يُقرأ غياباً لا قيمة** */
const NO_RATING_WORDS = new Set(["n/a", "not rated", "unrated", "none", ""]);

function cleanRated(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  return NO_RATING_WORDS.has(v.toLowerCase()) ? null : v;
}

/**
 * ردٌّ **صحيحٌ** من OMDb بلا تقييم — أي «هذا العمل ليس له تقييم IMDb».
 *
 * كان هذا الردّ و«الحصة محروقة» و«الشبكة سقطت» تعود كلُّها `null`
 * فيستحيل التمييز (وهو مكتوبٌ صراحةً في `attachImdbRatings`). والفرق
 * صار مهمّاً في D-172: **لا يُعرض بديل TMDB إلا لمن تأكّدنا أن لا تقييم
 * IMDb له** — وشرطُ أحمد كان هذا حرفياً.
 */
export const NO_IMDB_RATING: ExternalRatings = { imdb: null, rt: null, votes: null, rated: null };

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
      imdbVotes?: string;
      Rated?: string;
      Ratings?: { Source: string; Value: string }[];
    };
    if (j.Response === "False") return null;
    const imdb = j.imdbRating && j.imdbRating !== "N/A" ? j.imdbRating : null;
    const rt = j.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value ?? null;
    // «2,343,110» — الفواصل تُنزع قبل التحويل
    const vRaw = Number((j.imdbVotes ?? "").replace(/[^\d]/g, ""));
    const votes = Number.isFinite(vRaw) && vRaw > 0 ? vRaw : null;
    const rated = cleanRated(j.Rated);
    /* لا يُردّ `null` هنا بعد اليوم (D-172): الردّ وصل وقُرئ، فغيابُ
       الرقم **خبرٌ لا فشل**. و`null` صارت تعني «لم نصل» وحدها.
       ⚠️ **والتصنيفُ يُحمل معه** (D-286): عملٌ بلا تقييم IMDb قد يكون
       له تصنيفٌ عمريّ، **وردُّ `NO_IMDB_RATING` عارياً كان يرميه.** */
    if (!imdb && !rt) return { ...NO_IMDB_RATING, rated };
    return { imdb, rt, votes, rated };
  } catch {
    return null;
  }
}

/**
 * 🔴 🆕 **جسرٌ ثانٍ إلى IMDb: الاسمُ والسنة** (D-414، بلاغُ أحمد بثلاث
 * لقطات — IMDb وGoogle وJustWatch كلُّها تعرف «في ال لا لا لاند»:
 * «كلّهم يعرفونه، أنت اللي ما عرفت تسحب بياناته»).
 *
 * ================= والمقيسُ يقول إنه محقّ =================
 *
 * **الجسرُ الوحيد إلى IMDb عندنا كان `tmdb.external_ids.imdb_id`**.
 * **وصفحةُ TMDB لهذا المسلسل بلا رابطِ IMDb أصلاً** (قِيس على
 * `themoviedb.org/tv/72337`: **لا `imdb.com/title` في صفحتها**) —
 * **فالمعرّفُ فارغٌ، فلا نداءَ لـOMDb، فلا تقييمَ ولا تصنيفَ عمريّ.**
 * **والعملُ في IMDb بـ٦٫٦ من ٨٨٦ صوتاً.**
 *
 * **⚠️ والدرسُ أكبرُ من الحالة**: **مصدرٌ واحدٌ لحقيقةٍ يملكها العالمُ
 * كلُّه هو نقطةُ سقوطٍ واحدة** — **وثغرةٌ في بياناتِ طرفٍ ثالثٍ تصير
 * عندنا «العملُ لا يُعرف»**، **وهو ما قرأه أحمد على الشاشة.**
 *
 * ================= والبحثُ يُقبل بشرطين لا واحد =================
 *
 * **OMDb تبحث بالاسم** (`s=`) وتُرجع قائمةً فيها `imdbID` و`Year`
 * و`Type`. **والقبولُ يشترط**: النوعُ نفسُه (`series`/`movie`)
 * **والسنةُ تطابق ±١** — **واسمٌ يطابق تقريباً ليس دليلاً**، وأسماءُ
 * الأعمال العربيّة تُنقل حرفيّاً بأكثر من صورة (`Fi El` مقابل `Fi Al`)
 * **فالسنةُ هي الحكم.** **ولا يُقبل ترشيحٌ بلا سنة.**
 *
 * ⚠️ **ولا يقع هذا النداءُ إلا حين يسقط الجسرُ الأوّل** — **وأكثرُ
 * الأعمال يصلها معرّفُها من TMDB** (D-152: الافتراضُ هو ما كان).
 */
/**
 * 🔴 🆕 **تسويةُ النقل عن العربيّة** (D-431): **الاسمُ المنقولُ لا صيغةَ
 * واحدةَ له** — TMDB تكتب `Fi El La La Land` وIMDb تكتب
 * `Fi Al La La Land` — **وحرفٌ واحدٌ كان يمنع المطابقة.**
 *
 * **وأداةُ التعريف وحدَها تسقط، ككلمةٍ قائمةٍ بذاتها** (`al` · `el`):
 * **ولا تُمسّ `la`** — **«La La Land» اسمٌ لا أداة**، **وتنظيفٌ يبتلع
 * أسماءً حقيقيّةً يكسر أكثرَ ممّا يصلح.**
 *
 * **وتُطبَّق على الطرفين معاً** فتبقى المقارنةُ متكافئة: اسمٌ إنجليزيٌّ
 * فيه «Al» علماً (Weird: The Al Yankovic Story) يُنظَّف هنا وهناك سواءً.
 */
function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "al" && w !== "el")
    .join(" ")
    .trim();
}

async function searchOmdb(
  key: string,
  q: string,
  kind: "series" | "movie",
): Promise<{ Title: string; Year: string; imdbID: string; Type: string }[]> {
  try {
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${key}&s=${encodeURIComponent(q)}&type=${kind}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as {
      Response?: string;
      Search?: { Title: string; Year: string; imdbID: string; Type: string }[];
    };
    if (j.Response === "False" || !j.Search?.length) return [];
    return j.Search;
  } catch {
    return [];
  }
}

export async function imdbIdByName(
  name: string,
  year: number | null,
  kind: "series" | "movie",
): Promise<string | null> {
  const key = process.env.OMDB_API_KEY;
  const q = (name ?? "").trim();
  if (!key || q.length < 3 || !year) return null;

  const want = normalizeTitle(q);
  /* 🆕 **ومحاولةٌ ثانيةٌ بالاسم منزوعَ الأداة** (D-431) — **ولا تقع إن
     لم يتغيّر شيء**: اسمٌ بلا `al/el` لا يُبحث مرّتين. */
  const stripped = want !== q.toLowerCase() ? want : null;
  const rows = await searchOmdb(key, q, kind);
  /* ⚠️ **ومن أين جاء الصفُّ يقرّر كم نتشدّد** (D-432، قِيس على الحيّ):
     **البحثُ بالاسم كما هو يعود بنتائجَ قريبةٍ منه**، فاتّفاقُ النوع
     والسنة كافٍ — **وهو ما كان يعمل منذ D-414 فلا يُمَسّ** (D-152).
     🔴 **والبحثُ منزوعَ الأداة يفتح البابَ أوسع** فيدخل منه غريب —
     **فيُشترط عليه تطابقُ الاسم بعد التسوية.** **ورقمٌ من عملٍ آخر
     أسوأُ من لا رقم** (نصُّ نقضِ D-027 حرفاً). */
  const loose = rows.length > 0;
  const all = rows.length ? rows : stripped ? await searchOmdb(key, stripped, kind) : [];
  if (!all.length) return null;

  const inYear = (hit: { Year: string; Type: string; imdbID: string }) => {
    if (hit.Type !== kind || !/^tt\d+$/.test(hit.imdbID)) return false;
    /* «2017» أو «2017–2018» — أوّلُ أربعة أرقام هي سنةُ البدء */
    const y = Number((hit.Year ?? "").slice(0, 4));
    return Number.isFinite(y) && Math.abs(y - year) <= 1;
  };

  /* 🆕 **والاسمُ المطابقُ بعد التسوية يسبق مجرّدَ اتّفاق السنة** (D-431):
     **السنةُ وحدَها تقبل أوّلَ عملٍ صدر في سنته**، **والاسمُ يقول إنه
     هو.** **والقديمُ يبقى ارتداداً** فلا يخسر أحدٌ ما كان يجده (D-152). */
  for (const hit of all) {
    if (inYear(hit) && normalizeTitle(hit.Title ?? "") === want) return hit.imdbID;
  }
  if (!loose) return null;
  for (const hit of all) {
    if (inYear(hit)) return hit.imdbID;
  }
  return null;
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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * كم يعيش الصفّ المخزَّن قبل أن يستحقّ تجديداً — **متدرّجٌ لا ثابت** (D-132).
 *
 * كان يوماً واحداً للجميع، وهو ما جعل تصحيح القوائم مستحيلاً حسابياً:
 * TOP 250 ×٣ + ذيول الخمسين ≈ ألفُ عملٍ مميّز، فانتهاءُ عمرها جميعاً كل
 * أربعٍ وعشرين ساعة يعني ألف طلبٍ يومياً — الحصة كلها، بلا فائضٍ لصفحات
 * الأعمال ولا للحلقات. ولهذا وقعنا في ترتيب TMDB الذي انتُقدنا بسببه:
 * لم يكن قراراً تصميمياً بل استسلاماً لعدّاد.
 *
 * والحقيقة أن الرقم لا يستحقّ ذلك أصلاً: تقييم «الأب الروحي» بمليونَي
 * صوت لا يتحرّك في خانته العشرية خلال شهر، وفيلمُ الأسبوع الماضي يتحرّك
 * كل يوم. فالعمر يتبع عمر العمل:
 *
 *   أقدم من سنتين      → ٣٠ يوماً   (وهي كلّ قوائم «الأفضل» تقريباً)
 *   بين ٣ أشهر وسنتين  → ٧ أيام
 *   أحدث من ٣ أشهر     → يومٌ واحد  (أو لم يصدر بعد)
 *
 * الأثر: استهلاك القوائم اليوميّ ينهار من ~١٠٠٠ إلى عشراتٍ قليلة.
 *
 * ولا يحتاج عموداً في الجدول: التاريخ في صفّ TMDB الذي بين أيدينا.
 */
function ttlFor(r: SearchResult): number {
  const date = r.release_date || r.first_air_date || "";
  const t = date ? Date.parse(date) : NaN;
  if (!Number.isFinite(t)) return DAY_MS; // بلا تاريخ: عامِله كالجديد
  const age = Date.now() - t;
  if (age > 730 * DAY_MS) return 30 * DAY_MS;
  if (age > 90 * DAY_MS) return 7 * DAY_MS;
  return DAY_MS;
}

interface StoredRating {
  media_type: string;
  tmdb_id: number;
  imdb_rating: number | null;
  imdb_votes: number | null;
  updated_at: string;
}

/**
 * عتبة الأهليّة — الرقم الذي تنشره IMDb نفسها لقائمة الـ٢٥٠.
 *
 * **وهي عتبةُ دخولٍ لا مجرّد مُعامِلٍ في صيغة.** هذا هو الفرق الذي
 * ضيّعناه: الصيغة البايزيّة وحدها لا تحمي القائمة، لأنها تسحب العمل
 * قليل الأصوات نحو **متوسّط البِركة** — وبِركةُ «الأعلى تقييماً» متوسّطها
 * ٨٫٣ لا ٧٫٠، فالسحبُ نحوه يرفع المغمور بدل أن يخفضه. جرّبناها فتصدّر
 * عملٌ ٩٫٨ بمئةٍ وعشرين صوتاً على «شاوشانك» بثلاثة ملايين.
 *
 * IMDb تحلّها بحاجزٍ صريح: **لا يدخل الـ٢٥٠ من لم يبلغ خمسةً وعشرين ألف
 * صوت**. وهذا بالضبط ما يزيل «الأعمال الضعيفة» التي أُبلغنا عنها.
 *
 * والمسلسلات بحاجزٍ أخفض: جمهور التلفزيون على IMDb أصغر من جمهور
 * السينما، وخمسةٌ وعشرون ألفاً هناك تحذف أعمالاً يعرفها الجميع.
 */
/**
 * 🔴 🆕 **عشرون ألفاً للاثنين، ولا لين** (D-323، قرارُ أحمد بنصّه: «أي
 * فلم أو مسلسل لم يصل ٢٠ ألف صوت يسقط»).
 *
 * **وهو يُصلح ما كشفه قياسُ ١٧ أغسطس:** رفُّ «أفضل ٥٠ مسلسل» حمل
 * **Metal Gear Solid** (٩٫٥ بـ١٤٬٢٧٩ صوتاً — **وهي لعبةُ فيديو**)
 * و**«الغودفاذر: النسخة التلفزيونية»** (٩٫٥ بـ٦٬٧٥٥) وذيلاً من أعمالٍ
 * إقليميّةٍ عاليةِ التقييم قليلةِ الأصوات. **وكلُّها كانت تعبر شرعاً**:
 * حاجزُ التلفزيون كان خمسةَ آلاف، **وكان يلين إلى مئتين وخمسين** حين
 * تقصُر البِركة.
 *
 * **والحاجزُ الآن واحدٌ للجهتين ولا يلين**: `FLOOR_MIN` يساوي الحاجزَ
 * نفسَه، **فحلقةُ التليين لا تدور أصلاً** — وهذا مقصودٌ لا سهو.
 * **«يسقط» تعني يسقط**، ولو نقص الرفُّ عن عدده — **وعلاجُ النقص بِركةٌ
 * أوسع لا حاجزٌ أوطأ** (D-185).
 *
 * ⚠️ **وثمنُه مقيسٌ ومكتوب** (استعلامُ ١٧ أغسطس على `imdb_chart`):
 * الأفلام **٢٥٠ → ٢٥٠** (لا تخسر شيئاً)، والمسلسلات **٢٥٠ → ١٧٦**،
 * والأنمي **١٩٧ → ١٢٧**. **فرفوفُ الخمسين بخير، وقائمتا «أفضل ٢٥٠»
 * تنقصان حتى تُعاد تعبئةُ البِركة بالحاجز الجديد** (`CANDIDATE_MIN_VOTES`).
 */
export const IMDB_MIN_VOTES = { movie: 20_000, tv: 20_000 } as const;

/** **ولا لين**: يساوي الحاجزَ فلا تدور حلقةُ التخفيض (D-323) */
const FLOOR_MIN = { movie: 20_000, tv: 20_000 } as const;

/**
 * ترتيب قائمة «الأفضل» كما ترتّبها IMDb: **حاجزُ أصواتٍ ثم صيغةٌ بايزيّة**.
 *
 *   weighted = (v / (v + m)) · R + (m / (v + m)) · C
 *
 * الحاجز يقرّر **من يدخل**، والصيغة تقرّر **بأي ترتيب** — وبينهما يبقى
 * العمل ذو الأصوات الحديّة (٢٥٠٠١ صوتاً) مسحوباً نحو المتوسّط فلا يقفز
 * على مليونيّ صوتٍ بفارق خانةٍ عشرية.
 *
 * **والحاجز يلين قبل أن تنقص القائمة — إلى حدّ.** «نقصٌ في القائمة» هو
 * الشكوى الأخرى التي وصلتنا، فحاجزٌ صارمٌ يعيدها من بابٍ آخر: يُخفَّض
 * درجةً درجة (÷٢٫٥) حتى تكفي البِركة. لكنه **يقف عند `FLOOR_MIN`** ولا
 * ينزل عنه مهما نقصت: عملٌ بمئة صوتٍ لا إجماع عليه أصلاً، وإقحامُه
 * لتكميل عددٍ هو العيب الأول بعينه. العلاج الصحيح للنقص بِركةٌ أوسع
 * (المستدعي يطلب ١٫٦× المطلوب) لا حاجزٌ أوطأ.
 *
 * ومن لا تقييم له خارجٌ في كل الأحوال — «غير مقيَّم» ليس «الأسوأ»،
 * وإقحامُه في قائمة أفضلٍ هو العيب الأول الذي أُبلغنا عنه.
 */
export function rankByImdb<T extends SearchResult>(
  rows: T[],
  opts: { want?: number; minVotes?: number } = {},
): T[] {
  const rated = rows.filter((r) => typeof r.imdb_rating === "number");
  if (!rated.length) return [];

  const isMovie = rated[0].media_type === "movie";
  const want = opts.want ?? rated.length;
  let floor = opts.minVotes ?? (isMovie ? IMDB_MIN_VOTES.movie : IMDB_MIN_VOTES.tv);

  const hardFloor = isMovie ? FLOOR_MIN.movie : FLOOR_MIN.tv;
  let pool = rated.filter((r) => (r.imdb_votes ?? 0) >= floor);
  while (pool.length < want && floor > hardFloor) {
    floor = Math.max(hardFloor, Math.floor(floor / 2.5));
    pool = rated.filter((r) => (r.imdb_votes ?? 0) >= floor);
  }
  /* بِركةٌ **بلا حقلِ أصواتٍ أصلاً** (الهجرة ٤٩ لم تُشغَّل): لا حاجز
     يُطبَّق — **وهذا حدُّه بعد D-323**: كان يُعيد كلَّ شيءٍ حين لا يعبر
     أحدٌ الحاجز، **فيصير الحاجزُ أمنيةً لا قاعدة**. أمّا وقد صار
     «العشرون ألفاً» قراراً صريحاً، **فمن لم يبلغها يسقط ولو فرغ الرفّ**
     — وفراغٌ صادقٌ أهونُ من رفٍّ يُخالف قاعدةً معلَنة (D-063). */
  if (!pool.length && !rated.some((r) => typeof r.imdb_votes === "number")) pool = rated;

  const m = opts.minVotes ?? (isMovie ? IMDB_MIN_VOTES.movie : IMDB_MIN_VOTES.tv);
  const c = pool.reduce((s, r) => s + (r.imdb_rating as number), 0) / pool.length;
  const score = (r: T) => {
    const R = r.imdb_rating as number;
    const v = r.imdb_votes ?? 0;
    return (v / (v + m)) * R + (m / (v + m)) * c;
  };
  return [...pool].sort(
    (a, b) => score(b) - score(a) || (b.imdb_votes ?? 0) - (a.imdb_votes ?? 0),
  );
}

/**
 * الصفوف المقيَّمة وحدها، بترتيب IMDb الخام (التقييم ثم الأصوات).
 *
 * لصفوف «أفضل ١٠/٥٠» حيث البِركة صغيرة ومتقاربة الشهرة: الصيغة
 * البايزيّة هناك تسوّي بينها بلا فائدة، والمتوسّط الخام أصدق. ويبقى
 * المشترَك بين الصفَّين: **غير المقيَّم لا يدخل**.
 */
export function onlyRated<T extends SearchResult>(rows: T[]): T[] {
  return rows.filter((r) => typeof r.imdb_rating === "number");
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
 * بلا مفتاح OMDb: المخزَّن يُقرأ ويُعرض، والمفقود يبقى بلا رقم IMDb —
 * و**لا احتياط TMDB بعد اليوم** (D-132 ينقض D-112): رقم TMDB لعملٍ قد
 * يكون ٩٫٣ بينما تقييمه الحقيقي ٧٫٨، والشعار المختلف لم يمنع القارئ من
 * قراءتهما مقياساً واحداً. من لا تقييم IMDb له يظهر بلا شارة، ويُستبعد
 * من القوائم المرتّبة أصلاً (`onlyRated` / `rankByImdb`).
 */
export async function withImdbRatings<T extends SearchResult>(rows: T[]): Promise<T[]> {
  const out = await attachImdbRatings(rows);
  // لا مخزن ولا مفتاح — الصفّ يعود كما جاء بترتيب TMDB (تدهور صريح)
  if (!out.some((r) => r.imdb_rating !== undefined)) return rows;
  return [...out].sort(
    (a, b) =>
      (b.imdb_rating ?? -1) - (a.imdb_rating ?? -1) ||
      (b.imdb_votes ?? 0) - (a.imdb_votes ?? 0) ||
      (b.vote_count ?? 0) - (a.vote_count ?? 0),
  );
}

/**
 * يُلحق التقييم **بلا إعادة ترتيب** — لصفٍّ ترتيبُه هو معناه.
 *
 * «يُعرض الآن في السينما» مثالُه: سؤاله توقيتٌ لا جودة، وإعادةُ ترتيبه
 * بالتقييم تحوّله إلى «أفضل ما في السينما» — صفٌّ آخر لم يطلبه أحد.
 * وقبل D-132 لم يكن هذا الفرق موجوداً لأن الصفّ كان بلا تقييمٍ أصلاً.
 */
export async function attachImdbRatings<T extends SearchResult>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const out = rows.map((r) => ({ ...r }));
  const keyOf = (r: SearchResult) => `${r.media_type}-${r.id}`;

  // ===== ١ · المخزن: ما لم ينتهِ عمرُه المتدرّج يُعتمد كما هو =====
  const stale = new Map(out.map((r) => [keyOf(r), r]));
  try {
    const supabase = await createClient();
    const ids = [...new Set(out.map((r) => r.id))];
    /* القراءة بدفعات مئتين: `in(...)` تُبنى في مسار الطلب لا في جسمه،
       وبِركة TOP 250 صارت أربعمئة معرّف (D-132) — رابطٌ بهذا الطول قد
       يُردّ ٤١٤ فتسقط القراءة كلّها ويذهب الصفّ بأكمله إلى OMDb */
    const CHUNK_IDS = 200;
    const pages = await Promise.all(
      Array.from({ length: Math.ceil(ids.length / CHUNK_IDS) }, (_, i) =>
        supabase
          .from("imdb_ratings")
          .select("media_type, tmdb_id, imdb_rating, imdb_votes, updated_at")
          .in("tmdb_id", ids.slice(i * CHUNK_IDS, (i + 1) * CHUNK_IDS)),
      ),
    );
    const data = pages.flatMap((p) => p.data ?? []);
    const now = Date.now();
    for (const s of (data ?? []) as StoredRating[]) {
      const r = stale.get(`${s.media_type}-${s.tmdb_id}`);
      if (!r) continue;
      r.imdb_rating = s.imdb_rating == null ? null : Number(s.imdb_rating);
      r.imdb_votes = s.imdb_votes == null ? null : Number(s.imdb_votes);
      /* صفٌّ مخزَّن بتقييمٍ فارغ **لا يُكتب إلا عن يقين** (انظر شرط الكتابة
         أدناه)، فهو وحده دليلُ «لا تقييم IMDb» — D-172 */
      r.imdb_absent = s.imdb_rating == null;
      /* الأصوات غائبة عن صفٍّ كُتب قبل الهجرة ٤٩ ومعه تقييم؟ يُعاد سؤاله:
         الترتيب البايزيّ بلا أصوات هو المتوسّط العاري الذي نصلحه */
      const missingVotes = s.imdb_rating != null && s.imdb_votes == null;
      if (!missingVotes && now - new Date(s.updated_at).getTime() < ttlFor(r)) {
        stale.delete(`${s.media_type}-${s.tmdb_id}`);
      }
    }
  } catch {
    // الجدول غائب أو القراءة فشلت — الكل يمضي إلى OMDb كما قبل الهجرة
  }

  // ===== ٢ · OMDb: الغائب والمنتهي عمره فقط، بدفعات ٢٥ =====
  const toFetch = [...stale.values()];
  const fetched: {
    media_type: string;
    tmdb_id: number;
    imdb_id: string | null;
    imdb_rating: number | null;
    imdb_votes: number | null;
  }[] = [];
  if (process.env.OMDB_API_KEY && toFetch.length) {
    /* أربعون في الدفعة لا خمسٌ وعشرون: مع اشتراك OMDb (قرار أحمد
       9 Aug مساءً) صارت الحصة مئة ألفٍ يومياً بدل ألف، فالخانق لم يعد
       العدّاد بل زمنُ أول رسمة. أوّلُ مَن يفتح قائمة TOP 250 يملأ ٤٠٠
       صفّاً في عشر دفعاتٍ (~٢–٣ ثوانٍ) ثم لا يدفعها أحدٌ بعده لثلاثين
       يوماً — العمر المتدرّج أعلاه. ولو عاد المفتاح مجانياً فالسقف
       يحميه المخزن لا هذا الرقم. */
    const CHUNK = 40;
    for (let i = 0; i < toFetch.length; i += CHUNK) {
      await Promise.all(
        toFetch.slice(i, i + CHUNK).map(async (r) => {
          const iid =
            r.media_type === "tv" ? await tvImdbId(r.id) : await movieImdbId(r.id);
          const ext = await externalRatings(iid);
          const n = ext?.imdb ? Number(ext.imdb) : NaN;
          r.imdb_rating = Number.isFinite(n) ? n : null;
          r.imdb_votes = ext?.votes ?? null;
          /* **يقينُ الغياب (D-172):** إمّا لا معرّف IMDb أصلاً، أو OMDb
             ردَّ ردّاً صحيحاً وقال «لا تقييم». وما عداهما — حصةٌ محروقة أو
             شبكةٌ ساقطة — **ليس يقيناً**، فلا بديلَ يُعرض ولا شيء يُخزَّن. */
          const absent = !iid || (ext !== null && ext.imdb === null);
          r.imdb_absent = absent;
          /* «وجدنا رقماً» أو «لا معرّف IMDb أصلاً» وحدهما يُخزَّنان.
             أما «سألنا OMDb فلم يُجب برقم» فلا: ردُّه واحد للحالتين —
             عملٌ بلا تقييم فعلاً، وحصةٌ منهكة (Request limit) — وتخزينُ
             الثانية يسمّم المخزن بـnull كاذبة تعيش يوماً كاملاً بعد
             تعافي الحصة (وهو ما كاد يحدث يوم التشغيل: الحصة كانت
             محروقة ساعتها). غير المخزَّن يُعاد سؤاله — وخبيئة fetch
             اليومية تمنع التكرار داخل النشرة الواحدة */
          /* وشرطُ الكتابة اتّسع معه: كان «وجدنا رقماً أو لا معرّف»، فصار
             يشمل «سألنا فأجاب: لا تقييم» — وهي الحالة التي كنّا نعيد سؤالها
             كل مرّة لأننا لم نكن نميّزها عن انهاك الحصة. **تمييزُها يوفّر
             نداءً متكرّراً ويُغني عن التعليق الذي كان يعتذر عنه.** */
          if (Number.isFinite(n) || absent) {
            fetched.push({
              media_type: r.media_type === "tv" ? "tv" : "movie",
              tmdb_id: r.id,
              imdb_id: iid ?? null,
              imdb_rating: r.imdb_rating,
              imdb_votes: r.imdb_votes ?? null,
            });
          }
        }),
      );
    }
  }

  // ===== ٣ · الكتابة للمخزن — دفعةً واحدة، وفشلها لا يعطّل العرض =====
  if (fetched.length) {
    try {
      // الكتابةُ بعميل الخدمة (D-898): الدالّةُ لن تبقى ممنوحةً للمفتاح العامّ
      const supabase = await createServiceClient();
      await supabase.rpc("set_imdb_ratings", { p_rows: fetched });
    } catch {
      /* الهجرة لم تُشغَّل بعد — الخبيئة اليومية لطبقة fetch تبقى الشبكة */
    }
  }

  return out;
}
