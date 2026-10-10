import { test } from "node:test";
import assert from "node:assert/strict";
import { airedSinceStored, staleStored, watchedUncounted, type FollowStatsRow } from "./followStats.ts";

const row = (o: Partial<FollowStatsRow> & { tmdb_id: number }): FollowStatsRow => ({ media_type: "tv", aired_episodes: 10, ...o });
const TODAY = "2026-10-04";
const NOW = Date.parse("2026-10-04T12:00:00Z");

test("موعدٌ فات ولم يُقرأ بعده ⇒ يُقرأ", () => {
  const rows = [row({ tmdb_id: 1, next_air_date: "2026-10-01", stats_updated_at: "2026-09-25T10:00:00Z" })];
  assert.deepEqual(airedSinceStored(rows, TODAY), [1]);
});

test("حلقةُ اليوم معروضة: موعدُ اليوم يُقرأ إن كانت آخرُ قراءةٍ قبله", () => {
  const rows = [row({ tmdb_id: 1, next_air_date: TODAY, stats_updated_at: "2026-10-03T23:00:00Z" })];
  assert.deepEqual(airedSinceStored(rows, TODAY), [1]);
});

test("قُرئ في يوم العرض نفسِه ⇒ لا يُعاد في كلِّ فتحة", () => {
  const rows = [row({ tmdb_id: 1, next_air_date: TODAY, stats_updated_at: "2026-10-04T01:00:00Z" })];
  assert.deepEqual(airedSinceStored(rows, TODAY), []);
});

test("موعدٌ قادم، وفيلم، وموقوف ⇒ لا شيء", () => {
  const rows = [
    row({ tmdb_id: 1, next_air_date: "2026-10-09", stats_updated_at: "2026-09-01T00:00:00Z" }),
    row({ tmdb_id: 2, media_type: "movie", next_air_date: "2026-09-01", stats_updated_at: "2026-08-01T00:00:00Z" }),
    row({ tmdb_id: 3, dropped: true, next_air_date: "2026-09-01", stats_updated_at: "2026-08-01T00:00:00Z" }),
  ];
  assert.deepEqual(airedSinceStored(rows, TODAY), []);
});

test("قراءةٌ مجهولة مع موعدٍ فائت ⇒ يُقرأ؛ والأحدثُ موعداً أوّلاً وبالسقف", () => {
  const rows = [
    row({ tmdb_id: 1, next_air_date: "2026-08-07", stats_updated_at: null }),
    row({ tmdb_id: 2, next_air_date: "2026-10-02", stats_updated_at: "2026-09-01T00:00:00Z" }),
    row({ tmdb_id: 3, next_air_date: "2026-09-15", stats_updated_at: "2026-09-01T00:00:00Z" }),
  ];
  assert.deepEqual(airedSinceStored(rows, TODAY), [2, 3, 1]);
  assert.deepEqual(airedSinceStored(rows, TODAY, 2), [2, 3]);
});

test("بلا موعدٍ قادم: أقدمُ من أسبوعٍ يُقرأ، والأحدثُ لا، والأقدمُ أوّلاً", () => {
  const rows = [
    row({ tmdb_id: 1, stats_updated_at: "2026-10-01T00:00:00Z" }),
    row({ tmdb_id: 2, stats_updated_at: "2026-09-20T00:00:00Z" }),
    row({ tmdb_id: 3, stats_updated_at: "2026-08-01T00:00:00Z" }),
    row({ tmdb_id: 4, stats_updated_at: null }),
  ];
  assert.deepEqual(staleStored(rows, NOW), [4, 3, 2]);
});

test("بلا رقمٍ مخزَّن صفُّ تهيئةٍ لا صفٌّ قديم؛ وذو الموعد يتبع الصنفَ الأوّل", () => {
  const rows = [
    row({ tmdb_id: 1, aired_episodes: null, stats_updated_at: null }),
    row({ tmdb_id: 2, next_air_date: "2026-09-01", stats_updated_at: "2026-08-01T00:00:00Z" }),
  ];
  assert.deepEqual(staleStored(rows, NOW), []);
});

/* D-1342 — الصنفُ الثالث: بلا رقمٍ مخزَّن وقد شوهد منه (Game of Thrones بعد الترحيب: ٧٣ مشاهَدة من «٠ معروضة») */
test("بلا رقمٍ وقد شوهد منه ⇒ يُقرأ قبل البناء", () => {
  const rows = [row({ tmdb_id: 1399, aired_episodes: null })];
  assert.deepEqual(watchedUncounted(rows, new Set([1399])), [1399]);
});

test("بلا رقمٍ وبلا مشاهدة ⇒ لا رحلةَ تسبق الرئيسيّة (يُرسم «للمشاهدة» صحيحاً)", () => {
  const rows = [row({ tmdb_id: 1396, aired_episodes: null })];
  assert.deepEqual(watchedUncounted(rows, new Set([1399])), []);
  assert.deepEqual(watchedUncounted(rows, new Set()), []);
});

test("له رقمٌ مخزَّن، أو فيلم، أو موقوف ⇒ لا شيء؛ وبالسقف", () => {
  const seen = new Set([1, 2, 3, 4, 5]);
  const rows = [
    row({ tmdb_id: 1 }),
    row({ tmdb_id: 2, aired_episodes: null, media_type: "movie" }),
    row({ tmdb_id: 3, aired_episodes: null, dropped: true }),
    row({ tmdb_id: 4, aired_episodes: null }),
    row({ tmdb_id: 5, aired_episodes: null }),
  ];
  assert.deepEqual(watchedUncounted(rows, seen), [4, 5]);
  assert.deepEqual(watchedUncounted(rows, seen, 1), [4]);
});
