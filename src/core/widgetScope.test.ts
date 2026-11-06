import { test } from "node:test";
import assert from "node:assert/strict";
import { WIDGET_ON_DM_UNTIL, scopeOf, scopeVerdict } from "./widgetScope.ts";

/* A-05 — رمزٌ على مساراته وحدَها، وانتقالٌ مؤرَّخ لرمز الودجت على مسارَي الرسائل */
const before = Date.parse(WIDGET_ON_DM_UNTIL) - 1;
const after = Date.parse(WIDGET_ON_DM_UNTIL) + 1;

test("a token works on its own routes", () => {
  assert.equal(scopeVerdict("widget", "widget", after), "ok");
  assert.equal(scopeVerdict("dm", "dm", after), "ok");
});

test("a dm token never marks episodes, even during the transition", () => {
  assert.equal(scopeVerdict("dm", "widget", before), "refused");
  assert.equal(scopeVerdict("dm", "widget", after), "refused");
});

test("a widget token on the dm routes: accepted until the date, refused after", () => {
  assert.equal(scopeVerdict("widget", "dm", before), "legacy");
  assert.equal(scopeVerdict("widget", "dm", after), "refused");
});

test("rows from before migration 239 (no column) read as widget", () => {
  assert.equal(scopeOf(undefined), "widget");
  assert.equal(scopeOf(null), "widget");
  assert.equal(scopeOf("other"), "widget");
  assert.equal(scopeOf("dm"), "dm");
});
