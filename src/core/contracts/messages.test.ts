import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFollowRequestBody, parseMsgPeerBody, parseMsgReplyBody, parseMsgShareBody, parseMsgTextBody, replyEventOut, MSG_REPLY_MAX, MSG_NOTE_MAX, MSG_TEXT_MAX } from "./messages.ts";

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

/* 🆕 D-1380 — الرسالةُ النصّيّةُ المباشرة وإعدادُ «من يقدر يراسلني» */
test("النصّ المباشر: مستلمٌ صالحٌ ونصٌّ غيرُ فارغٍ حتى ألف حرف", () => {
  assert.deepEqual(parseMsgTextBody({ recipient_id: U, body: "  هلا ", x: 1 }), { recipient_id: U, body: "هلا" });
  assert.equal(parseMsgTextBody({ recipient_id: U, body: "   " }), null);
  assert.equal(parseMsgTextBody({ recipient_id: "abc", body: "hi" }), null);
  assert.equal(parseMsgTextBody({ recipient_id: U, body: 5 }), null);
  assert.ok(parseMsgTextBody({ recipient_id: U, body: "a".repeat(MSG_TEXT_MAX) }));
  assert.equal(parseMsgTextBody({ recipient_id: U, body: "a".repeat(MSG_TEXT_MAX + 1) }), null);
});

/* 🆕 D-1387 — صورةٌ بتعليقٍ اختياريّ، أو GIF وحدَه — قيدُ الهجرة ٢٠٢ نفسُه */
test("الصورة والـGIF في الرسالة المباشرة", () => {
  const img = `${U}/0f0e0d0c-1111-4a2b-9c3d-000000000002.jpg`;
  assert.deepEqual(parseMsgTextBody({ recipient_id: U, body: "", image_path: img }), { recipient_id: U, body: "", image_path: img });
  assert.deepEqual(parseMsgTextBody({ recipient_id: U, body: " شوف ", image_path: img }), { recipient_id: U, body: "شوف", image_path: img });
  assert.deepEqual(parseMsgTextBody({ recipient_id: U, body: "", gif_id: "abc123XYZ" }), { recipient_id: U, body: "", gif_id: "abc123XYZ" });
  assert.equal(parseMsgTextBody({ recipient_id: U, body: "هلا", gif_id: "abc123XYZ" }), null, "الـGIF وحدَه");
  assert.equal(parseMsgTextBody({ recipient_id: U, body: "", gif_id: "abc", image_path: img }), null, "لا الاثنان معاً");
  assert.equal(parseMsgTextBody({ recipient_id: U, body: "", gif_id: "a/b" }), null);
  assert.equal(parseMsgTextBody({ recipient_id: U, body: "", image_path: "../x.jpg" }), null);
  assert.equal(parseMsgTextBody({ recipient_id: U, body: "", image_path: `${U}/x.gif` }), null);
  assert.equal(parseMsgTextBody({ recipient_id: U, body: "" }), null, "رسالةٌ فارغة");
});

/* 🆕 D-1400 — ردُّ الصورة والـGIF يعبر إلى التطبيق بوسائطه، والنصُّ وحدَه بلا حقولٍ زائدة */
test("الردّ المنشور: GIF وصورةٌ لا يسقطان، والنصُّ كما كان", () => {
  const base = { id: "m1", mine: true, body: "", created_at: "2026-10-15T00:00:00Z" };
  assert.deepEqual(replyEventOut({ ...base, gif_id: "abc123" }), { kind: "reply", ...base, gif_id: "abc123" });
  const image = { url: "https://x/signed", key: `${U}/${U}.jpg` };
  assert.deepEqual(replyEventOut({ ...base, body: "شوف", image }), { kind: "reply", ...base, body: "شوف", image });
  assert.deepEqual(replyEventOut({ ...base, body: "هلا", gif_id: null, image: null }), { kind: "reply", ...base, body: "هلا" });
});
