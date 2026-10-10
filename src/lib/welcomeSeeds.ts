import "server-only";
import { mostVoted, type SearchResult } from "@/lib/tmdb";
import { railGuard } from "@/lib/topChart";

/**
 * ====== بذورُ الترحيب — الأكثرُ شهرةً، ١٢ مسلسلاً · ٨ أفلام · ٤ أنمي (D-1341) ======
 *
 * قرارُ أحمد ٧: «ابغاها تكون الاعمال الاكثر شهرة .. قيم اوف ثرونز بريكينق باد وكذا» — كانت ٢٤ من
 * «رائج هذا الأسبوع»، ورائجُ الأسبوع أعمالٌ نزلت للتوّ قد لا يعرف الوافدُ منها واحداً.
 *
 * 🔑 **والخطوةُ مقفولةٌ على عملٍ واحدٍ على الأقلّ** (القراران ٨ و١٧) — فشبكةٌ فارغةٌ هنا تحبس
 * عضواً جديداً بلا مخرج. ولهذا **قائمةٌ ثابتةٌ في الشيفرة تسدّ كلَّ خانةٍ يعجز عنها TMDB**:
 * معرّفاتُها مُتحقَّقٌ منها (themoviedb.org، ١٠ أكتوبر ٢٠٢٦)، وبلا مسار ملصقٍ عمداً — مسارٌ يُحفظ
 * هنا يشيخ بصمت، والبطاقةُ ترسم اسمَ العمل وأيقونةً بدل صورةٍ مكسورة.
 *
 * ⚠️ **والحارسُ نفسُه** (`railGuard`، D-321): الضغطةُ هنا تكتب المكتبة، فبذرةٌ مكتومةٌ تُختار تصير
 * ذوقاً يولّد أمثالَه في «مقترح لك».
 */
export interface WelcomeSeed {
  id: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
}

const WANT = { tv: 12, movie: 8, anime: 4 } as const;

const FALLBACK: { tv: WelcomeSeed[]; movie: WelcomeSeed[]; anime: WelcomeSeed[] } = {
  tv: [
    [1399, "Game of Thrones"],
    [1396, "Breaking Bad"],
    [66732, "Stranger Things"],
    [1402, "The Walking Dead"],
    [93405, "Squid Game"],
    [71446, "Money Heist"],
    [76479, "The Boys"],
    [100088, "The Last of Us"],
    [119051, "Wednesday"],
    [71912, "The Witcher"],
    [60574, "Peaky Blinders"],
    [87108, "Chernobyl"],
  ].map(([id, title]) => ({ id: id as number, mediaType: "tv" as const, title: title as string, posterPath: null })),
  movie: [
    [27205, "Inception"],
    [157336, "Interstellar"],
    [155, "The Dark Knight"],
    [19995, "Avatar"],
    [24428, "The Avengers"],
    [550, "Fight Club"],
    [475557, "Joker"],
    [597, "Titanic"],
  ].map(([id, title]) => ({ id: id as number, mediaType: "movie" as const, title: title as string, posterPath: null })),
  anime: [
    [1429, "Attack on Titan"],
    [13916, "Death Note"],
    [37854, "One Piece"],
    [85937, "Demon Slayer: Kimetsu no Yaiba"],
  ].map(([id, title]) => ({ id: id as number, mediaType: "tv" as const, title: title as string, posterPath: null })),
};

function toSeeds(rows: SearchResult[], mediaType: "tv" | "movie"): WelcomeSeed[] {
  return rows
    .filter((r) => r.poster_path)
    .map((r) => ({ id: r.id, mediaType, title: r.title ?? r.name ?? "—", posterPath: r.poster_path }));
}

/** حصّةٌ واحدة: ما أعاده TMDB أوّلاً، وما نقص يُكمَل من الثابتة — بلا تكرار */
function fill(live: WelcomeSeed[], fallback: WelcomeSeed[], want: number): WelcomeSeed[] {
  const out = live.slice(0, want);
  for (const f of fallback) {
    if (out.length >= want) break;
    if (!out.some((s) => s.id === f.id)) out.push(f);
  }
  return out;
}

export async function welcomeSeeds(): Promise<WelcomeSeed[]> {
  const [tv, movie, anime] = await Promise.all([
    mostVoted("tv").then((r) => toSeeds(railGuard(r, { anime: "drop" }), "tv")).catch(() => []),
    mostVoted("movie").then((r) => toSeeds(railGuard(r, { anime: "drop" }), "movie")).catch(() => []),
    mostVoted("tv", true).then((r) => toSeeds(railGuard(r, { anime: "only" }), "tv")).catch(() => []),
  ]);
  const all = [
    ...fill(tv, FALLBACK.tv, WANT.tv),
    ...fill(movie, FALLBACK.movie, WANT.movie),
    ...fill(anime, FALLBACK.anime, WANT.anime),
  ];
  /* الشاشةُ تعرف العملَ برقمه وحدَه (`picked`) — ورقمُ مسلسلٍ قد يطابق رقمَ فيلمٍ عند TMDB: الثاني يسقط */
  const seen = new Set<number>();
  return all.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}
