import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HOME_PREFS, HOME_SECTIONS, PLUS_HOME_ORDER, PLUS_STATS_PICK, defaultHomePrefs, sanitizeHomePrefs, homeOrderUntouched } from "./homePrefs.ts";

/* T524 — «الآن في السينما» بعد «للمشاهدة» · T543 — غيرُ المشترك بافتراضيّ المشترك، والرائجُ غادر الرئيسيّة */
test("the non-subscriber home is the subscriber's default: same order, same three stat cells", () => {
  assert.deepEqual(DEFAULT_HOME_PREFS.order, ["week", "continue", "towatch", "cinema", "friends"]);
  assert.deepEqual(PLUS_HOME_ORDER, DEFAULT_HOME_PREFS.order);
  assert.deepEqual(DEFAULT_HOME_PREFS.statsPick, ["shows", "movies", "time"]);
  assert.deepEqual(PLUS_STATS_PICK, DEFAULT_HOME_PREFS.statsPick);
  assert.deepEqual(defaultHomePrefs(false).order, defaultHomePrefs(true).order);
});

test("trending is gone from the home sections, and a stored order that had it loses it", () => {
  assert.equal((HOME_SECTIONS as readonly string[]).includes("trending"), false);
  assert.deepEqual(sanitizeHomePrefs({ order: ["continue", "trending", "week"], custom: ["order"] }, false).order, ["continue", "week"]);
});

test("a non-subscriber stored on an old default moves to the new one", () => {
  for (const order of [
    ["week", "continue", "towatch", "friends", "trending"],
    ["week", "continue", "towatch", "cinema", "friends", "trending"],
    ["week", "continue", "towatch", "trending"],
  ]) {
    assert.deepEqual(sanitizeHomePrefs({ order }, false).order, DEFAULT_HOME_PREFS.order);
    assert.equal(homeOrderUntouched({ order }), true);
  }
  assert.deepEqual(sanitizeHomePrefs({ statsPick: ["shows", "movies"] }, false).statsPick, ["shows", "movies", "time"]);
  assert.deepEqual(sanitizeHomePrefs(null, false).order, DEFAULT_HOME_PREFS.order);
});

test("an order arranged by hand stays as it is, without cinema for a non-subscriber", () => {
  const mine = { order: ["continue", "week"], custom: ["order"] };
  assert.deepEqual(sanitizeHomePrefs(mine, false).order, ["continue", "week"]);
});
