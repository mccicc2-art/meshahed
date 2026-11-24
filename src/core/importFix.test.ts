import { test } from "node:test";
import assert from "node:assert/strict";
import { fixPairsFrom, importWindowEnd, planImportFixes, type FixContext } from "./importFix.ts";

const run = "2026-11-22T18:33:00.000Z";
const inWindow = "2026-11-22T18:10:00.000Z";
const before = "2026-10-01T10:00:00.000Z";

const ctx = (over: Partial<FixContext> = {}): FixContext => ({
  runs: [run],
  wrongFollows: new Map([
    [1, { addedAt: inWindow, title: "Harmony and Me" }],
    [2, { addedAt: before, title: "Added by hand" }],
  ]),
  touched: new Set(),
  wrongRatings: new Map(),
  rightRated: new Set(),
  ...over,
});

test("import window: three hours before the run to ten minutes after", () => {
  assert.notEqual(importWindowEnd(inWindow, [run]), null);
  assert.equal(importWindowEnd(before, [run]), null);
  assert.equal(importWindowEnd("2026-11-22T18:50:00.000Z", [run]), null);
  assert.equal(importWindowEnd("bad", [run]), null);
});

test("T537: a title added inside an import window is offered; one added by hand on another day is not", () => {
  const out = planImportFixes(
    [
      { wrongId: 1, rightId: 10, rightTitle: "Harmony", rightPoster: null },
      { wrongId: 2, rightId: 20, rightTitle: "Other", rightPoster: null },
      { wrongId: 3, rightId: 30, rightTitle: "Not in library", rightPoster: null },
    ],
    ctx(),
  );
  assert.deepEqual(out.map((x) => [x.wrongId, x.wrongTitle]), [[1, "Harmony and Me"]]);
});

test("anything touched after the import, or a rating clash, is left alone", () => {
  const pair = [{ wrongId: 1, rightId: 10, rightTitle: "Harmony", rightPoster: null }];
  assert.equal(planImportFixes(pair, ctx({ touched: new Set([1]) })).length, 0);
  assert.equal(planImportFixes(pair, ctx({ wrongRatings: new Map([[1, { updatedAt: "2026-11-23T10:00:00.000Z" }]]) })).length, 0);
  assert.equal(planImportFixes(pair, ctx({ wrongRatings: new Map([[1, { updatedAt: "2010-01-01T00:00:00.000Z" }]]), rightRated: new Set([10]) })).length, 0);
  assert.equal(planImportFixes(pair, ctx({ wrongRatings: new Map([[1, { updatedAt: "2010-01-01T00:00:00.000Z" }]]) })).length, 1);
});

test("same id, duplicates and bad ids are dropped", () => {
  const out = planImportFixes(
    [
      { wrongId: 1, rightId: 1, rightTitle: "x", rightPoster: null },
      { wrongId: 1, rightId: 10, rightTitle: "x", rightPoster: null },
      { wrongId: 1, rightId: 11, rightTitle: "y", rightPoster: null },
      { wrongId: -1, rightId: 10, rightTitle: "x", rightPoster: null },
    ],
    ctx(),
  );
  assert.deepEqual(out.map((x) => x.rightId), [10]);
});

test("pairs from resolve: movies only, and a title another row wants is not a mistake", () => {
  const out = fixPairsFrom([
    { tmdbId: 10, mediaType: "movie", title: "Harmony", posterPath: "/h.jpg", was: { tmdbId: 1 } },
    { tmdbId: 1, mediaType: "movie", title: "Harmony and Me", posterPath: null },
    { tmdbId: 20, mediaType: "movie", title: "Ida", posterPath: null, was: { tmdbId: 2 } },
    { tmdbId: 30, mediaType: "tv", title: "Show", posterPath: null, was: { tmdbId: 3 } },
    null,
  ]);
  assert.deepEqual(out, [{ wrongId: 2, rightId: 20, rightTitle: "Ida", rightPoster: null }]);
});
