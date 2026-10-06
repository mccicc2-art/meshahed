import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchesTrailerFilter,
  parseTrailerFilter,
  trailerFilterActive,
  trailerFilterKey,
  trailerFilterParams,
  trailerGenreIds,
  trailerGenresFor,
} from "./trailerFilter.ts";

const TODAY = "2026-10-07";

test("an empty or unknown link is no filter", () => {
  const f = parseTrailerFilter({ g: "nope,;drop", rel: "later", lang: "xx" });
  assert.deepEqual(f, { genres: [], release: "all", langs: [] });
  assert.equal(trailerFilterActive(f), false);
  assert.deepEqual(trailerFilterParams(f), {});
});

test("order in the link does not make a second filter", () => {
  const a = parseTrailerFilter({ g: "drama,crime", lang: "ko,en" });
  const b = parseTrailerFilter({ g: "crime,drama", lang: "en,ko" });
  assert.equal(trailerFilterKey(a), trailerFilterKey(b));
  assert.deepEqual(parseTrailerFilter(trailerFilterParams(a)), a);
});

test("a genre is read with the row's own side", () => {
  const f = parseTrailerFilter({ g: "action" });
  assert.equal(matchesTrailerFilter({ genre_ids: [28] }, f, "movie", TODAY), true);
  assert.equal(matchesTrailerFilter({ genre_ids: [10759] }, f, "tv", TODAY), true);
  /* 28 رقمُ فيلم — لا يُقبل لمسلسل */
  assert.equal(matchesTrailerFilter({ genre_ids: [28] }, f, "tv", TODAY), false);
});

test("genres join with OR, axes join with AND", () => {
  const f = parseTrailerFilter({ g: "crime,drama", lang: "ko" });
  assert.equal(matchesTrailerFilter({ genre_ids: [18], original_language: "ko" }, f, "tv", TODAY), true);
  assert.equal(matchesTrailerFilter({ genre_ids: [18], original_language: "en" }, f, "tv", TODAY), false);
  assert.equal(matchesTrailerFilter({ genre_ids: [35], original_language: "ko" }, f, "tv", TODAY), false);
});

test("release: out is dated today or before, soon is after or undated", () => {
  const soon = parseTrailerFilter({ rel: "soon" });
  const out = parseTrailerFilter({ rel: "out" });
  assert.equal(matchesTrailerFilter({ release_date: TODAY }, out, "movie", TODAY), true);
  assert.equal(matchesTrailerFilter({ release_date: "2026-10-08" }, out, "movie", TODAY), false);
  assert.equal(matchesTrailerFilter({ release_date: "2026-10-08" }, soon, "movie", TODAY), true);
  assert.equal(matchesTrailerFilter({ first_air_date: "2022-02-06" }, soon, "tv", TODAY), false);
  assert.equal(matchesTrailerFilter({}, soon, "movie", TODAY), true);
  assert.equal(matchesTrailerFilter({}, out, "movie", TODAY), false);
});

test("genres with no TV counterpart are not offered in Shows", () => {
  const shows = trailerGenresFor("shows").map((g) => g.slug);
  assert.equal(shows.includes("horror"), false);
  assert.equal(trailerGenresFor("movies").some((g) => g.slug === "horror"), true);
  assert.equal(trailerGenresFor("for-you").some((g) => g.slug === "horror"), true);
  assert.deepEqual(trailerGenreIds(["horror"], "tv"), []);
});
