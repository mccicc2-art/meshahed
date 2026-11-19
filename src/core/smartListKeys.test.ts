import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleTypes, toggleRuleType, parseMix, formatMix, defaultMix, stepMix, mixCan, interleaveByMix } from "./smartListKeys.ts";

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

/* T467 — نسبةُ الأنواع: لا تُقبل إلا كاملة، والخطوةُ تحفظ المجموع، والتناوبُ يحترم الحصص ويُكمل من غيره */
test("parseMix accepts only a full, valid split", () => {
  assert.deepEqual(parseMix("movie-60,tv-40", ["movie", "tv"]), { movie: 60, tv: 40 });
  assert.equal(parseMix("movie-60,tv-30", ["movie", "tv"]), null);
  assert.equal(parseMix("movie-100", ["movie", "tv"]), null);
  assert.equal(parseMix("movie-95,tv-5", ["movie", "tv"]), null);
  assert.equal(parseMix("movie-50,tv-50", ["movie"]), null);
  assert.equal(parseMix("movie-50,anime-50", ["movie", "tv"]), null);
});

test("defaultMix splits evenly, the remainder to the first", () => {
  assert.deepEqual(defaultMix(["movie", "tv"]), { movie: 50, tv: 50 });
  assert.deepEqual(defaultMix(["movie", "tv", "all"]), { movie: 40, tv: 30, all: 30 });
  assert.equal(formatMix(defaultMix(["tv", "all"]), ["tv", "all"]), "tv-50,all-50");
});

test("stepMix keeps the sum at 100 and no type below 10", () => {
  const two = ["movie", "tv"] as const;
  assert.deepEqual(stepMix({ movie: 50, tv: 50 }, two, "movie", 1), { movie: 60, tv: 40 });
  assert.deepEqual(stepMix({ movie: 90, tv: 10 }, two, "movie", 1), { movie: 90, tv: 10 });
  assert.deepEqual(stepMix({ movie: 10, tv: 90 }, two, "movie", -1), { movie: 10, tv: 90 });
  const three = ["movie", "tv", "all"] as const;
  assert.deepEqual(stepMix({ movie: 40, tv: 30, all: 30 }, three, "movie", 1), { movie: 50, tv: 30, all: 20 });
  assert.deepEqual(stepMix({ movie: 40, tv: 40, all: 20 }, three, "all", -1), { movie: 50, tv: 40, all: 10 });
  assert.deepEqual(stepMix({ movie: 40, tv: 40, all: 20 }, three, "movie", -1), { movie: 30, tv: 40, all: 30 });
  assert.deepEqual(mixCan({ movie: 80, tv: 10, all: 10 }, three, "movie"), { up: false, down: true });
});

test("interleaveByMix follows the shares, dedupes, and fills from the rest", () => {
  const m = ["m1", "m2", "m3", "m4", "m5", "m6"];
  const t = ["t1", "t2", "t3", "t4"];
  const id = (x: string) => x;
  const out = interleaveByMix([m, t], [60, 40], 5, id);
  assert.equal(out.filter((x) => x.startsWith("m")).length, 3);
  assert.equal(out[0], "m1");
  assert.deepEqual(interleaveByMix([["a", "x"], ["x", "b"]], [50, 50], 4, id), ["a", "x", "b"]);
  const short = interleaveByMix([["t1"], m], [90, 10], 4, id);
  assert.deepEqual(short, ["t1", "m1", "m2", "m3"]);
});
