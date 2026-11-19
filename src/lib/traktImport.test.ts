import { test } from "node:test";
import assert from "node:assert/strict";
import { planTraktImport, traktKey } from "./traktImport.ts";

const lib = (follows: [string, boolean][], rated: string[] = []) => ({
  follows: new Map(follows.map(([k, p]) => [k, { hasPoster: p }])),
  rated: new Set(rated),
});

test("a work already in the library is not re-added; only a missing poster is filled", () => {
  const plan = planTraktImport(
    {
      shows: [
        { tmdbId: 1, title: "Kept", episodes: [] },
        { tmdbId: 2, title: "No poster", episodes: [] },
        { tmdbId: 3, title: "New", episodes: [] },
      ],
      movies: [],
    },
    lib([
      [traktKey("tv", 1), true],
      [traktKey("tv", 2), false],
    ]),
  );
  assert.deepEqual(plan.add.map((a) => a.tmdbId), [3]);
  assert.deepEqual(
    plan.posters.map((p) => [p.tmdbId, p.isNew]),
    [
      [3, true],
      [2, false],
    ],
  );
});

test("a Loopz rating wins; Trakt's rating is written only where there is none", () => {
  const plan = planTraktImport(
    {
      shows: [{ tmdbId: 1, title: "A", episodes: [], rating: 9 }],
      movies: [
        { tmdbId: 1, title: "B", rating: 7 },
        { tmdbId: 2, title: "C" },
      ],
    },
    lib([], [traktKey("tv", 1)]),
  );
  assert.deepEqual(
    plan.rate.map((r) => [r.kind, r.tmdbId, r.rating]),
    [["movie", 1, 7]],
  );
});

test("tv and movie with the same TMDB id are different works; duplicates fold", () => {
  const plan = planTraktImport(
    {
      shows: [
        { tmdbId: 5, title: "S", episodes: [] },
        { tmdbId: 5, title: "S again", episodes: [] },
      ],
      movies: [{ tmdbId: 5, title: "M" }],
    },
    lib([]),
  );
  assert.deepEqual(plan.add.map((a) => traktKey(a.kind, a.tmdbId)), ["tv-5", "movie-5"]);
});

test("poster lookups stop at the cap, new works first", () => {
  const shows = Array.from({ length: 5 }, (_, i) => ({ tmdbId: i + 1, title: `S${i}`, episodes: [] }));
  const plan = planTraktImport({ shows, movies: [] }, lib([[traktKey("tv", 1), false]]), 3);
  assert.equal(plan.posters.length, 3);
  assert.equal(plan.posters.every((p) => p.isNew), true);
  assert.equal(plan.add.length, 4);
});

test("in the library without a Loopz rating ⇒ not re-added but rated; ratings round and clamp to 1–10", () => {
  const plan = planTraktImport(
    {
      shows: [{ tmdbId: 1, title: "A", episodes: [], rating: 8.6 }],
      movies: [
        { tmdbId: 2, title: "B", rating: 14 },
        { tmdbId: 3, title: "C", rating: 0.2 },
      ],
    },
    lib([[traktKey("tv", 1), true]]),
  );
  assert.equal(plan.add.some((a) => a.kind === "tv" && a.tmdbId === 1), false);
  assert.deepEqual(
    plan.rate.map((r) => [r.tmdbId, r.rating]),
    [
      [1, 9],
      [2, 10],
      [3, 1],
    ],
  );
});

test("the poster cap can be filled by existing works without a poster", () => {
  const shows = Array.from({ length: 4 }, (_, i) => ({ tmdbId: i + 1, title: `S${i}`, episodes: [] }));
  const plan = planTraktImport({ shows, movies: [] }, lib(shows.map((s) => [traktKey("tv", s.tmdbId), false])), 2);
  assert.equal(plan.add.length, 0);
  assert.deepEqual(plan.posters.map((p) => [p.tmdbId, p.isNew]), [
    [1, false],
    [2, false],
  ]);
});
