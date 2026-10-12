import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./safeNext.ts";

test("وجهةٌ داخليّةٌ تمرّ كما هي، باستعلامها", () => {
  assert.equal(safeNext("/show/1399"), "/show/1399");
  assert.equal(safeNext("/news?tab=anime"), "/news?tab=anime");
});

test("الخارجيّ والمموَّه يسقطان إلى الجذر", () => {
  for (const v of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil", "/javascript:alert(1)", "evil"]) {
    assert.equal(safeNext(v as string | null | undefined), "/");
  }
});

test("صفحتا الدخول والخروج ليستا وجهة", () => {
  assert.equal(safeNext("/login"), "/");
  assert.equal(safeNext("/login?next=/x"), "/");
  assert.equal(safeNext("/auth/signout"), "/");
});
