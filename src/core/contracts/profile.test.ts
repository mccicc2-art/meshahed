import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProfileHandle } from "./profile.ts";

/** Phase 11-N · N0 — اسمُ الملفّ من المسار: يُطوى ويُفحص قبل أيّ قراءة */

test("الاسم: يُفكّ ترميزُه ويُطوى، و@ في أوّله تسقط", () => {
  assert.equal(parseProfileHandle("Khld"), "khld");
  assert.equal(parseProfileHandle("%40khld"), "khld");
  assert.equal(parseProfileHandle(" ahmed_1 "), "ahmed_1");
});

test("ما ليس اسماً يُرفض (نسبةٌ مئويّة · مسافات · طول)", () => {
  assert.equal(parseProfileHandle("%"), null);
  assert.equal(parseProfileHandle("a b"), null);
  assert.equal(parseProfileHandle("x".repeat(25)), null);
  assert.equal(parseProfileHandle(""), null);
  assert.equal(parseProfileHandle(undefined), null);
  assert.equal(parseProfileHandle("%E0%A4%A"), null);
});

test("المعرّفُ يمرّ كما هو", () => {
  const id = "5b7c2a9e-1111-4a2b-9c3d-000000000001";
  assert.equal(parseProfileHandle(id), id);
});

