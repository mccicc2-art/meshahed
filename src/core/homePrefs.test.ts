import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HOME_PREFS, PLUS_HOME_ORDER, sanitizeHomePrefs, homeOrderUntouched } from "./homePrefs.ts";

/* T524 — «الآن في السينما» في رئيسيّة غير المشترك بعد «للمشاهدة» (أحمد «ضيف السينما لهم» · «١أ») */
test("the non-subscriber home shows cinema right after To Watch, like the subscriber's", () => {
  assert.deepEqual(DEFAULT_HOME_PREFS.order, ["week", "continue", "towatch", "cinema", "friends", "trending"]);
  assert.deepEqual(DEFAULT_HOME_PREFS.order.slice(0, 5), PLUS_HOME_ORDER);
});

test("a non-subscriber stored on the old default moves to the new one; the subscriber keeps his", () => {
  const old = { order: ["week", "continue", "towatch", "friends", "trending"] };
  assert.deepEqual(sanitizeHomePrefs(old, false).order, DEFAULT_HOME_PREFS.order);
  assert.deepEqual(sanitizeHomePrefs(old, true).order, PLUS_HOME_ORDER);
  assert.equal(homeOrderUntouched(old), true);
  assert.deepEqual(sanitizeHomePrefs(null, false).order, DEFAULT_HOME_PREFS.order);
});

test("an order arranged by hand stays as it is, without cinema for a non-subscriber", () => {
  const mine = { order: ["continue", "week"], custom: ["order"] };
  assert.deepEqual(sanitizeHomePrefs(mine, false).order, ["continue", "week"]);
});
