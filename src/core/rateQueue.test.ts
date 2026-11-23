import { test } from "node:test";
import assert from "node:assert/strict";
import { pickToRate, rateCardShown, rateWeekOf, sanitizeRateSkip, addRateSkip, sanitizeRateCard, RATE_SKIP_CAP, type RateSource } from "./rateQueue.ts";

const f = (media_type: "tv" | "movie", tmdb_id: number, extra: Partial<RateSource> = {}): RateSource => ({
  media_type, tmdb_id, title: `t${tmdb_id}`, poster_path: null, added_at: "2026-01-01T00:00:00Z", ...extra,
});

test("only completed, unrated, unskipped titles, newest watch first", () => {
  const follows = [
    f("movie", 1), // watched, unrated
    f("movie", 2), // not watched
    f("movie", 3), // watched, rated
    f("tv", 10, { aired_episodes: 8 }), // all 8 watched
    f("tv", 11, { aired_episodes: 8 }), // 5 of 8
    f("tv", 12, { aired_episodes: 8, dropped: true }), // dropped
    f("movie", 4), // watched, skipped
  ];
  const out = pickToRate({
    follows,
    shows: new Map([[10, { watched: 8, last: "2026-11-20T10:00:00Z" }], [11, { watched: 5, last: "2026-11-22T10:00:00Z" }], [12, { watched: 8, last: "2026-11-22T10:00:00Z" }]]),
    watchedMovies: new Map([[1, "2026-11-21T10:00:00Z"], [3, "2026-11-23T10:00:00Z"], [4, "2026-11-23T10:00:00Z"]]),
    rated: new Set(["movie-3"]),
    skipped: new Set(["movie-4"]),
  });
  assert.deepEqual(out.map((x) => `${x.media_type}-${x.tmdb_id}`), ["movie-1", "tv-10"]);
});

test("a watched movie with no date falls back to when it was added", () => {
  const out = pickToRate({
    follows: [f("movie", 1, { added_at: "2026-05-01T00:00:00Z" }), f("movie", 2, { added_at: "2026-01-01T00:00:00Z" })],
    shows: new Map(),
    watchedMovies: new Map([[1, null], [2, "2026-06-01T00:00:00Z"]]),
    rated: new Set(),
    skipped: new Set(),
  });
  assert.deepEqual(out.map((x) => x.tmdb_id), [2, 1]);
});

test("home card: ten or more, and not inside its hidden week", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");
  assert.equal(rateCardShown(9, null, now), false);
  assert.equal(rateCardShown(10, null, now), true);
  assert.equal(rateCardShown(50, "2026-11-25T00:00:00Z", now), false);
  assert.equal(rateCardShown(50, "2026-11-20T00:00:00Z", now), true);
  assert.equal(rateCardShown(50, "garbage", now), true);
});

test("the push week starts on Saturday", () => {
  assert.equal(rateWeekOf("2026-11-21"), "2026-11-21"); // Saturday
  assert.equal(rateWeekOf("2026-11-26"), "2026-11-21"); // Thursday
  assert.equal(rateWeekOf("2026-11-27"), "2026-11-21"); // Friday
  assert.equal(rateWeekOf("2026-11-28"), "2026-11-28"); // next Saturday
});

test("skips are clean, unique, capped, newest last", () => {
  assert.deepEqual(sanitizeRateSkip(["movie-1", "movie-1", "tv-2", "x", 3, "movie-0", "tv-12345678901"]), ["movie-1", "tv-2"]);
  assert.deepEqual(addRateSkip(["movie-1", "tv-2"], "movie-1"), ["tv-2", "movie-1"]);
  const many = Array.from({ length: RATE_SKIP_CAP + 5 }, (_, i) => `movie-${i + 1}`);
  const kept = sanitizeRateSkip(many);
  assert.equal(kept.length, RATE_SKIP_CAP);
  assert.equal(kept[0], "movie-6");
  assert.equal(sanitizeRateCard("2026-11-30T00:00:00.000Z"), "2026-11-30T00:00:00.000Z");
  assert.equal(sanitizeRateCard("soon"), null);
});
