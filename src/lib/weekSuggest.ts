import { getCinema } from "@/lib/cinemaTitles";
import { upcomingByFilter } from "@/lib/tmdb";
import type { HomeWeekSuggest } from "@/core/contracts/home";
import { sanitizeWeekSuggest, type WeekSuggestPrefs } from "@/core/weekSuggest";
import { BROWSE_GENRES } from "@/core/browse";

/** أنواعُ المفضّلة مخزّنةٌ بمعرّفات TMDB كما اختيرت (أفلامٌ غالباً)، والمسلسلاتُ لها معرّفاتُها («أكشن» ٢٨ ⇐ ١٠٧٥٩) — يُترجَم الطرفان بقاموس التصفّح الواحد */
function genresFor(ids: number[], kind: "movie" | "tv"): number[] {
  const out = new Set<number>();
  for (const id of ids) {
    const g = BROWSE_GENRES.find((x) => x.movie.includes(id) || x.tv.includes(id));
    for (const v of g ? g[kind] : [id]) out.add(v);
  }
  return [...out].slice(0, 6);
}

/**
 * ====== 🆕 T606 — «أسبوعك» حين يفرغ (استوديو س٤٢ «ب»، أحمد ٢٨ نوفمبر) ======
 *
 * **لماذا**: «عشان ما يكون الأسبوع فاضي تظهر فيه الأشياء في السينما… أو القادمة حسب اهتمام الشخص». اختار «ب»: القادمُ لذوقك ومعه
 * السينما، كلٌّ في يومه، **ومع إمكانية تحديد ما يظهر** (`WeekSuggestPrefs` في `ui_state.week`).
 *
 * - **يُحسب حين يفرغ الأسبوعُ وحدَه** (المستدعي يقرّر): أسبوعٌ فيه حلقةٌ واحدة يبقى كما هو.
 * - **السينما**: «قريباً» في صالات السعوديّة بتاريخ نزوله داخل الأيّام الأربعة عشر (`getCinema` — المخزنُ نفسُه).
 * - **لذوقك**: أفلامٌ ومسلسلاتٌ جديدةٌ تبدأ في الأيّام نفسِها من أنواعك المفضّلة (`favorite_genres`)، بالشعبيّة — وبلا أنواعٍ مختارة
 *   فالأشهرُ القادم. ما في مكتبتك أصلاً لا يُقترح.
 * - **سقفُ ستّة** في الأسبوعين، واحدٌ لكلِّ عمل: الشريطُ نافذةٌ لا قائمة.
 * - **ميزانيّةُ وقت** (`BUDGET_MS`) **ويبدأ مع بناء الرئيسيّة لا بعده** (المستدعي): الرئيسيّةُ لا تنتظر TMDB؛ ما لم يصل في وقته
 *   لا يُرسم، والأسبوعُ يقول «فارغ» كما كان.
 */
const MAX = 6;
const PER_SOURCE = 4;
const BUDGET_MS = 900;

export async function weekSuggestions(o: {
  dates: string[];
  favGenres: number[];
  prefs: unknown;
  /** معرّفاتُ ما في المكتبة (`tv-1` · `movie-2`) — لا يُقترح ما عندك */
  known: ReadonlySet<string>;
}): Promise<{ items: HomeWeekSuggest[]; prefs: WeekSuggestPrefs }> {
  const prefs = sanitizeWeekSuggest(o.prefs);
  if (!o.dates.length || (!prefs.cinema && !prefs.taste)) return { items: [], prefs };
  const inside = new Set(o.dates);
  const first = o.dates[0];
  const last = o.dates[o.dates.length - 1];

  const cinema = async (): Promise<HomeWeekSuggest[]> => {
    if (!prefs.cinema) return [];
    const c = await getCinema();
    return c.soon
      .filter((x) => x.sa_date && inside.has(x.sa_date) && !o.known.has(`movie-${x.id}`))
      .slice(0, PER_SOURCE)
      .map((x) => ({ date: x.sa_date as string, kind: "movie" as const, id: x.id, title: x.title, poster_path: x.poster_path, tag: "cinema" as const }));
  };
  const taste = async (): Promise<HomeWeekSuggest[]> => {
    if (!prefs.taste) return [];
    const favs = o.favGenres.slice(0, 4);
    const [movies, shows] = await Promise.all([
      upcomingByFilter("movie", { genreIds: genresFor(favs, "movie"), from: first, to: last }),
      upcomingByFilter("tv", { genreIds: genresFor(favs, "tv"), from: first, to: last }),
    ]);
    const all = [
      ...movies.map((r) => ({ r, date: r.release_date ?? "", kind: "movie" as const })),
      ...shows.map((r) => ({ r, date: r.first_air_date ?? "", kind: "tv" as const })),
    ]
      .filter((x) => inside.has(x.date) && !o.known.has(`${x.kind}-${x.r.id}`))
      .sort((a, b) => (b.r.popularity ?? 0) - (a.r.popularity ?? 0));
    return all.slice(0, PER_SOURCE).map((x) => ({
      date: x.date,
      kind: x.kind,
      id: x.r.id,
      title: x.r.title ?? x.r.name ?? "",
      poster_path: x.r.poster_path ?? null,
      tag: x.kind === "tv" ? ("starts" as const) : ("release" as const),
    }));
  };

  const timeout = new Promise<null>((res) => setTimeout(() => res(null), BUDGET_MS));
  const settle = <T,>(p: Promise<T[]>) => Promise.race([p.catch(() => [] as T[]), timeout.then(() => [] as T[])]);
  const [a, b] = await Promise.all([settle(cinema()), settle(taste())]);
  /* السينما أوّلاً في اليوم نفسِه (الأوضحُ سبباً)، ثمّ بالتاريخ؛ وعملٌ في المصدرين مرّةً واحدة */
  const seen = new Set<string>();
  const items = [...a, ...b]
    .filter((x) => {
      const k = `${x.kind}-${x.id}`;
      if (seen.has(k) || !x.title) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => x.date.localeCompare(y.date))
    .slice(0, MAX);
  return { items, prefs };
}
