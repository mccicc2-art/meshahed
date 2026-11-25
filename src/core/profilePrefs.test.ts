import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE_PREFS, defaultProfilePrefs, orderedProfileTabs, sanitizeProfilePrefs } from "./profilePrefs.ts";

/* T543 — الملفُّ لغير المشترك بافتراضيّ المشترك (الشكلُ لا التعديل) */
test("the non-subscriber profile default is the subscriber's: six sections, four tabs", () => {
  assert.deepEqual(DEFAULT_PROFILE_PREFS.order, ["shows", "movies", "anime", "ratings", "artists", "lists"]);
  assert.deepEqual(DEFAULT_PROFILE_PREFS.hiddenTabs, ["lists"]);
  assert.deepEqual(defaultProfilePrefs(false).order, defaultProfilePrefs(true).order);
  assert.deepEqual(defaultProfilePrefs(false).hiddenTabs, defaultProfilePrefs(true).hiddenTabs);
});

test("a non-subscriber on the old default moves to the new one; a hand-arranged profile stays", () => {
  const old = { order: ["shows", "movies", "anime"], hiddenTabs: ["activity", "favorites", "lists"] };
  const p = sanitizeProfilePrefs(old, false);
  assert.deepEqual(p.order, DEFAULT_PROFILE_PREFS.order);
  assert.deepEqual(p.hiddenTabs, ["lists"]);
  assert.deepEqual(orderedProfileTabs(p).filter((k) => !p.hiddenTabs.includes(k)), ["overview", "activity", "reviews", "favorites"]);
  const mine = { order: ["movies", "shows"], custom: ["order"] };
  assert.deepEqual(sanitizeProfilePrefs(mine, false).order, ["movies", "shows"]);
});
