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
  companyId,
} from "@/lib/tmdb";
import { attachImdbRatings, withImdbRatings } from "@/lib/omdb";
import { railGuard, topChartRail, animeMovieRail, looksAnime } from "@/lib/topChart";
import { localizeRows } from "@/lib/localize";
import { getSuggestions } from "@/lib/suggest";
import { getLibState } from "@/lib/libState";
import { BROWSE_GENRES, BROWSE_TAGS, browseGenreName, browseTagName, eraRange, seasonRange, type BrowseQuery } from "@/core/browse";
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
  /**
   * 🆕 D-992 (Phase 11-C4، قرارُ أحمد «كلّها أصليّة»): الفلترُ نفسُه الذي تطيعه الصفحةُ
   * (`CuratedRails`/`AnimeRails`) — نوعٌ · لغةٌ · بلدٌ · منصّةٌ · حقبةٌ · تقييمٌ · وسمٌ ·
   * حالةٌ · موسمٌ واستوديو للأنمي. غيابُه = الوصفةُ الافتراضيّة كما كانت (C2).
   */
  browse?: BrowseQuery | null;
};

/**
 * قاعدةُ الاستعلام من الفلتر — **السطورُ نفسُها التي في الصفحة** (`base` في
 * `CuratedRails` و`AnimeRails`)، جُمعت هنا لأنّ لها قارئين (D-376). الوسمُ والاستوديو
 * يُحلّان إلى معرّفات TMDB وما تعذّر يسقط وحدَه (D-144).
 */
async function browseBase(b: BrowseQuery, region: string, anime: boolean): Promise<{ base: DiscoverFilter; upcoming: boolean; unmute: boolean }> {
  const eraR = eraRange(b.era);
  const tagId = b.tag ? await keywordId(b.tag.q) : null;
  const studioId = anime && b.studio ? await companyId(b.studio.name) : null;
  const y = new Date().getUTCFullYear();
  const seasonR = anime && b.season ? seasonRange(b.season, eraR.to ? Number(eraR.to.slice(0, 4)) : y) : null;
  const base: DiscoverFilter = {
    lang: b.lang?.code ?? null,
    country: b.country?.code ?? null,
    provider: b.provider,
    watchRegion: region,
    from: seasonR?.from ?? eraR.from,
    to: seasonR?.to ?? eraR.to,
    minRate: b.rate,
    keywords: anime ? [ANIME_KEYWORD, ...(tagId ? [tagId] : [])] : tagId ? [tagId] : undefined,
    companies: studioId ? [studioId] : undefined,
    ...(anime ? {} : { status: b.status?.code ?? null }),
  };
  return { base, upcoming: b.era?.upcoming === true, unmute: !!b.lang || !!b.country };
}

/**
 * صفٌّ واحدٌ بمفتاحه — **الوصفةُ نفسُها التي في `CuratedRails` للحالة
 * الافتراضيّة** (base = المنطقة وحدَها، لا نوعَ ولا حقبة). `cinemas` تعود مع
 * منطقتها (سطرُ «في سينمات السعودية»)، و`soon` مرتَّبةً بتاريخ الصدور من
 * اليوم فصاعداً (`buildSoonItems`)، والباقي كما هو.
 */
export async function curatedRail(
  key: CuratedKey,
  { type, locale, region, win = "week", browse = null }: CuratedOpts,
): Promise<{ items: SearchResult[]; region?: string }> {
  if (type === "anime") return animeRail(key, { locale, region, win, browse });
  /* D-992 — بفلترٍ نشط: القاعدةُ من الفلتر، وحُرّاسُ الصفحة معها (`active` للأقسام،
     `unmute` لأفضل عشرة، و`upcoming` يُسكت أفضلَ عشرة كما تفعل الصفحة) */
  const b = browse?.active ? browse : null;
  const bb = b ? await browseBase(b, region, false) : null;
  const base: DiscoverFilter = bb?.base ?? { watchRegion: region };
  const active = !!b;
  const unmute = bb?.unmute ?? false;
  const upcomingOnly = bb?.upcoming ?? false;
  const wantMovies = type !== "tv";
  const genreIds = b?.genre ? (wantMovies ? b.genre.movie : b.genre.tv) : undefined;
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
        buildSection("in-cinemas", { media: "movie", base, genreIds, active }, 20),
        nowPlayingMovies().catch(() => null),
      ]).catch(() => [[] as SearchResult[], null] as const);
      if (!results.length || !c) return none;
      return { items: await attachImdbRatings(results), region: c.region };
    }
    case "popular":
      return {
        items: await buildSection(
          "most-popular",
          { media: wantMovies ? "movie" : "tv", base, genreIds, active, sample: true, locale },
          20,
        )
          .then(attachImdbRatings)
          .catch(() => []),
      };
    case "top10-movie":
    case "top10-tv": {
      const mt = key === "top10-movie" ? "movie" : "tv";
      if ((mt === "movie") !== wantMovies || upcomingOnly) return none;
      return {
        items: await buildSection("top-ten", { media: mt, base, genreIds, active, win, winRange }, 10)
          .then((rows) => railGuard(rows, { unmute }))
          .then(withImdbRatings)
          .catch(() => []),
      };
    }
    case "top50-movie":
    case "top50-tv": {
      const mt = key === "top50-movie" ? "movie" : "tv";
      if ((mt === "movie") !== wantMovies) return none;
      return { items: await bestOfYear(mt, locale, base, genreIds).catch(() => []) };
    }
    case "soon": {
      const [m, s] = await Promise.all([
        wantMovies ? buildSection("upcoming", { media: "movie", base, genreIds, active }, 20).catch(() => []) : [],
        !wantMovies ? buildSection("upcoming", { media: "tv", base, genreIds, active }, 20).catch(() => []) : [],
      ]);
      const items = railGuard([...m, ...s], { unmute })
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
  { locale, region, win = "week", browse = null }: Omit<CuratedOpts, "type">,
): Promise<{ items: SearchResult[]; region?: string }> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const back30 = new Date();
  back30.setUTCDate(back30.getUTCDate() - 30);
  const winRange = win === "month" ? { from: back30.toISOString().slice(0, 10), to: todayStr } : undefined;
  /* D-992 — وصفةُ `AnimeRails` بفلترٍ نشط: القاعدةُ تحمل الموسمَ والاستوديو، وأفضلُ عشرة
     تُبنى بـ`topByFilter` على القاعدة (لا بقائمة الأسبوع الجاهزة) كما في الصفحة */
  const b = browse?.active ? browse : null;
  const bb = b ? await browseBase(b, region, true) : null;
  const base: DiscoverFilter = bb?.base ?? { watchRegion: region, keywords: [ANIME_KEYWORD] };
  const active = !!b;
  const genreIds = b?.genre ? b.genre.tv : undefined;
  const none = { items: [] as SearchResult[] };
  const animeTop = (mt: "movie" | "tv") =>
    active
      ? topByFilter(mt, { ...base, ...(winRange ?? {}), genreIds }, 10, win === "week" ? "vote_average.desc" : "popularity.desc")
      : mt === "movie"
        ? topTenAnimeMoviesThisWeek(10, winRange)
        : topTenAnimeThisWeek(10, winRange);
  switch (key) {
    case "cinemas": {
      const c = await nowPlayingMovies().catch(() => null);
      if (!c) return none;
      const only = railGuard(c.results, { anime: "only" });
      return only.length ? { items: await attachImdbRatings(only), region: c.region } : none;
    }
    case "airing":
      return { items: await buildSection("airing-now", { media: "anime", base, genreIds, active }, 20).then(withImdbRatings).catch(() => []) };
    case "popular":
      return { items: await buildSection("most-popular", { media: "anime", base, genreIds, active, sample: true }, 20).then(attachImdbRatings).catch(() => []) };
    case "top10-movie":
      return {
        items: await animeTop("movie")
          .then((rows) => railGuard(rows, { anime: "only" }))
          .then(withImdbRatings)
          .catch(() => []),
      };
    case "top10-tv":
      return {
        items: await animeTop("tv")
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

/**
 * ترشيحُ نتيجةٍ جاهزة بالمحاور المحلّيّة للفلتر (نوع · لغة · بلد · تقييم · حقبة) — للصفوف
 * الشخصيّة التي لا تُبنى باستعلام (`foryou` · صفوفي · من فنّانيك). كانت في `news/page.tsx`
 * وصار لها قارئٌ ثانٍ (`/api/v1/discover/personal`، D-992).
 */
export function matchesBrowse(r: SearchResult, b: BrowseQuery, ids?: number[]): boolean {
  if (b.genre && ids?.length && !(r.genre_ids ?? []).some((g) => ids.includes(g))) return false;
  if (b.lang && r.original_language !== b.lang.code) return false;
  if (b.country && !(r.origin_country ?? []).includes(b.country.code)) return false;
  if (b.rate && (r.vote_average ?? 0) < b.rate) return false;
  const d = r.release_date || r.first_air_date || "";
  const era = eraRange(b.era);
  if (era.from && (!d || d < era.from)) return false;
  if (era.to && (!d || d > era.to)) return false;
  return true;
}
