import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMsgPeerBody, parseMsgReplyBody, MSG_REPLY_MAX } from "./messages.ts";

/** Phase 11-M · M4 — أجسامُ أفعال «الرسائل»: متسامحٌ مع الزائد، صارمٌ مع الناقص، والفراغُ يُرفض قبل الرحلة */

const U = "5b7c2a9e-1111-4a2b-9c3d-000000000001";

test("الردّ: معرّفٌ صالحٌ ونصٌّ غيرُ فارغٍ في الحدّ", () => {
  assert.deepEqual(parseMsgReplyBody({ share_id: U, body: "  أهلاً ", x: 1 }), { share_id: U, body: "أهلاً" });
  assert.equal(parseMsgReplyBody({ share_id: U, body: "   " }), null);
  assert.equal(parseMsgReplyBody({ share_id: "abc", body: "hi" }), null);
  assert.equal(parseMsgReplyBody({ share_id: U, body: "x".repeat(MSG_REPLY_MAX + 1) }), null);
  assert.equal(parseMsgReplyBody(null), null);
});

test("الشخص: معرّفٌ صالحٌ وحدَه", () => {
  assert.deepEqual(parseMsgPeerBody({ person_id: U }), { person_id: U });
  assert.equal(parseMsgPeerBody({ person_id: "u1" }), null);
  assert.equal(parseMsgPeerBody({}), null);
});
