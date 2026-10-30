import { test } from "node:test";
import assert from "node:assert/strict";
import { crashKind } from "./crashKind.ts";

test("widget tap logs and DM-category traces are diagnostics, not crashes", () => {
  assert.equal(crashKind("widget", "widget taps: 3 · token file yes"), "AppDiag");
  assert.equal(crashKind("widget", "widget sizes · ios · 2"), "AppDiag");
  assert.equal(crashKind("messages", "dm category: define: boom"), "AppDiag");
});

test("real screen crashes stay AppCrash", () => {
  assert.equal(crashKind("messages", "Cannot read property 'x' of undefined"), "AppCrash");
  assert.equal(crashKind("home", "dm category: not on this screen"), "AppCrash");
  assert.equal(crashKind("unknown", "TypeError"), "AppCrash");
  assert.equal(crashKind("widget", "TypeError: undefined is not a function"), "AppCrash");
});
