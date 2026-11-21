import { test } from "node:test";
import assert from "node:assert/strict";
import { autoRecords, detectKnown, guessRoles, needsMedia, parseDate, tablesOf, treeFallback, type AutoEntry } from "./importAuto.ts";
import { groupForResolve, type RawRecord } from "./importParse.ts";
import { buildImport } from "./importBuild.ts";

const csv = (name: string, text: string): AutoEntry => ({ name, text });

test("known exports go to their own reader", () => {
  assert.equal(detectKnown([csv("ratings.csv", "Const,Your Rating,Date Rated,Title,URL,Title Type\ntt1,8,2024-01-01,X,u,Movie")]), "imdb");
  assert.equal(detectKnown([csv("diary.csv", "Date,Name,Year,Letterboxd URI,Rating\n")]), "letterboxd");
  assert.equal(detectKnown([csv("x.xml", "<?xml version='1.0'?><myanimelist><anime/></myanimelist>")]), "mal");
  assert.equal(detectKnown([csv("seen_episode.csv", "a,b\n1,2")]), "tvtime");
  assert.equal(detectKnown([csv("simkl.json", '{"simkl": 1, "shows": []}')]), "simkl");
  /* شجرةٌ بمعرّفات TMDB بلا جدولٍ مسطَّح ⇐ قارئُ المتتبّعات احتياطاً، لا قبل الجداول */
  const tree = csv("backup.json", '{"shows":[{"show":{"title":"A","ids":{"tmdb":1399}},"seasons":[{"number":1,"episodes":[{"number":1}]}]}]}');
  assert.equal(detectKnown([tree]), null);
  assert.equal(treeFallback([tree]), "simkl");
  assert.equal(detectKnown([csv("mine.csv", "Title,Year,Watched\nDune,2021,yes")]), null);
});

test("columns are read from their names and their values, in Arabic and English", () => {
  const h = ["Movie Title", "Release Year", "IMDb ID", "My Rating", "IMDb Rating", "Date Watched"];
  const rows = [["Dune", "2021", "tt1160419", "4.5", "8.0", "2024-01-05"], ["Up", "2009", "tt1049413", "5", "8.3", "2023-03-02"]];
  assert.deepEqual(guessRoles(h, rows), ["title", "year", "imdb", "rating", "skip", "date"]);
  const ar = ["اسم المسلسل", "الموسم", "الحلقة", "تاريخ المشاهدة"];
  assert.deepEqual(guessRoles(ar, [["الحشاشين", "1", "3", "21/11/2025"]]), ["show", "season", "episode", "date"]);
  assert.deepEqual(guessRoles(["Series", "Ep"], [["Fargo", "S02E06"], ["Fargo", "S02E07"]]), ["show", "epcode"]);
});

test("a movie list from an unknown app becomes watched movies with a 1–10 rating", () => {
  const { tables } = tablesOf([csv("export.csv", "Movie Title;Release Year;IMDb ID;My Rating;Date Watched\nDune;2021;tt1160419;4.5;05/01/2024\nUp;2009;;5;13/02/2023")]);
  assert.equal(tables.length, 1);
  assert.equal(needsMedia(tables[0]), true);
  const recs = autoRecords(tables, { media: "movie", status: "watched" });
  assert.equal(recs.length, 2);
  const [a, b] = recs as Extract<(typeof recs)[number], { kind: "auto" }>[];
  assert.equal(a.imdb, "tt1160419");
  assert.equal(a.rating, 9);
  assert.equal(a.at?.slice(0, 10), "2024-01-05");
  assert.equal(b.media, "movie");
  assert.equal(b.year, 2009);
  assert.equal(b.at?.slice(0, 10), "2023-02-13");
  /* بمعرّف IMDb يُطلب «any»، وبالاسم يُطلب فيلماً */
  const g = groupForResolve(recs);
  assert.deepEqual(g.requests, [{ kind: "imdb", id: "tt1160419", media: "any" }, { kind: "name-movie", name: "Up", year: 2009 }]);
});

test("episode rows build a show with its episodes; show rows carry their state", () => {
  const { tables } = tablesOf([
    csv("history.csv", "show,season,episode,watched_at\nFargo,2,6,2024-02-01T20:00:00Z\nFargo,2,7,2024-02-02T20:00:00Z"),
    csv("library.json", JSON.stringify({ items: [{ title: "Lost", type: "series", status: "Dropped", ids: { tmdb: 4607 } }, { title: "Dark", type: "tv", status: "Completed", score: 90, ids: { tmdb: 70523 } }] })),
  ]);
  assert.equal(tables.length, 2);
  const recs = autoRecords(tables, { media: "movie", status: "watched" });
  const resolved = new Map([["tv:fargo:", { tmdbId: 60622, mediaType: "tv" as const, title: "Fargo", posterPath: null }]]);
  const built = buildImport(recs, resolved);
  const fargo = built.shows.find((s) => s.tmdbId === 60622)!;
  assert.deepEqual(fargo.episodes.map((e) => `${e.s}x${e.e}`), ["2x6", "2x7"]);
  assert.equal(built.shows.find((s) => s.tmdbId === 4607)?.state, "dropped");
  const dark = built.shows.find((s) => s.tmdbId === 70523)!;
  assert.ok(dark.all);
  assert.equal(dark.rating, 9);
  assert.equal(built.movies.length, 0);
});

test("plan-to-watch rows enter the library without a watch", () => {
  const { tables } = tablesOf([csv("w.csv", "Title,Year,Status\nArrival,2016,Plan to Watch")]);
  const recs = autoRecords(tables, { media: "movie", status: "watched" });
  const built = buildImport(recs, new Map([["mv:arrival:2016", { tmdbId: 329865, mediaType: "movie" as const, title: "Arrival", posterPath: null }]]));
  assert.deepEqual(built.movies.map((m) => m.watched), [false]);
});

test("a file with nothing that names a work is skipped by name", () => {
  const r = tablesOf([csv("stats.csv", "minutes,count\n30,2")]);
  assert.equal(r.tables.length, 0);
  assert.deepEqual(r.skipped, ["stats.csv"]);
});

test("dates in every common shape", () => {
  assert.equal(parseDate("1700000000")?.slice(0, 10), "2023-11-14");
  assert.equal(parseDate("2024-03-05")?.slice(0, 10), "2024-03-05");
  assert.equal(parseDate("03/05/2024", "mdy")?.slice(0, 10), "2024-03-05");
  assert.equal(parseDate("03/05/2024", "dmy")?.slice(0, 10), "2024-05-03");
  assert.equal(parseDate("not a date"), null);
  assert.equal(parseDate("1800-01-01"), null);
});

test("Netflix viewing activity: episode titles split, trailers dropped", () => {
  const text = [
    "Profile Name,Start Time,Duration,Attributes,Title,Supplemental Video Type,Device Type",
    "Ahmed,2024-03-01 20:00:00,00:50:00,,The Crown: Season 1: Wolferton Splash (Episode 1),,TV",
    "Ahmed,2024-03-02 20:00:00,00:45:00,,Dark: Season 2: Lost and Found,,TV",
    "Ahmed,2024-03-03 20:00:00,00:01:00,,The Crown: Season 2 (Trailer),TRAILER,TV",
    "Ahmed,2024-03-04 20:00:00,02:00:00,,Glass Onion: A Knives Out Mystery,,TV",
  ].join("\n");
  const { tables } = tablesOf([{ name: "ViewingActivity.csv", text }]);
  assert.equal(tables[0].roles[tables[0].headers.indexOf("Title")], "title");
  const recs = autoRecords(tables, { media: "movie", status: "watched" }) as Extract<RawRecord, { kind: "auto" }>[];
  assert.equal(recs.length, 3);
  assert.deepEqual([recs[0].name, recs[0].media, recs[0].s, recs[0].e, recs[0].status], ["The Crown", "tv", 1, 1, "watched"]);
  assert.deepEqual([recs[1].name, recs[1].s, recs[1].e, recs[1].status], ["Dark", undefined, undefined, "watching"]);
  assert.deepEqual([recs[2].name, recs[2].media], ["Glass Onion: A Knives Out Mystery", "movie"]);
});

test("12-hour clock times keep their afternoon", () => {
  assert.equal(parseDate("11/20/2024 9:30 PM", "mdy"), "2024-11-20T21:30:00.000Z");
  assert.equal(parseDate("11/20/2024 12:05 AM", "mdy"), "2024-11-20T00:05:00.000Z");
  assert.equal(parseDate("20/11/2024 18:45", "dmy"), "2024-11-20T18:45:00.000Z");
});
