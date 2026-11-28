import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrimeRecords, detailPath, isPrimeStarted, isPrimeWatched, parsePrimeDetail, parsePrimeHistory, primePagesToRead, type PrimeDetail } from "./prime.ts";

/* الأشكالُ كما قيست في حساب أحمد ٢٨ نوفمبر (الفحص S0) — الأسماءُ والأرقامُ كما هي، بلا رموز */
const SHOW = "/detail/0TZZ7TEHTSS2FK80BV6PL4CPAZ";
const FILM = "/detail/0HUGOG2FTAU3FKOCMO2E4X30V9";
const history = [
  {
    date: "28 نوفمبر، 2026",
    titles: [
      { gti: "g-film", titleType: "movie", title: { text: "Ayra Starr: Dare to Dream", href: `${FILM}?ref_=atv_set_wh_dp` }, time: 1795844823030, children: [] },
      {
        gti: "g-s1",
        titleType: "season",
        title: { text: "كل شيء أو لا شيء: \"توتنهام هوتسبير\" - الموسم الأول", href: `${SHOW}?ref_=atv_set_wh_dp` },
        time: 1795844732986,
        children: [
          { gti: "g-e2", titleType: "episode", title: { text: "الحلقة 2: بداية جديدة" }, time: 1795844732986 },
          { gti: "g-e1", titleType: "episode", title: { text: "الحلقة 1: توقيع عقد جديد" }, time: 1795844685134 },
        ],
      },
      { gti: "x", titleType: "live", title: { text: "مباراة", href: "/detail/ZZ" }, time: 1 },
    ],
  },
];
const showPage = {
  pageTitleId: "g-s1",
  detail: {
    "g-s1": { titleType: "season", title: "كل شيء أو لا شيء: \"توتنهام هوتسبير\" - الموسم الأول", parentTitle: "كل شيء أو لا شيء: \"توتنهام هوتسبير\"", seasonNumber: 1, releaseYear: 2020 },
    "g-e1": { titleType: "episode", title: "توقيع عقد جديد", episodeNumber: 1, duration: 2815, releaseYear: 2020 },
    "g-e2": { titleType: "episode", title: "بداية جديدة", episodeNumber: 2, duration: 2774, releaseYear: 2020 },
  },
  playback: {
    "g-e1": { playbackStatus: "FeatureFinished", progress: 1, resumeTime: 0 },
    "g-e2": { playbackStatus: "FeatureInProgress", progress: 0.0126, resumeTime: 35 },
  },
};
const filmPage = {
  pageTitleId: "g-film",
  detail: { "g-film": { titleType: "movie", title: "Ayra Starr: Dare to Dream", releaseYear: 2024, duration: 1375 } },
  playback: { "g-film": { playbackStatus: "FeatureFinished", progress: 1, resumeTime: 0 } },
};

test("detailPath keeps Prime detail pages only", () => {
  assert.equal(detailPath(`${SHOW}?ref_=x`), SHOW);
  assert.equal(detailPath("https://www.primevideo.com/-/en/detail/ABC123/ref=x"), "/-/en/detail/ABC123");
  assert.equal(detailPath("https://evil.example/detail/ABC"), null);
  assert.equal(detailPath(7), null);
});

test("parsePrimeHistory reads seasons with episodes and movies, skips other types", () => {
  const items = parsePrimeHistory(history);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { gti: "g-film", kind: "movie", title: "Ayra Starr: Dare to Dream", path: FILM, at: 1795844823030, episodes: [] });
  assert.equal(items[1].kind, "season");
  assert.equal(items[1].path, SHOW);
  assert.deepEqual(items[1].episodes.map((e) => e.gti), ["g-e2", "g-e1"]);
  assert.deepEqual(parsePrimeHistory(null), []);
});

test("parsePrimeDetail and the watched rule", () => {
  const d = parsePrimeDetail(showPage) as PrimeDetail;
  assert.equal(d.pageId, "g-s1");
  assert.equal(d.titles.get("g-s1")?.parent, "كل شيء أو لا شيء: \"توتنهام هوتسبير\"");
  assert.equal(d.titles.get("g-e2")?.episode, 2);
  assert.equal(isPrimeWatched(d.playback.get("g-e1")), true);
  assert.equal(isPrimeWatched(d.playback.get("g-e2")), false);
  /* ٣٥ ثانية — تشغيلٌ تلقائيٌّ للحلقة التالية، لا «بدأته» */
  assert.equal(isPrimeStarted(d.playback.get("g-e2"), 2774), false);
  assert.equal(isPrimeStarted({ status: "progress", progress: 0.4, resumeSec: 1100 }, 2774), true);
  assert.equal(isPrimeWatched({ status: "progress", progress: 0.93, resumeSec: 2600 }), true);
  assert.equal(parsePrimeDetail({}), null);
});

test("buildPrimeRecords: finished episode and film enter, the rest does not", () => {
  const items = parsePrimeHistory(history);
  const pages = new Map([
    [SHOW, parsePrimeDetail(showPage) as PrimeDetail],
    [FILM, parsePrimeDetail(filmPage) as PrimeDetail],
  ]);
  const b = buildPrimeRecords(items, pages);
  assert.deepEqual(b.records, [
    { kind: "movie-name", name: "Ayra Starr: Dare to Dream", at: new Date(1795844823030).toISOString(), year: 2024 },
    { kind: "ep-name", show: "كل شيء أو لا شيء: \"توتنهام هوتسبير\"", s: 1, e: 1, at: new Date(1795844685134).toISOString(), year: 2020 },
  ]);
  assert.deepEqual(b.recorded, ["g-film", "g-e1"]);
  assert.equal(b.partial.length, 0);
  assert.equal(b.skipped, 1);
  assert.equal(b.newest, 1795844823030);
  /* بعد آخر مزامنة: ما قبله لا يُقرأ */
  assert.equal(buildPrimeRecords(items, pages, { after: 1795844823030 }).records.length, 0);
  assert.deepEqual(primePagesToRead(items, 1795844732986), [FILM]);
  assert.deepEqual(primePagesToRead(items, null), [FILM, SHOW]);
});

test("buildPrimeRecords: later seasons send no year (the season's year is not the show's)", () => {
  const page = parsePrimeDetail({
    pageTitleId: "s3",
    detail: { s3: { titleType: "season", title: "X - الموسم 3", parentTitle: "X", seasonNumber: 3, releaseYear: 2024 }, e5: { titleType: "episode", title: "e", episodeNumber: 5, duration: 3000 } },
    playback: { e5: { playbackStatus: "FeatureFinished", progress: 1 } },
  }) as PrimeDetail;
  const b = buildPrimeRecords([{ gti: "s3", kind: "season", title: "X - الموسم 3", path: "/detail/S3", at: 10, episodes: [{ gti: "e5", at: 10 }] }], new Map([["/detail/S3", page]]));
  assert.deepEqual(b.records, [{ kind: "ep-name", show: "X", s: 3, e: 5, at: new Date(10).toISOString() }]);
});
