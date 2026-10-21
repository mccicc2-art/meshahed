import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSeasons, parseSeasonOrder, SEASON_FOLD_MIN } from "./seasonOrder.ts";

/* 🆕 D-1500 — «المتابَعة أولاً»: المكتملةُ تحت، ومن ستّةٍ تنطوي، ولا ترتيبَ حين لا يختلف */
type S = { n: number; aired: number; done: boolean };
const run = (list: S[]) => splitSeasons(list, (s) => s.done, (s) => s.aired > 0);
const nums = (l: S[]) => l.map((s) => s.n);

test("ترتيب المواسم: المكتملة تنزل تحت غير المكتملة بترتيبها", () => {
  const r = run([
    { n: 1, aired: 10, done: true },
    { n: 2, aired: 10, done: false },
    { n: 3, aired: 0, done: false },
  ]);
  assert.equal(r.differs, true);
  assert.equal(r.fold, false);
  assert.deepEqual(nums(r.active), [2, 3]);
  assert.deepEqual(nums(r.done), [1]);
});

test("ترتيب المواسم: لا يتغيّر شيء لعملٍ لم يُبدأ أو اكتمل كلُّه (ولو بقي موسمٌ قادم)", () => {
  assert.equal(run([{ n: 1, aired: 8, done: false }, { n: 2, aired: 8, done: false }]).differs, false);
  assert.equal(run([{ n: 1, aired: 8, done: true }, { n: 2, aired: 8, done: true }]).differs, false);
  assert.equal(run([{ n: 1, aired: 8, done: true }, { n: 2, aired: 0, done: false }]).differs, false);
  assert.equal(run([{ n: 1, aired: 8, done: false }, { n: 2, aired: 8, done: true }]).differs, false);
});

test("ترتيب المواسم: الطيّ من ستّة مواسم مكتملة", () => {
  const mk = (k: number): S[] => [...Array.from({ length: k }, (_, i) => ({ n: i + 1, aired: 5, done: true })), { n: k + 1, aired: 5, done: false }];
  assert.equal(run(mk(SEASON_FOLD_MIN - 1)).fold, false);
  assert.equal(run(mk(SEASON_FOLD_MIN)).fold, true);
  assert.equal(SEASON_FOLD_MIN, 6);
});

test("ترتيب المواسم: الاختيار المحفوظ — الأصلي أو الافتراض", () => {
  assert.equal(parseSeasonOrder("original"), "original");
  assert.equal(parseSeasonOrder(null), "progress");
  assert.equal(parseSeasonOrder("x"), "progress");
});
