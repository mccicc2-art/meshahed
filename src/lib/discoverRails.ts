import { buildSection, sectionHref } from "@/lib/sections";
import {
  nowPlayingMovies,
  topTenAnimeThisWeek,
  topTenAnimeMoviesThisWeek,
  upcomingByFilter,
  topByFilter,
  keywordId,
  ANIME_KEYWORD,
  type SearchResult,
  type DiscoverFilter,
} from "@/lib/tmdb";
import { attachImdbRatings, withImdbRatings } from "@/lib/omdb";
import { railGuard, topChartRail, animeMovieRail, looksAnime } from "@/lib/topChart";
import { localizeRows } from "@/lib/localize";
import { getSuggestions } from "@/lib/suggest";
import { getLibState } from "@/lib/libState";
import { BROWSE_GENRES, BROWSE_TAGS, browseGenreName, browseTagName } from "@/core/browse";
import type { MyRow } from "@/core/myRows";
import type { Locale } from "@/core/i18n";
import type { RailWin } from "@/core/browse";

/**
 * ====== صفوفُ «اكتشف» المنسَّقة — مصدرٌ واحدٌ للصفحة وللشاشة الأصليّة ======
 * (Phase 11-C · C1 — D-955)
 *
 * 🔑 **لماذا هذا الملفّ**: `news/page.tsx` كان يبني وعودَ الصفوف الثمانية
 * داخل `CuratedRails` وحدَه — **فشاشةٌ أصليّةٌ تريد الصفوفَ نفسَها كانت ستنسخ
 * الوصفة** (D-199: صفحةٌ تُبنى بمصدرٍ ثانٍ تعرض غيرَ ما ضُغط). فالوصفةُ هنا،
 * **والصفحةُ والمسارُ `/api/v1/discover/rail` يناديانها بالحجج نفسِها.**
 * **الحالةُ الافتراضيّةُ وحدَها في C1** (بلا فلترِ تصفّح): الفلترُ النشط بابٌ
 * ويبيٌّ (`/news?…`) حتى يثبت الأصليُّ (خطّة 11-C §٢).
 *
 * ⚠️ **ليست عامّةً قابلةً للكاش**: `buildSection` تقرأ تفضيلاتِ المحتوى
 * (اللغاتُ المستبعدة) من ملفّ القارئ — فالردُّ لكلِّ مستخدمٍ ردُّه.
 */
export type CuratedKey = "cinemas" | "airing" | "popular" | "top10-movie" | "top10-tv" | "top50-movie" | "top50-tv" | "soon";
export const CURATED_KEYS: readonly CuratedKey[] = ["cinemas", "airing", "popular", "top10-movie", "top10-tv", "top50-movie", "top50-tv", "soon"];
export function isCuratedKey(v: string): v is CuratedKey {
  return (CURATED_KEYS as readonly string[]).includes(v);
}

/** ما كانت الصفحةُ تسمّيه `bestOfYear` (D-420/D-827) — نُقل كما هو، بتوقيعه */
export async function bestOfYear(
  kind: "movie" | "tv",
  locale: Locale,
  base: DiscoverFilter = {},
  genreIds?: number[],
): Promise<SearchResult[]> {
  const ranked = await buildSection("top-25", { media: kind, base, genreIds, active: false, locale }, 25);
  const l = await localizeRows(
    ranked.map((r) => ({
      tmdb_id: r.id,
      media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie",
      title: r.title ?? r.name ?? null,
      poster_path: r.poster_path,
    })),
    locale,
    ranked.length,
  );
  return ranked.map((r, i) => ({
    ...r,
    title: l[i]?.title ?? r.title,
    name: l[i]?.title ?? r.name,
    poster_path: l[i]?.poster_path ?? r.poster_path,
  }));
}

export function dateOfResult(r: SearchResult): string {
  return r.release_date ?? r.first_air_date ?? "";
}

export type CuratedOpts = {
  /** «مسلسلات» تريد `tv` وحدَه، «أفلام» تريد `movie` وحدَه، و«أنمي» وصفتُه وصفةُ `AnimeRails` (C2) */
  type: "tv" | "movie" | "anime";
  locale: Locale;
  region: string;
  /** نافذةُ أفضل عشرة (أسبوع افتراضاً) */
  win?: RailWin;
};

/**
 * صفٌّ واحدٌ بمفتاحه — **الوصفةُ نفسُها التي في `CuratedRails` للحالة
 * الافتراضيّة** (base = المنطقة وحدَها، لا نوعَ ولا حقبة). `cinemas` تعود مع
 * منطقتها (سطرُ «في سينمات السعودية»)، و`soon` مرتَّبةً بتاريخ الصدور من
 * اليوم فصاعداً (`buildSoonItems`)، والباقي كما هو.
 */
export async function curatedRail(
  key: CuratedKey,
  { type, locale, region, win = "week" }: CuratedOpts,
): Promise<{ items: SearchResult[]; region?: string }> {
  if (type === "anime") return animeRail(key, { locale, region, win });
  const base: DiscoverFilter = { watchRegion: region };
  const wantMovies = type !== "tv";
  const todayStr = new Date().toISOString().slice(0, 10);
  const back30 = new Date();
  back30.setUTCDate(back30.getUTCDate() - 30);
  const winRange = win === "month" ? { from: back30.toISOString().slice(0, 10), to: todayStr } : null;
  const none = { items: [] as SearchResult[] };

  switch (key) {
    case "airing":
      return none; // «يُعرض الآن» صفُّ الأنمي وحدَه في الصفحة
    case "cinemas": {
      if (!wantMovies) return none;
      const [results, c] = await Promise.all([
        buildSection("in-cinemas", { media: "movie", base, active: false }, 20),
        nowPlayingMovies().catch(() => null),
      ]).catch(() => [[] as SearchResult[], null] as const);
      if (!results.length || !c) return none;
      return { items: await attachImdbRatings(results), region: c.region };
    }
    case "popular":
      return {
        items: await buildSection(
          "most-popular",
          { media: wantMovies ? "movie" : "tv", base, active: false, sample: true, locale },
          20,
        )
          .then(attachImdbRatings)
          .catch(() => []),
      };
    case "top10-movie":
    case "top10-tv": {
      const mt = key === "top10-movie" ? "movie" : "tv";
      if ((mt === "movie") !== wantMovies) return none;
      return {
        items: await buildSection("top-ten", { media: mt, base, active: false, win, winRange }, 10)
          .then((rows) => railGuard(rows, { unmute: false }))
          .then(withImdbRatings)
          .catch(() => []),
      };
    }
    case "top50-movie":
    case "top50-tv": {
      const mt = key === "top50-movie" ? "movie" : "tv";
      if ((mt === "movie") !== wantMovies) return none;
      return { items: await bestOfYear(mt, locale, base).catch(() => []) };
    }
    case "soon": {
      const [m, s] = await Promise.all([
        wantMovies ? buildSection("upcoming", { media: "movie", base, active: false }, 20).catch(() => []) : [],
        !wantMovies ? buildSection("upcoming", { media: "tv", base, active: false }, 20).catch(() => []) : [],
      ]);
      const items = railGuard([...m, ...s], { unmute: false })
        .filter((r) => r.media_type === "tv" || r.media_type === "movie")
        .filter((r) => dateOfResult(r) >= todayStr)
        .sort((a, b) => dateOfResult(a).localeCompare(dateOfResult(b)))
        .slice(0, 20);
      return { items };
    }
  }
}

/**
 * صفوفُ الأنمي — وصفةُ `AnimeRails` للحالة الافتراضيّة (C2 · D-955): البِركةُ
 * بكلمة `ANIME_KEYWORD`، أفضلُ ١٠ من `topTenAnime*ThisWeek`، «يُعرض الآن» من
 * `airing-now`، القادمُ من `upcomingByFilter` بحارس `anime:"only"`، وأفضلُ ٥٠
 * على الإطلاق من `topChartRail("anime")` (والأفلامُ تسقط إلى `animeMovieRail`).
 */
async function animeRail(
  key: CuratedKey,
  { locale, region, win = "week" }: Omit<CuratedOpts, "type">,
): Promise<{ items: SearchResult[]; region?: string }> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const back30 = new Date();
  back30.setUTCDate(back30.getUTCDate() - 30);
  const winRange = win === "month" ? { from: back30.toISOString().slice(0, 10), to: todayStr } : undefined;
  const base: DiscoverFilter = { watchRegion: region, keywords: [ANIME_KEYWORD] };
  const none = { items: [] as SearchResult[] };
  switch (key) {
    case "cinemas": {
      const c = await nowPlayingMovies().catch(() => null);
      if (!c) return none;
      const only = railGuard(c.results, { anime: "only" });
      return only.length ? { items: await attachImdbRatings(only), region: c.region } : none;
    }
    case "airing":
      return { items: await buildSection("airing-now", { media: "anime", base, active: false }, 20).then(withImdbRatings).catch(() => []) };
    case "popular":
      return { items: await buildSection("most-popular", { media: "anime", base, active: false, sample: true }, 20).then(attachImdbRatings).catch(() => []) };
    case "top10-movie":
      return {
        items: await topTenAnimeMoviesThisWeek(10, winRange)
          .then((rows) => railGuard(rows, { anime: "only" }))
          .then(withImdbRatings)
          .catch(() => []),
      };
    case "top10-tv":
      return {
        items: await topTenAnimeThisWeek(10, winRange)
          .then((rows) => railGuard(rows, { anime: "only" }))
          .then(withImdbRatings)
          .catch(() => []),
      };
    case "soon":
      return { items: await upcomingByFilter("tv", base).then((rows) => railGuard(rows, { anime: "only" })).catch(() => []) };
    case "top50-movie":
      return {
        items: await topChartRail("anime", 50, locale, "movie")
          .then((r) => (r.length > 0 ? r : animeMovieRail(50, locale)))
          .catch(() => []),
      };
    case "top50-tv":
      return { items: await topChartRail("anime", 50, locale, "tv").catch(() => []) };
  }
}

/* ====== الصفوفُ الشخصيّة — وصفةُ `PersonalRails` + `MyRowsRails` (C2 · D-955) ====== */
export type PersonalTab = "shows" | "movies" | "anime";
export type PersonalRailsResult = {
  /** «مقترحٌ لك» — مع سببه (`seedTitle`) كما في `PickedForYou` */
  foryou: { result: SearchResult; seedTitle: string | null }[];
  /** صفوفي (`myRows` من الكوكي) — كلُّ صفٍّ بعنوانه وبابه */
  myrows: { key: string; title: string; items: SearchResult[]; see_all: string }[];
  /** «من فنّانيك» — للأفلام غيرِ الأنمي وحدَها، كما في الصفحة */
  artists: SearchResult[];
  libState: Awaited<ReturnType<typeof getLibState>>;
};

/**
 * 🔑 **الوصفةُ نفسُها بلا فلترٍ نشط**: بِركةُ `getSuggestions(300)` تُقصر على
 * التبويب (`looksAnime` للأنمي، النوعُ لغيره) وتُخلط عشوائيّاً؛ وصفوفي بـ`topByFilter`
 * على النوع (+ الثيم) بـ١٨ ثمّ الحارس ثمّ ١٢، **ولا صفَّ بأقلَّ من أربعة**؛
 * والفنّانون من `from-artists`. **الشخصيُّ لا يُخبَّأ** (`private, no-store`).
 */
export async function personalRails(
  tab: PersonalTab,
  { locale, region, myRows }: { locale: Locale; region: string; myRows: MyRow[] },
): Promise<PersonalRailsResult> {
  const anime = tab === "anime";
  const wantMovies = tab !== "shows";
  const media = tab === "movies" ? ("movie" as const) : ("tv" as const);
  const lang = locale === "en" ? ("en" as const) : ("ar" as const);
  const [pool, artistWorks, libState] = await Promise.all([
    getSuggestions(300, locale).catch(() => []),
    wantMovies && !anime ? buildSection("from-artists", { media: "movie", base: {}, active: false }, 20).catch(() => []) : Promise.resolve([] as SearchResult[]),
    getLibState(),
  ]);
  const suggested = pool.filter((s) =>
    anime ? looksAnime(s.result) : (wantMovies ? s.result.media_type === "movie" : s.result.media_type === "tv") && !looksAnime(s.result),
  );
  for (let i = suggested.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [suggested[i], suggested[j]] = [suggested[j], suggested[i]];
  }
  const built = await Promise.all(
    myRows.map(async (r) => {
      const g = BROWSE_GENRES.find((x) => x.slug === r.genre);
      const ids = g ? (media === "movie" ? g.movie : g.tv) : [];
      if (!g || !ids.length) return null;
      const tagDef = r.tag ? BROWSE_TAGS.find((x) => x.slug === r.tag) : null;
      const tagId = tagDef ? await keywordId(tagDef.q).catch(() => null) : null;
      const keywords = [...(anime ? [ANIME_KEYWORD] : []), ...(tagId ? [tagId] : [])];
      const items = await topByFilter(media, { watchRegion: region, genreIds: ids, ...(keywords.length ? { keywords } : {}) }, 18, "popularity.desc").catch(() => []);
      const guarded = railGuard(items, { anime: anime ? "only" : "drop" }).slice(0, 12);
      const rows2 = await withImdbRatings(guarded).catch(() => guarded);
      if (rows2.length < 4) return null;
      const p = new URLSearchParams();
      p.set("g", r.genre);
      if (r.tag) p.set("tag", r.tag);
      return {
        key: r.genre + (r.tag ?? ""),
        title: browseGenreName(g, lang) + (tagDef ? ` · ${browseTagName(tagDef, lang)}` : ""),
        items: rows2,
        see_all: sectionHref("my-row", anime ? "anime" : media, p.toString()),
      };
    }),
  );
  return {
    foryou: suggested.map((s) => ({ result: s.result, seedTitle: s.seedTitle ?? null })),
    myrows: built.filter((b): b is NonNullable<typeof b> => !!b),
    artists: artistWorks,
    libState,
  };
}
