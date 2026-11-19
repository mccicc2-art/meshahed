import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleTypes, toggleRuleType } from "./smartListKeys.ts";

/* T454 — الأنواعُ المجموعة: قراءةٌ تقبل القيمةَ المفردةَ القديمة، وترتيبٌ ثابت، وآخرُ نوعٍ لا يُطفأ */
test("ruleTypes reads single and joined values in a fixed order", () => {
  assert.deepEqual(ruleTypes("movie"), ["movie"]);
  assert.deepEqual(ruleTypes("all,movie"), ["movie", "all"]);
  assert.deepEqual(ruleTypes("tv,tv,bogus"), ["tv"]);
  assert.deepEqual(ruleTypes(undefined), []);
});

test("toggleRuleType adds, removes, and never empties", () => {
  assert.equal(toggleRuleType("movie", "tv"), "movie,tv");
  assert.equal(toggleRuleType("movie,tv", "movie"), "tv");
  assert.equal(toggleRuleType("tv", "tv"), "tv");
  assert.equal(toggleRuleType("all", "movie"), "movie,all");
});
