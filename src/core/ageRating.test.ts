import { test } from "node:test";
import assert from "node:assert/strict";
import { ageBadge, ageInfo, ageA11y } from "./ageRating.ts";

test("the badge shows the official code, coloured by its tier", () => {
  const cases: [string, string, string][] = [
    ["G", "G", "g"], ["TV-G", "TV-G", "g"], ["TV-Y", "TV-Y", "g"],
    ["TV-Y7", "TV-Y7", "7"], ["TV-Y7-FV", "TV-Y7", "7"], ["PG", "PG", "7"], ["TV-PG", "TV-PG", "7"],
    ["PG-13", "PG-13", "13"], ["TV-14", "TV-14", "13"],
    ["R", "R", "16"], ["TV-MA", "TV-MA", "16"], ["NC-17", "NC-17", "18"],
  ];
  for (const [code, text, tier] of cases) {
    const b = ageBadge(code);
    assert.equal(b?.text, text, code);
    assert.equal(b?.tier, tier, code);
  }
});

test("unknown codes are hidden", () => {
  for (const code of ["Approved", "Passed", "Not Rated", "Unrated", "NR", "N/A", "", "M"]) assert.equal(ageBadge(code), null, code);
  assert.equal(ageBadge(null), null);
  assert.equal(ageBadge(undefined), null);
});

test("spacing and case are tolerated; the original code is kept", () => {
  const b = ageBadge(" tv-ma ");
  assert.equal(b?.text, "TV-MA");
  assert.equal(b?.code, "tv-ma");
});

test("black text on the yellow and orange tiers only", () => {
  assert.equal(ageBadge("PG-13")?.fg, "#000000");
  assert.equal(ageBadge("R")?.fg, "#000000");
  for (const code of ["G", "PG", "NC-17"]) assert.equal(ageBadge(code)?.fg, "#ffffff", code);
});

test("the sheet lists its family in order and marks the title's code", () => {
  const tv = ageInfo(ageBadge("TV-MA")!, "ar");
  assert.deepEqual(tv.ladder.map((x) => x.text), ["TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"]);
  assert.deepEqual(tv.ladder.filter((x) => x.on).map((x) => x.text), ["TV-MA"]);
  assert.equal(tv.name, "للكبار");
  const mv = ageInfo(ageBadge("R")!, "en");
  assert.deepEqual(mv.ladder.map((x) => x.text), ["G", "PG", "PG-13", "R", "NC-17"]);
  assert.equal(mv.name, "Restricted");
  assert.equal(ageA11y(ageBadge("R")!, "Age rating", "en"), "Age rating: R, Restricted");
});
