import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOsnRecords, chunks, isWatched, parseBookmarks, parseMovies, parseSeasonEpisodes, parseSeries, seriesToRead } from "./osn.ts";

/* عيّناتٌ بشكل ردود OSN+ كما قيست في ٢٦ نوفمبر (`claude/STUDY-OSN-S0-2026-11-26.md`) — بلا معرّف ملفٍّ شخصيّ */
const LATEST = {
  bookmarks: [
    { content: { episode: { contentId: "9018", seasonContentId: "1583", seriesContentId: "1581" } }, clientTimestampMs: "1665979290832", timeInMediaMs: 3239535, contentDurationMs: 3329000, finishedViewing: false, isHiddenFromContinueWatching: false },
    { content: { movie: { contentId: "23251" } }, clientTimestampMs: "1795648144338", timeInMediaMs: 66000, contentDurationMs: 8937000, finishedViewing: false, isHiddenFromContinueWatching: false },
    { content: { trailer: { contentId: "1" } }, clientTimestampMs: "1", timeInMediaMs: 1, contentDurationMs: 1 },
  ],
};
const SEASON_BOOKMARKS = {
  bookmarks: [
    { content: { episode: { contentId: "12198", seasonContentId: "1583", seriesContentId: "1581" } }, clientTimestampMs: "1665000000000", timeInMediaMs: 3591000, contentDurationMs: 3591000, finishedViewing: true },
    { content: { episode: { contentId: "9018", seasonContentId: "1583", seriesContentId: "1581" } }, clientTimestampMs: "1665979290832", timeInMediaMs: 3239535, contentDurationMs: 3329000, finishedViewing: false },
    { content: { episode: { contentId: "3905", seasonContentId: "1583", seriesContentId: "1581" } }, clientTimestampMs: "1664000000000", timeInMediaMs: 2000, contentDurationMs: 3098000, finishedViewing: false },
  ],
};
const SERIES = {
  series: {
    "1581": {
      contentId: "1581",
      title: { ar: "آل التنين", en: "House Of The Dragon" },
      year: "2026",
      seasons: [
        { contentId: "1583", seasonNumber: 1, year: "2022" },
        { contentId: "2000", seasonNumber: 2, year: "2024" },
      ],
    },
  },
};
const EPISODES = {
  episodesBySeason: {
    "1583": {
      episodes: [
        { contentId: "12198", episodeNumber: 8, seasonContentId: "1583", seriesContentId: "1581", title: { ar: "سيّد الأمواج", en: "The Lord of the Tides" } },
        { contentId: "9018", episodeNumber: 9, seasonContentId: "1583", seriesContentId: "1581", title: { ar: "المجلس الأخضر", en: "The Green Council" } },
        { contentId: "3905", episodeNumber: 2, seasonContentId: "1583", seriesContentId: "1581", title: { ar: "الأمير الشرير", en: "The Rogue Prince" } },
      ],
    },
  },
};
const MOVIES = { movies: { "23251": { contentId: "23251", title: { ar: "غون غيرل", en: "Gone Girl" }, year: "2014", runTimeMs: 8937000 } } };

test("parseBookmarks: الحلقةُ والفيلمُ، والنوعُ الآخر يُسقط", () => {
  const b = parseBookmarks(LATEST);
  assert.equal(b.length, 2);
  assert.deepEqual(b[0], { kind: "episode", id: "9018", seasonId: "1583", seriesId: "1581", at: 1665979290832, positionSec: 3239.535, runtimeSec: 3329, done: false });
  assert.equal(b[1].kind, "movie");
  assert.equal(b[1].id, "23251");
  assert.deepEqual(parseBookmarks(null), []);
});

test("parseSeries: الاسمُ الإنجليزيّ، وسنةُ أوّل موسم لا آخرِه", () => {
  const s = parseSeries(SERIES).get("1581");
  assert.equal(s?.title, "House Of The Dragon");
  assert.equal(s?.year, 2022);
  assert.equal(s?.seasons.get("1583"), 1);
  assert.equal(s?.seasons.get("2000"), 2);
});

test("parseSeasonEpisodes و parseMovies", () => {
  const e = parseSeasonEpisodes(EPISODES);
  assert.equal(e.get("9018")?.number, 9);
  assert.equal(e.get("9018")?.title, "The Green Council");
  const m = parseMovies(MOVIES).get("23251");
  assert.deepEqual(m, { id: "23251", title: "Gone Girl", year: 2014 });
});

test("isWatched: علامةُ «اكتملت» أو ٩٠٪", () => {
  assert.equal(isWatched({ positionSec: 10, runtimeSec: 100, done: true }), true);
  assert.equal(isWatched({ positionSec: 90, runtimeSec: 100, done: false }), true);
  assert.equal(isWatched({ positionSec: 89, runtimeSec: 100, done: false }), false);
  assert.equal(isWatched({ positionSec: 50, runtimeSec: null, done: false }), false);
});

test("buildOsnRecords: المكتملةُ تدخل بحلقتها واسمها، وما دون ٩٠٪ «بدأته»", () => {
  const eps = parseBookmarks(SEASON_BOOKMARKS);
  const mv = parseBookmarks(LATEST).filter((b) => b.kind === "movie");
  const out = buildOsnRecords([...eps, ...mv], parseSeries(SERIES), parseSeasonEpisodes(EPISODES), parseMovies(MOVIES));
  assert.equal(out.records.length, 2, "الثامنةُ (اكتملت) والتاسعةُ (٩٧٪)");
  assert.deepEqual(out.records[0], { kind: "ep-name", show: "House Of The Dragon", s: 1, e: 8, at: new Date(1665000000000).toISOString(), year: 2022, nfx: { show: "osn-1581", title: "The Lord of the Tides" } });
  assert.equal(out.partial.length, 2, "الثانيةُ (ثانيتان) والفيلمُ (٦٦ ثانية)");
  assert.equal(out.partial.find((p) => p.show === null)?.title, "Gone Girl");
  assert.equal(out.newest, 1795648144338);
});

test("buildOsnRecords: ما قبل الحدّ لا يُقرأ، وما لا يُفهم يُعدّ", () => {
  const eps = parseBookmarks(SEASON_BOOKMARKS);
  const out = buildOsnRecords(eps, parseSeries(SERIES), parseSeasonEpisodes(EPISODES), new Map(), { after: 1665500000000 });
  assert.equal(out.records.length, 1);
  assert.equal(out.partial.length, 0);
  const lost = buildOsnRecords(eps, new Map(), new Map(), new Map());
  assert.equal(lost.skipped, 3);
});

test("seriesToRead و chunks", () => {
  const latest = parseBookmarks(LATEST);
  assert.deepEqual(seriesToRead(latest, null), ["1581"]);
  assert.deepEqual(seriesToRead(latest, 1700000000000), []);
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
