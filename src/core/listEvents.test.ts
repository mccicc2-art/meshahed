import { test } from "node:test";
import assert from "node:assert/strict";
import { eventWindow, orderForYou } from "./listEvents.ts";
import { getDict } from "./i18n.ts";

/* 442 — نافذةُ قائمة الحدث: قبل العرض، يومَه، ومهلةُ الأسبوعين بعده، وبتقويم الرياض */
const at = (iso: string) => Date.parse(iso);

test("before the release it counts down in whole Riyadh days", () => {
  assert.deepEqual(eventWindow("2026-12-18", 14, at("2026-11-19T02:00:00Z")), { active: true, phase: "before", days: 29 });
});

test("the Riyadh calendar decides the day, not UTC", () => {
  /* ٢١:٠٠ UTC يومَ ١٧ = منتصفُ ليل ١٨ في الرياض — فهو «اليوم» لا «غداً» */
  assert.equal(eventWindow("2026-12-18", 14, at("2026-12-17T21:00:00Z")).phase, "today");
  assert.equal(eventWindow("2026-12-18", 14, at("2026-12-17T20:59:00Z")).days, 1);
});

test("stays pinned for the grace days after the release, then drops", () => {
  assert.deepEqual(eventWindow("2026-12-18", 14, at("2027-01-01T10:00:00Z")), { active: true, phase: "after", days: 14 });
  assert.equal(eventWindow("2026-12-18", 14, at("2027-01-02T10:00:00Z")).active, false);
});

test("no date means no pin", () => {
  assert.equal(eventWindow(null, 14, Date.now()).active, false);
  assert.equal(eventWindow("TBA", 14, Date.now()).active, false);
});

test("Arabic count agrees with the counted noun", () => {
  const t = getDict("ar");
  assert.equal(t.listEventIn(1), "يُعرض غداً");
  assert.equal(t.listEventIn(2), "يُعرض بعد يومين");
  assert.equal(t.listEventIn(7), "يُعرض بعد 7 أيام");
  assert.equal(t.listEventIn(29), "يُعرض بعد 29 يوماً");
});

test("the event list goes first, leaves Trending and never repeats", () => {
  const r = orderForYou(["ev"], ["a", "ev", "t1", "b"], [{ id: "t1" }, { id: "ev" }, { id: "t2" }]);
  assert.deepEqual(r.ids, ["ev", "a", "b"]);
  assert.deepEqual(r.trending.map((c) => c.id), ["t1", "t2"]);
});

test("without an event the rail is the old one", () => {
  const r = orderForYou([], ["a", "t1", "b"], [{ id: "t1" }]);
  assert.deepEqual(r.ids, ["a", "b"]);
  assert.deepEqual(r.trending.map((c) => c.id), ["t1"]);
});
