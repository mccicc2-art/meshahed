import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildShahidRecords,
  cwSnapshot,
  isNoise,
  isWatched,
  parsePlaylist,
  parseProgram,
  parseProgress,
  parseSeasonPlaylists,
  parseWatchingItems,
  programsToRead,
  type ShahidEpisode,
  type ShahidProgram,
} from "./shahid.ts";

/**
 * ====== المهمّة ٥٦٧ — مزامنةُ شاهد: الأشكالُ كما قيست في الفحص S0 (٢٦ نوفمبر) ======
 */

const CW = {
  responseCode: 200,
  success: true,
  currentDate: "2026-11-26T05:23:57.014+00:00",
  watchingItems: [
    { programId: "49924110023930", contentId: "49924110000492", contentType: "EPISODE", seasonNumber: "1", episodeNumber: "2", progressSeconds: 0, streamInfo: {} },
    { programId: "1026476", contentId: "1026476", contentType: "MOVIE", progressSeconds: 900 },
    { programId: "x", contentId: "y", contentType: "LIVESTREAM" },
  ],
};

test("«تابع المشاهدة»: الحلقةُ والفيلم، وما سواهما يسقط", () => {
  const items = parseWatchingItems(CW);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { programId: "49924110023930", contentId: "49924110000492", kind: "episode", season: 1, episode: 2, progressSec: 0 });
  assert.equal(items[1].kind, "movie");
});

test("اللقطة: الجديدُ والمتغيّرُ والخارجُ تُقرأ، وكلُّها أوّلَ مرّة", () => {
  const items = parseWatchingItems(CW);
  assert.deepEqual(programsToRead(items, null).sort(), ["1026476", "49924110023930"]);
  const prev = cwSnapshot(items);
  assert.deepEqual(programsToRead(items, prev), []);
  assert.deepEqual(programsToRead(items, { ...prev, "1026476": "1026476:100" }), ["1026476"]);
  assert.deepEqual(programsToRead(items, prev, ["777"]), ["777"]);
  /* خرج من «تابع المشاهدة» (اكتمل) ⇐ يُقرأ */
  assert.deepEqual(programsToRead(items.slice(0, 1), prev), ["1026476"]);
});

test("التقدّم: بخطئهم الإملائيّ، والمحذوفُ يسقط", () => {
  const { rows, more } = parseProgress({
    count: 2,
    hasMore: false,
    progrersses: [
      { profileId: "p", assetId: 49924110000465, type: "EPISODE", timeWatched: 2693, duration: 2693, completed: true, updated: "2026-11-26T05:23:04+0000", deleted: false },
      { profileId: "p", assetId: 1, type: "EPISODE", timeWatched: 10, duration: 100, completed: false, updated: "2026-11-26T05:00:00+0000", deleted: true },
    ],
  });
  assert.equal(more, false);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].assetId, "49924110000465");
  assert.equal(rows[0].done, true);
  assert.equal(rows[0].at, Date.parse("2026-11-26T05:23:04Z"));
});

test("العمل: المسلسلُ بمواسمه وسنته، والفيلمُ بمدّته", () => {
  const show = parseProgram({ productModel: { id: 49924110023930, productType: "SHOW", title: "عنبر الموت", productionDate: "2026-01-01T00:00:00+0000", seasons: [{ id: 49924109929539, seasonNumber: "1" }] } });
  assert.deepEqual(show, { id: "49924110023930", kind: "show", title: "عنبر الموت", year: 2026, seasons: [{ id: "49924109929539", number: 1 }], runtimeSec: null });
  const one = parseProgram({ productModel: { id: 5, productType: "SHOW", title: "س", season: { id: 6, seasonNumber: "1" } } });
  assert.deepEqual(one?.seasons, [{ id: "6", number: 1 }]);
  const movie = parseProgram({ productModel: { id: 1026476, productType: "MOVIE", title: "الجريمة", productionDate: "2022-01-01T00:00:00+0000", duration: 7286 } });
  assert.equal(movie?.kind, "movie");
  assert.equal(movie?.year, 2022);
  assert.equal(movie?.runtimeSec, 7286);
  assert.equal(parseProgram({ productModel: { id: 1, productType: "LIVESTREAM" } }), null);
});

test("الموسم: قوائمُ الحلقات وحدها، والقائمةُ بأرقامها", () => {
  assert.deepEqual(parseSeasonPlaylists({ productModel: { playlists: [{ id: "a", type: "CLIP" }, { id: "b", type: "EPISODE" }, { id: "c", type: "EPISODE" }] } }), ["b", "c"]);
  const { episodes, more } = parsePlaylist({ productList: { hasMore: true, products: [{ id: 11, number: 1, duration: 2693 }, { id: 12, number: 2, duration: 0 }, { id: 13 }] } }, "P", 1);
  assert.equal(more, true);
  assert.deepEqual(episodes, [
    { assetId: "11", programId: "P", season: 1, number: 1, runtimeSec: 2693 },
    { assetId: "12", programId: "P", season: 1, number: 2, runtimeSec: null },
  ]);
});

test("شوهدت · ضجيج", () => {
  assert.equal(isWatched({ watchedSec: 10, runtimeSec: 100, done: true }), true);
  assert.equal(isWatched({ watchedSec: 91, runtimeSec: 100, done: false }), true);
  assert.equal(isWatched({ watchedSec: 89, runtimeSec: 100, done: false }), false);
  assert.equal(isNoise({ watchedSec: 0, runtimeSec: 2360, done: false }), true);
  assert.equal(isNoise({ watchedSec: 120, runtimeSec: 2360, done: false }), false);
  assert.equal(isNoise({ watchedSec: 120, runtimeSec: null, done: false }), true);
});

test("الصفوف: حلقةٌ مكتملة · ناقصة · فيلم · ما قبل الحدّ · إعادةُ الفحص", () => {
  const programs = new Map<string, ShahidProgram>([
    ["S", { id: "S", kind: "show", title: "عنبر الموت", year: 2026, seasons: [{ id: "s1", number: 1 }], runtimeSec: null }],
    ["M", { id: "M", kind: "movie", title: "الجريمة", year: 2022, seasons: [], runtimeSec: 7286 }],
  ]);
  const episodes = new Map<string, ShahidEpisode>([
    ["e1", { assetId: "e1", programId: "S", season: 1, number: 1, runtimeSec: 2693 }],
    ["e2", { assetId: "e2", programId: "S", season: 1, number: 2, runtimeSec: 2360 }],
    ["e3", { assetId: "e3", programId: "S", season: 1, number: 3, runtimeSec: 2400 }],
  ]);
  const movieOf = new Map([["M", "M"]]);
  const t = (iso: string) => Date.parse(iso);
  const progress = [
    { assetId: "e1", watchedSec: 2693, runtimeSec: 2693, done: true, at: t("2026-11-26T05:23:04Z") },
    { assetId: "e2", watchedSec: 600, runtimeSec: 2360, done: false, at: t("2026-11-26T06:00:00Z") },
    { assetId: "e3", watchedSec: 2400, runtimeSec: null, done: false, at: t("2026-11-20T00:00:00Z") },
    { assetId: "M", watchedSec: 7000, runtimeSec: null, done: false, at: t("2026-11-26T07:00:00Z") },
  ];
  const all = buildShahidRecords(progress, programs, episodes, movieOf);
  assert.deepEqual(all.records, [
    { kind: "ep-name", show: "عنبر الموت", s: 1, e: 1, at: "2026-11-26T05:23:04.000Z", year: 2026 },
    { kind: "ep-name", show: "عنبر الموت", s: 1, e: 3, at: "2026-11-20T00:00:00.000Z", year: 2026 },
    { kind: "movie-name", name: "الجريمة", at: "2026-11-26T07:00:00.000Z", year: 2022 },
  ]);
  assert.equal(all.partial.length, 1);
  assert.equal(all.partial[0].programId, "S");
  assert.equal(all.newest, t("2026-11-26T07:00:00Z"));
  assert.deepEqual(all.recorded, ["e1", "e3", "M"]);

  const later = buildShahidRecords(progress, programs, episodes, movieOf, { after: t("2026-11-26T06:30:00Z"), recheck: new Set(["e3"]) });
  assert.deepEqual(later.records.map((r) => (r.kind === "ep-name" ? `e${r.e}` : "M")), ["e3", "M"]);
});
