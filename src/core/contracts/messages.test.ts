import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFollowRequestBody, parseMsgPeerBody, parseMsgReplyBody, parseMsgShareBody, MSG_REPLY_MAX, MSG_NOTE_MAX } from "./messages.ts";

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

test("الإرسال (M5): عملٌ صالحٌ لصديق، والملاحظةُ تُطوى وتُقصّ", () => {
  assert.deepEqual(parseMsgShareBody({ recipient_id: U, tmdb_id: 7, media_type: "tv", title: " Lost ", poster_path: "/a.jpg", note: "  شوف\n  هذا " }), {
    recipient_id: U, tmdb_id: 7, media_type: "tv", title: "Lost", poster_path: "/a.jpg", note: "شوف هذا",
  });
  assert.equal(parseMsgShareBody({ recipient_id: U, tmdb_id: 7, media_type: "tv", title: "x", poster_path: null, note: "   " })?.note, null);
  assert.equal(parseMsgShareBody({ recipient_id: U, tmdb_id: 7, media_type: "tv", note: "y".repeat(400) })?.note?.length, MSG_NOTE_MAX);
  assert.equal(parseMsgShareBody({ recipient_id: U, tmdb_id: 0, media_type: "tv" }), null);
  assert.equal(parseMsgShareBody({ recipient_id: U, tmdb_id: 7, media_type: "anime" }), null);
  assert.equal(parseMsgShareBody({ recipient_id: "x", tmdb_id: 7, media_type: "movie" }), null);
});

test("طلب المتابعة (N2-fix): معرّفٌ صالحٌ وقرارٌ صريح", () => {
  assert.deepEqual(parseFollowRequestBody({ person_id: U, accept: true }), { person_id: U, accept: true });
  assert.deepEqual(parseFollowRequestBody({ person_id: U, accept: false }), { person_id: U, accept: false });
  assert.equal(parseFollowRequestBody({ person_id: U }), null);
  assert.equal(parseFollowRequestBody({ person_id: "x", accept: true }), null);
});
