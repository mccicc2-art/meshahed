import { test } from "node:test";
import assert from "node:assert/strict";
import { ageBadge } from "./ageRating.ts";

test("every code in Ahmed's table lands on its tier", () => {
  const cases: [string, string][] = [
    ["G", "G"], ["TV-G", "G"], ["TV-Y", "G"],
    ["TV-Y7", "+7"], ["TV-Y7-FV", "+7"], ["PG", "+7"], ["TV-PG", "+7"],
    ["PG-13", "+13"], ["TV-14", "+13"],
    ["R", "+18"], ["NC-17", "+18"], ["TV-MA", "+18"],
  ];
  for (const [code, text] of cases) assert.equal(ageBadge(code)?.text, text, code);
});

test("unknown codes are hidden", () => {
  for (const code of ["Approved", "Passed", "Not Rated", "Unrated", "NR", "N/A", "", "M"]) assert.equal(ageBadge(code), null, code);
  assert.equal(ageBadge(null), null);
  assert.equal(ageBadge(undefined), null);
});

test("the original code is kept for the accessibility label, spacing and case tolerated", () => {
  const b = ageBadge(" tv-ma ");
  assert.equal(b?.text, "+18");
  assert.equal(b?.code, "tv-ma");
});

test("black text only on the yellow tier", () => {
  assert.equal(ageBadge("PG-13")?.fg, "#000000");
  for (const code of ["G", "PG", "R"]) assert.equal(ageBadge(code)?.fg, "#ffffff", code);
});
