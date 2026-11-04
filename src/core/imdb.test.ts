import { test } from "node:test";
import assert from "node:assert/strict";
import { listNameOf, mediaOfImdbType, parseImdbCsv, parseImdbFiles } from "./imdb.ts";
import { buildImport, showOfEpisodeTitle } from "./importBuild.ts";
import { impliedEpisodes } from "./progress.ts";
import { groupForResolve, type RawRecord } from "./importParse.ts";
import type { ResolveResult } from "./importer.ts";

/* ترويساتُ التصدير الجديد (صفحة Exports، ٢٠٢٤ وبعدها) — والقديمُ يكتب النوعَ «tvSeries» لا «TV Series» */
const RATINGS = [
  "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors",
  'tt0133093,9,2021-03-02,The Matrix,The Matrix,https://www.imdb.com/title/tt0133093/,Movie,8.7,136,1999,"Action, Sci-Fi",2000000,1999-03-31,"Lana Wachowski, Lilly Wachowski"',
  "tt0903747,10,2020-01-05,Breaking Bad,Breaking Bad,https://x,TV Series,9.5,49,2008,Drama,2000000,2008-01-20,",
  "tt2301451,10,2019-07-01,Breaking Bad: Ozymandias,Breaking Bad: Ozymandias,https://x,TV Episode,10,47,2013,Drama,200000,2013-09-15,Rian Johnson",
  "tt1234567,7,2022-02-02,Some Game,Some Game,https://x,Video Game,7,,2020,,100,,",
].join("\n");

const WATCHLIST = [
  "Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated",
  "1,tt0816692,2023-01-01,2023-01-01,,Interstellar,Interstellar,https://x,Movie,8.7,169,2014,Sci-Fi,1,2014-11-05,,,",
  "2,tt0944947,2023-01-01,2023-01-01,,Game of Thrones,Game of Thrones,https://x,TV Series,9.2,57,2011,Drama,1,2011-04-17,,,",
].join("\n");

const LIST = [
  "Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated",
  "2,tt0068646,2023-01-01,2023-01-01,,The Godfather,The Godfather,https://x,Movie,9.2,175,1972,Crime,1,1972-03-24,,9,2018-06-06",
  "1,tt0111161,2023-01-01,2023-01-01,,The Shawshank Redemption,The Shawshank Redemption,https://x,Movie,9.3,142,1994,Drama,1,1994-10-14,,,",
  "3,tt2301451,2023-01-01,2023-01-01,,Breaking Bad: Ozymandias,,https://x,TV Episode,10,47,2013,Drama,1,2013-09-15,,,",
].join("\n");

test("نوعُ العمل في IMDb: الجديدُ والقديمُ إلى جهةٍ واحدة، وما ليس عملاً يُترك", () => {
  assert.equal(mediaOfImdbType("TV Series"), "tv");
  assert.equal(mediaOfImdbType("tvMiniSeries"), "tv");
  assert.equal(mediaOfImdbType("TV Episode"), "episode");
  assert.equal(mediaOfImdbType("tvMovie"), "movie");
  assert.equal(mediaOfImdbType("Short"), "movie");
  assert.equal(mediaOfImdbType("Video Game"), null);
  assert.equal(mediaOfImdbType("Podcast Series"), null);
});

test("ملفُّ التقييمات: كلُّ تقييمٍ مشاهدةٌ بيومه، والتقييمُ من عشرة كما هو", () => {
  const out = parseImdbCsv("ratings.csv", RATINGS)!;
  assert.equal(out.length, 3); // اللعبةُ خارجاً
  assert.deepEqual(out[0], { kind: "imdb", imdb: "tt0133093", media: "movie", name: "The Matrix", role: "rated", rating: 9, at: "2021-03-02T00:00:00.000Z" });
  assert.equal(out[1].kind === "imdb" && out[1].media, "tv");
  assert.equal(out[2].kind === "imdb" && out[2].media, "episode");
});

test("الدورُ من الأعمدة: بلا «Position» تقييمات، وباسم watchlist قائمةُ المشاهدة، وغيرُها قائمة باسم ملفّها", () => {
  const wl = parseImdbCsv("exports/WATCHLIST.csv", WATCHLIST)!;
  assert.deepEqual(wl.map((r) => r.kind === "imdb" && r.role), ["watchlist", "watchlist"]);
  const li = parseImdbCsv("Best of all time.csv", LIST)!;
  /* الحلقةُ لا تدخل قائمة؛ وتقييمُ صاحبها داخل القائمة مشاهدةٌ أيضاً */
  assert.deepEqual(
    li.map((r) => r.kind === "imdb" && `${r.role}:${r.imdb}:${r.list ?? ""}:${r.pos ?? ""}`),
    ["list:tt0068646:Best of all time:2", "rated:tt0068646::", "list:tt0111161:Best of all time:1"],
  );
  assert.equal(listNameOf("a/b/My_List.csv"), "My List");
  assert.equal(listNameOf(".csv"), "IMDb");
});

test("ملفٌّ ليس من IMDb يُقال اسمُه ولا يُبتلع", async () => {
  const enc = (t: string) => new TextEncoder().encode(t).buffer as ArrayBuffer;
  const out = await parseImdbFiles([
    { name: "ratings.csv", buf: enc(RATINGS) },
    { name: "other.csv", buf: enc("Name,Year\nDune,2021") },
    { name: "notes.txt", buf: enc("hi") },
  ]);
  assert.deepEqual(out.parsedFiles, ["ratings.csv"]);
  assert.deepEqual(out.skippedFiles, ["other.csv", "notes.txt"]);
});

test("المطابقةُ بمعرّف IMDb وحده، بجهته", () => {
  const records = parseImdbCsv("ratings.csv", RATINGS)!;
  const { requests } = groupForResolve(records);
  assert.deepEqual(requests, [
    { kind: "imdb", id: "tt0133093", media: "movie" },
    { kind: "imdb", id: "tt0903747", media: "tv" },
    { kind: "imdb", id: "tt2301451", media: "episode" },
  ]);
});

const r = (tmdbId: number, mediaType: "tv" | "movie", extra: Partial<NonNullable<ResolveResult>> = {}): ResolveResult => ({
  tmdbId,
  mediaType,
  title: `T${tmdbId}`,
  posterPath: null,
  ...extra,
});

test("التجميع: مسلسلٌ قيّمه ⇐ «كلُّه» بيومه · حلقةٌ قيّمها ⇐ هي و«حتى هنا» · واسمُ المسلسل من عنوان الحلقة", () => {
  const records: RawRecord[] = [
    ...parseImdbCsv("ratings.csv", RATINGS)!,
    ...parseImdbCsv("WATCHLIST.csv", WATCHLIST)!,
    ...parseImdbCsv("Best of all time.csv", LIST)!,
  ];
  const answers: Record<string, ResolveResult> = {
    "imdb:movie:tt0133093": r(603, "movie"),
    "imdb:tv:tt0903747": r(1396, "tv"),
    "imdb:episode:tt2301451": r(1396, "tv", { title: "Ozymandias", season: 5, episode: 14 }),
    "imdb:movie:tt0816692": r(157336, "movie"),
    "imdb:tv:tt0944947": r(1399, "tv"),
    "imdb:movie:tt0068646": r(238, "movie"),
    "imdb:movie:tt0111161": r(278, "movie"),
  };
  const { keys } = groupForResolve(records);
  const out = buildImport(records, new Map(keys.map((k) => [k, answers[k] ?? null])));

  const bb = out.shows.find((s) => s.tmdbId === 1396)!;
  assert.equal(bb.rating, 10);
  assert.deepEqual(bb.all, { at: "2020-01-05T00:00:00.000Z" });
  assert.deepEqual(bb.episodes, [{ s: 5, e: 14, at: "2019-07-01T00:00:00.000Z" }]);
  assert.deepEqual(bb.upTo, [{ s: 5, e: 14, at: "2019-07-01T00:00:00.000Z" }]);

  const got = out.shows.find((s) => s.tmdbId === 1399)!; // قائمةُ المشاهدة: في المكتبة بلا مشاهدة
  assert.deepEqual([got.episodes, got.all, got.upTo], [[], undefined, undefined]);

  const byId = new Map(out.movies.map((m) => [m.tmdbId, m]));
  assert.equal(byId.get(603)?.watched, true);
  assert.equal(byId.get(157336)?.watched, false);
  assert.equal(byId.get(238)?.watched, true); // قيّمه داخل قائمته
  assert.equal(byId.get(238)?.at, "2018-06-06T00:00:00.000Z");
  assert.equal(byId.has(278), false); // في القائمة وحدَها — لا مكتبة

  assert.deepEqual(out.lists, [
    { name: "Best of all time", items: [
      { tmdbId: 278, mediaType: "movie", title: "T278", posterPath: null },
      { tmdbId: 238, mediaType: "movie", title: "T238", posterPath: null },
    ] },
  ]);
  assert.equal(showOfEpisodeTitle("Breaking Bad: Ozymandias"), "Breaking Bad");
});

test("ما لم يُطابَق يُذكر — والحلقةُ باسم مسلسلها", () => {
  const records = parseImdbCsv("ratings.csv", RATINGS)!;
  const out = buildImport(records, new Map());
  assert.deepEqual(out.unmatched, ["The Matrix", "Breaking Bad"]);
});

/* مسلسلٌ من موسمين (٣ + ٢ عُرضت منها ١) وخاصّتان */
const tv = {
  number_of_episodes: 5,
  seasons: [
    { season_number: 0, episode_count: 2 },
    { season_number: 1, episode_count: 3 },
    { season_number: 2, episode_count: 2 },
  ],
  last_episode_to_air: { season_number: 2, episode_number: 1, air_date: "2020-01-01" },
  next_episode_to_air: { season_number: 2, episode_number: 2, air_date: "2999-01-01" },
} as unknown as Parameters<typeof impliedEpisodes>[0];

test("الضمنيُّ: «كلُّه» = ما عُرض وحده بلا الخاصّات، وكلُّ حلقةٍ بأبكر تقييمٍ يغطّيها", () => {
  const all = impliedEpisodes(tv, { all: { at: "2021-01-01T00:00:00.000Z" } });
  assert.deepEqual(all.map((e) => `${e.s}x${e.e}`), ["1x1", "1x2", "1x3", "2x1"]);

  const out = impliedEpisodes(tv, {
    all: { at: "2021-01-01T00:00:00.000Z" },
    upTo: [
      { s: 1, e: 2, at: "2020-05-01T00:00:00.000Z" },
      { s: 2, e: 1, at: "2020-09-01T00:00:00.000Z" },
    ],
  });
  const at = new Map(out.map((e) => [`${e.s}x${e.e}`, e.at]));
  assert.equal(at.get("1x1"), "2020-05-01T00:00:00.000Z");
  assert.equal(at.get("1x2"), "2020-05-01T00:00:00.000Z");
  assert.equal(at.get("1x3"), "2020-09-01T00:00:00.000Z");
  assert.equal(at.get("2x1"), "2020-09-01T00:00:00.000Z");
});

test("الضمنيُّ: لا يتجاوز ما عُرض، والخاصّةُ وحدَها، والموسمُ المجهولُ لا شيء", () => {
  assert.deepEqual(impliedEpisodes(tv, { upTo: [{ s: 2, e: 2 }] }).map((e) => `${e.s}x${e.e}`), ["1x1", "1x2", "1x3", "2x1"]);
  assert.deepEqual(impliedEpisodes(tv, { upTo: [{ s: 0, e: 2 }] }).map((e) => `${e.s}x${e.e}`), ["0x2"]);
  assert.deepEqual(impliedEpisodes(tv, { upTo: [{ s: 9, e: 1 }] }), []);
  assert.deepEqual(impliedEpisodes(tv, {}), []);
});
