import { test } from "node:test";
import assert from "node:assert/strict";
import { STORY_DAILY_FREE, storyDay, storyLeft, storyResetHours, storyUsedToday } from "./storyQuota.ts";

/* 🆕 T540 — حدُّ البحث بالوصف: يومُ الرياض، والعدُّ القديمُ يُقرأ صفراً */
test("يوم الرياض: منتصف الليل عند ٢١:٠٠ غرينتش", () => {
  assert.equal(storyDay(Date.parse("2026-11-24T20:59:00Z")), "2026-11-24");
  assert.equal(storyDay(Date.parse("2026-11-24T21:00:00Z")), "2026-11-25");
});

test("العدّ المحفوظ يُحسب لليوم نفسه فقط", () => {
  const now = Date.parse("2026-11-24T15:00:00Z"); // ٦ مساءً بالرياض
  assert.equal(storyUsedToday(3, "2026-11-24T06:00:00Z", now), 3);
  assert.equal(storyUsedToday(3, "2026-11-23T20:00:00Z", now), 0); // ١١ ليلاً بالرياض أمس
  assert.equal(storyUsedToday(3, "2026-11-23T21:30:00Z", now), 3); // ١٢:٣٠ بعد منتصف الليل — اليوم نفسه
  assert.equal(storyUsedToday(3, null, now), 0);
  assert.equal(storyUsedToday(3, "not a date", now), 0);
  assert.equal(storyUsedToday(-1, "2026-11-24T06:00:00Z", now), 0);
});

test("الباقي لا ينزل تحت الصفر", () => {
  assert.equal(STORY_DAILY_FREE, 10);
  assert.equal(storyLeft(0), 10);
  assert.equal(storyLeft(2), 8);
  assert.equal(storyLeft(10), 0);
  assert.equal(storyLeft(14), 0);
});

test("ساعات التجدّد حتى منتصف ليل الرياض", () => {
  assert.equal(storyResetHours(Date.parse("2026-11-24T15:00:00Z")), 6); // ٦ مساءً → ٦ ساعات
  assert.equal(storyResetHours(Date.parse("2026-11-24T20:30:00Z")), 1); // ١١:٣٠ ليلاً → ساعةٌ على الأقلّ
  assert.equal(storyResetHours(Date.parse("2026-11-24T21:00:00Z")), 24); // منتصفُ الليل تماماً → يومٌ كامل
});
