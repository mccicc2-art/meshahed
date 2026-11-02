import { test } from "node:test";
import assert from "node:assert/strict";
import { airPlanOf, planDates, type AirEp } from "./airPlan.ts";

/* سبتٌ بعد سبت — «بلاك كلوفر كل سبت» (أحمد ١ نوفمبر) */
const weekly: AirEp[] = [
  { ep: 1, date: "2026-10-17" },
  { ep: 2, date: "2026-10-24" },
  { ep: 3, date: "2026-10-31" },
  { ep: 4, date: "2026-11-07" },
];

test("weekly open show: announced kept, the rest of the month expected every 7 days", () => {
  const plan = airPlanOf(weekly, "2026-11-01", true);
  assert.deepEqual(plan.announced, ["2026-11-07"]);
  assert.equal(plan.weekly, true);
  assert.equal(plan.more, null);
  assert.deepEqual(planDates(plan, "2026-11-01", "2026-11-30"), [
    { date: "2026-11-07", expected: false },
    { date: "2026-11-14", expected: true },
    { date: "2026-11-21", expected: true },
    { date: "2026-11-28", expected: true },
  ]);
});

test("listed but undated episodes cap the projection", () => {
  const eps = [...weekly, { ep: 5, date: null }, { ep: 6, date: null }];
  const plan = airPlanOf(eps, "2026-11-01", true);
  assert.equal(plan.more, 2);
  assert.deepEqual(
    planDates(plan, "2026-11-01", "2026-12-31").map((d) => d.date),
    ["2026-11-07", "2026-11-14", "2026-11-21"],
  );
});

test("a finale closes the door; an ended show projects nothing", () => {
  const fin = airPlanOf([...weekly.slice(0, 3), { ep: 4, date: "2026-11-07", type: "finale" }], "2026-11-01", true);
  assert.equal(fin.more, 0);
  assert.deepEqual(planDates(fin, "2026-11-01", "2026-11-30"), [{ date: "2026-11-07", expected: false }]);
  const ended = airPlanOf(weekly, "2026-11-01", false);
  assert.equal(ended.more, 0);
});

test("irregular or too-short history is not weekly", () => {
  const irregular = airPlanOf(
    [
      { ep: 1, date: "2026-10-10" },
      { ep: 2, date: "2026-10-24" },
      { ep: 3, date: "2026-10-31" },
      { ep: 4, date: "2026-11-07" },
    ],
    "2026-11-01",
    true,
  );
  assert.equal(irregular.weekly, true); // آخرُ ثلاثةٍ أسبوعيّة — الماضي البعيد لا يُحسب
  const two = airPlanOf([{ ep: 1, date: "2026-10-31" }, { ep: 2, date: "2026-11-07" }], "2026-11-01", true);
  assert.equal(two.weekly, false);
  assert.deepEqual(planDates(two, "2026-11-01", "2026-11-30"), [{ date: "2026-11-07", expected: false }]);
});

test("two episodes on one day count once; a stale last date projects nothing", () => {
  const dbl = airPlanOf(
    [
      { ep: 1, date: "2026-10-24" },
      { ep: 2, date: "2026-10-24" },
      { ep: 3, date: "2026-10-31" },
      { ep: 4, date: "2026-11-07" },
    ],
    "2026-11-01",
    true,
  );
  /* حلقتان في يومٍ واحدٍ لا تكسران الإيقاع: المواعيدُ المختلفة 24 · 31 · 7 */
  assert.equal(dbl.weekly, true);
  assert.deepEqual(dbl.announced, ["2026-11-07"]);
  const stale = airPlanOf(weekly, "2026-11-20", true);
  assert.deepEqual(planDates(stale, "2026-11-20", "2026-11-30"), []);
});

test("long season from three points (prev, last, next) is weekly and open", () => {
  /* D-1614b — كونان: الحلقةُ قبل الأخيرة · الأخيرة · القادمة */
  const plan = airPlanOf(
    [
      { ep: 1180, date: "2026-10-24" },
      { ep: 1181, date: "2026-10-31" },
      { ep: 1182, date: "2026-11-07" },
    ],
    "2026-11-01",
    true,
  );
  assert.equal(plan.weekly, true);
  assert.equal(plan.more, null);
  assert.deepEqual(planDates(plan, "2026-11-01", "2026-11-30").map((d) => `${d.date}${d.expected ? "?" : ""}`), [
    "2026-11-07",
    "2026-11-14?",
    "2026-11-21?",
    "2026-11-28?",
  ]);
});

test("D-1614c — one skipped week keeps the weekly rhythm; two breaks or another weekday do not", () => {
  /* كونان: سبتٌ · سبتٌ · (توقّف) · سبتٌ · سبت */
  const brk = airPlanOf(
    [
      { ep: 1, date: "2026-10-03" },
      { ep: 2, date: "2026-10-10" },
      { ep: 3, date: "2026-10-24" },
      { ep: 4, date: "2026-10-31" },
      { ep: 5, date: "2026-11-07" },
    ],
    "2026-11-01",
    true,
  );
  assert.equal(brk.weekly, true);
  assert.deepEqual(planDates(brk, "2026-11-01", "2026-11-21").map((d) => d.date), ["2026-11-07", "2026-11-14", "2026-11-21"]);
  const twoBreaks = airPlanOf(
    [
      { ep: 1, date: "2026-09-26" },
      { ep: 2, date: "2026-10-10" },
      { ep: 3, date: "2026-10-24" },
      { ep: 4, date: "2026-10-31" },
    ],
    "2026-11-01",
    true,
  );
  assert.equal(twoBreaks.weekly, false);
  const shifted = airPlanOf(
    [
      { ep: 1, date: "2026-10-17" },
      { ep: 2, date: "2026-10-24" },
      { ep: 3, date: "2026-10-30" },
    ],
    "2026-11-01",
    true,
  );
  assert.equal(shifted.weekly, false);
});

test("D-1623 — a season whose whole schedule is published is not extended after its last date", () => {
  /* عشرُ حلقاتٍ أسبوعيّة كلُّها مؤرَّخة تنتهي ٥ ديسمبر — والمسلسلُ مجدَّدٌ (`open`) */
  const full: AirEp[] = Array.from({ length: 10 }, (_, i) => ({ ep: i + 1, date: new Date(Date.UTC(2026, 9, 3 + 7 * i)).toISOString().slice(0, 10) }));
  const plan = airPlanOf(full, "2026-11-01", true);
  assert.equal(plan.more, 0);
  assert.equal(planDates(plan, "2026-11-01", "2027-02-28").filter((d) => d.expected).length, 0);
  /* ما يُضاف حلقةً حلقةً (موعدٌ قادمٌ واحد) يبقى مفتوحاً */
  assert.equal(airPlanOf(weekly, "2026-11-01", true).more, null);
});
