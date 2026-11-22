import { test } from "node:test";
import assert from "node:assert/strict";
import { directedFilms, isFeature, pickDirector } from "./directors.ts";

/* T517 — قوائمُ المخرجين: الشخصُ الصحيح، وما أخرجه بنفسه وحده، وأفلامُه الطويلة */

test("picks the exact name from the Directing department, most popular first", () => {
  const hits = [
    { id: 1, name: "David Fincher", known_for_department: "Acting", popularity: 50 },
    { id: 7467, name: "David Fincher", known_for_department: "Directing", popularity: 9 },
    { id: 3, name: "David Fincherson", known_for_department: "Directing", popularity: 99 },
  ];
  assert.equal(pickDirector(hits, "David Fincher")?.id, 7467);
});

test("accents and case do not break the match, a different name never matches", () => {
  const hits = [{ id: 137427, name: "Denis Villeneuve", known_for_department: "Directing", popularity: 20 }];
  assert.equal(pickDirector(hits, "denis villeneuve")?.id, 137427);
  assert.equal(pickDirector(hits, "Dénis Villeneuve")?.id, 137427);
  assert.equal(pickDirector(hits, "Denis Villeneuve Jr"), null);
  assert.equal(pickDirector([], "Denis Villeneuve"), null);
});

test("keeps only what he directed himself, in release order, once", () => {
  const crew = [
    { id: 30, job: "Director", release_date: "2019-07-26" },
    { id: 30, job: "Writer", release_date: "2019-07-26" },
    { id: 10, job: "Producer", release_date: "1990-01-01" },
    { id: 20, job: "Director", release_date: "1994-09-10" },
    { id: 20, job: "Director", release_date: "1994-09-10" },
    { id: 40, job: "Director", release_date: "" },
    { id: 50, job: "Director", release_date: "2001-01-01", video: true },
  ];
  assert.deepEqual(
    directedFilms(crew).map((f) => f.id),
    [20, 30],
  );
});

test("a feature is an hour or more; an upcoming film without a runtime stays", () => {
  const today = "2026-11-22";
  assert.equal(isFeature(16, "1951-04-26", today), false);
  assert.equal(isFeature(62, "1953-03-31", today), true);
  assert.equal(isFeature(null, "2026-12-18", today), true);
  assert.equal(isFeature(0, "1960-01-01", today), false);
});
