import { test } from "node:test";
import assert from "node:assert/strict";
import { isRecentRelease, keepKnown, ratingLine } from "./cinemaImdb.ts";

/* T522 — تقييمُ IMDb للسينما بجهدٍ أكبر */

test("a film from last month is recent; one from last year is not; no date counts as recent", () => {
  const now = Date.parse("2026-11-22T00:00:00Z");
  assert.equal(isRecentRelease("2026-10-30", now), true);
  assert.equal(isRecentRelease("2025-11-01", now), false);
  assert.equal(isRecentRelease(null, now), true);
});

test("reads only the wanted titles from the IMDb ratings file", () => {
  const wanted = new Set(["tt34384661"]);
  assert.deepEqual(ratingLine("tt34384661\t7.9\t28735", wanted), { tconst: "tt34384661", rating: 7.9, votes: 28735 });
  assert.equal(ratingLine("tt0111161\t9.3\t3000000", wanted), null);
  assert.equal(ratingLine("tt34384661\t\\N\t12", wanted), null);
  assert.equal(ratingLine("broken", wanted), null);
});

test("a late «no rating» from OMDb never erases a known IMDb rating", () => {
  assert.equal(keepKnown(null, 7.9), 7.9);
  assert.equal(keepKnown(8.1, 7.9), 8.1);
  assert.equal(keepKnown(null, null), null);
});
