import "server-only";
import { getMovieFor, getTvFor } from "@/lib/tmdb";

/**
 * ====== بذورُ الترحيب — ٢٤ عملاً مثبَّتةً بالاسم: ١٢ مسلسلاً · ٨ أفلام · ٤ أنمي (D-1344) ======
 *
 * قرارُ أحمد ٧ (١٠ أكتوبر): «ابغاها تكون الاعمال الاكثر شهرة .. قيم اوف ثرونز بريكينق باد وكذا».
 *
 * ⚖️ **كانت تُختار آليّاً بعدد الأصوات عند TMDB (D-1341) وصارت قائمةً مكتوبة** — بعد أوّل تجربةٍ له:
 *  - **الأنمي**: الترتيبُ بالأصوات أخرج «ناروتو» و«قاتل الشياطين» وأسقط «ون بيس» وهو الأشهر — عددُ الأصوات
 *    لا يساوي الشهرةَ في الأنمي. قرارُه: «ون بيس و اتاك و ناروتو شيبودن و ديث نوت خلها هي الاربع».
 *  - **المسلسلات**: خرج فيها «ريفرديل» و«الطبيب الجيد» و«لوسيفر»؛ قرارُه أن تُبدَّل بأسماءٍ سمّاها، فاختير منها
 *    Better Call Saul · Vikings · Lost.
 *  - **والبقيّةُ ثُبّتت معها**: قائمةٌ نصفُها آليٌّ يعيد «ريفرديل» غداً أو يكرّر عملاً. الآن القائمةُ قائمتُه،
 *    ولا تتبدّل إلّا بكلمته.
 *
 * 🔑 **المعرّفاتُ مُتحقَّقٌ منها** (themoviedb.org وبياناتُ المشروع، ١٠ أكتوبر ٢٠٢٦). ⚠️ «ون بيس» الأنمي `37854`؛
 * `111110` مسلسلُ نتفلكس الحيّ بالاسم العربيّ نفسِه — ليس المقصود.
 *
 * 🔑 **الاسمُ والملصقُ يُجلبان حيَّين** (بلغة القارئ، ومسارُ ملصقٍ يُحفظ هنا يشيخ بصمت)؛ والاسمُ المكتوبُ هنا
 * سدٌّ: الخطوةُ مقفولةٌ على عملٍ واحدٍ على الأقلّ (القراران ٨ و١٧)، فعملٌ تعذّر جلبُه يُرسم باسمه وأيقونةٍ ولا
 * يسقط — شبكةٌ فارغةٌ تحبس عضواً جديداً بلا مخرج.
 *
 * ⚖️ **وبلا `railGuard` هنا** (كان في D-1341): الحارسُ يُسقط ما كُتم من لغةٍ ونوعٍ عن رفوفٍ آليّة؛ وهذه قائمةٌ
 * اختارها صاحبُ المنتج عملاً عملاً — حارسٌ يُسقط منها شيئاً ينقض قرارَه.
 *
 * قارئاها: صفحةُ الترحيب (الخطوة الثانية) وجدارُ الملصقات خلف شاشة الدخول الأصليّة (`/api/v1/welcome/posters`).
 */
export interface WelcomeSeed {
  id: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  /* 🆕 T414 — **ما تحتاجه «المشهد» على الحاسوب وحدَه** (الترحيبُ العريض: خلفيّةُ العمل تملأ الشاشة وسطرُ وصفه تحت
     اسمه). من النداء نفسِه الذي يجلب الاسمَ والملصق — لا نداءَ زائد — **واختياريّةٌ** فقارئٌ قديمٌ (جدارُ الملصقات) لا يتغيّر */
  backdropPath?: string | null;
  year?: string | null;
  /** مسلسلٌ: عددُ مواسمه */
  seasons?: number | null;
  /** أوّلُ نوعين بلغة القارئ */
  genres?: string[];
  /** رفُّه في الخطوة الثانية على الحاسوب: مسلسلاتٌ · أفلامٌ · أنمي (القوائمُ الثلاث أدناه) */
  shelf?: "show" | "movie" | "anime";
}

const SHOWS: readonly (readonly [number, string])[] = [
  [1399, "Game of Thrones"],
  [1396, "Breaking Bad"],
  [66732, "Stranger Things"],
  [71446, "Money Heist"],
  [1402, "The Walking Dead"],
  [76479, "The Boys"],
  [60059, "Better Call Saul"],
  [44217, "Vikings"],
  [4607, "Lost"],
  [85271, "WandaVision"],
  [1418, "The Big Bang Theory"],
  [84958, "Loki"],
];

const MOVIES: readonly (readonly [number, string])[] = [
  [157336, "Interstellar"],
  [27205, "Inception"],
  [155, "The Dark Knight"],
  [24428, "The Avengers"],
  [299536, "Avengers: Infinity War"],
  [19995, "Avatar"],
  [293660, "Deadpool"],
  [550, "Fight Club"],
];

const ANIME: readonly (readonly [number, string])[] = [
  [37854, "One Piece"],
  [1429, "Attack on Titan"],
  [31910, "Naruto Shippuden"],
  [13916, "Death Note"],
];

/** 🆕 D-1347 — هل الرقمُ مسلسلٌ من أعمال الترحيب؟ (مسارُ المواسم المفتوحُ لمن لم يُتمّ لا يخدم غيرَها) */
export function isWelcomeShow(id: number): boolean {
  return SHOWS.some(([n]) => n === id) || ANIME.some(([n]) => n === id);
}

/** 🆕 المهمة ٤٢١ — لغةُ الجلب: بلا لغةٍ = لغةُ القارئ كما كانت؛ و`en-US` لصفحة الدعوة (انظر `welcomeSeeds`) */
type SeedLanguage = "en-US" | null;

async function show([id, name]: readonly [number, string], shelf: "show" | "anime", language: SeedLanguage): Promise<WelcomeSeed> {
  try {
    const tv = await getTvFor(id, language);
    return {
      id,
      mediaType: "tv",
      title: tv.name || name,
      posterPath: tv.poster_path ?? null,
      backdropPath: tv.backdrop_path ?? null,
      year: tv.first_air_date?.slice(0, 4) || null,
      seasons: tv.number_of_seasons || null,
      genres: (tv.genres ?? []).slice(0, 2).map((g) => g.name),
      shelf,
    };
  } catch {
    return { id, mediaType: "tv", title: name, posterPath: null, shelf };
  }
}

async function movie([id, name]: readonly [number, string], language: SeedLanguage): Promise<WelcomeSeed> {
  try {
    const m = await getMovieFor(id, language);
    return {
      id,
      mediaType: "movie",
      title: m.title || name,
      posterPath: m.poster_path ?? null,
      backdropPath: m.backdrop_path ?? null,
      year: m.release_date?.slice(0, 4) || null,
      genres: (m.genres ?? []).slice(0, 2).map((g) => g.name),
      shelf: "movie",
    };
  } catch {
    return { id, mediaType: "movie", title: name, posterPath: null, shelf: "movie" };
  }
}

/**
 * 🆕 المهمة ٤٢١ — **`language` اختياريّة**: كلُّ قارئٍ قديمٍ يناديها بلا شيءٍ فيبقى على لغة القارئ حرفاً.
 * وصفحةُ الدعوة (`/invite/[code]`) تطلبها `en-US`: قرارُ أحمد (١٨ نوفمبر) «الاعمال فالخلفية خلي بوستراتها بالانجليزي» —
 * جدارُها واجهةُ حملةٍ يراها زائرٌ لم يختر لغةً بعد، والملصقُ الإنجليزيُّ هو المعروفُ في كلِّ بلد.
 */
export async function welcomeSeeds(opts: { language?: SeedLanguage } = {}): Promise<WelcomeSeed[]> {
  const language = opts.language ?? null;
  const all = await Promise.all([
    ...SHOWS.map((s) => show(s, "show", language)),
    ...MOVIES.map((m) => movie(m, language)),
    ...ANIME.map((s) => show(s, "anime", language)),
  ]);
  /* الشاشةُ تعرف العملَ برقمه وحدَه (`picked`) — ورقمُ مسلسلٍ قد يطابق رقمَ فيلمٍ عند TMDB: الثاني يسقط */
  const seen = new Set<number>();
  return all.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}
