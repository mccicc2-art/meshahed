import { test } from "node:test";
import assert from "node:assert/strict";
import { EXCERPT_MAX, reviewExcerpt, reviewsView, splitReviews } from "./profileReviews.ts";

test("written reviews and star-only ratings split in their given order", () => {
  const rows = [
    { id: 1, rating: 8, review: "فيلم جميل" },
    { id: 2, rating: 8, review: null },
    { id: 3, rating: 10, review: "   " },
    { id: 4, rating: null, review: "رأي بلا نجمة" },
    { id: 5, rating: null, review: null },
  ];
  const { written, ratings } = splitReviews(rows);
  assert.deepEqual(written.map((r) => r.id), [1, 4]);
  assert.deepEqual(ratings.map((r) => r.id), [2, 3]);
});

test("the tab opens on written reviews, or on ratings when there is none written", () => {
  assert.equal(reviewsView(undefined, 5), "written");
  assert.equal(reviewsView(undefined, 0), "ratings");
  assert.equal(reviewsView("ratings", 5), "ratings");
  assert.equal(reviewsView("written", 0), "written");
  assert.equal(reviewsView("junk", 2), "written");
});

test("the activity excerpt folds whitespace and cuts on whole characters", () => {
  assert.equal(reviewExcerpt("  سطر\n\nثانٍ  "), "سطر ثانٍ");
  assert.equal(reviewExcerpt("   "), null);
  assert.equal(reviewExcerpt(null), null);
  const long = "😀".repeat(EXCERPT_MAX + 5);
  const cut = reviewExcerpt(long) ?? "";
  assert.equal(Array.from(cut).length, EXCERPT_MAX + 1);
  assert.ok(cut.endsWith("…"));
});
