import { test } from "node:test";
import assert from "node:assert/strict";
import { airedSinceStored, staleStored, type FollowStatsRow } from "./followStats.ts";

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
