import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGroupCreateBody, parseGroupManageBody, parseGroupSendBody, GROUP_MAX_MEMBERS } from "./groups.ts";

/** القروبات (الهجرة ٢٠٥) — الأجسامُ تُرفض قبل الرحلة إن نقصت أو زادت على الحدود */

const id = (n: number) => `5b7c2a9e-1111-4a2b-9c3d-${String(n).padStart(12, "0")}`;
const PHOTO = `${id(1)}/${id(2)}.jpg`;

test("الإنشاء: اسمٌ مطويّ، وأعضاءٌ من ١ إلى ١١، وصورةٌ اختياريّة", () => {
  assert.deepEqual(parseGroupCreateBody({ name: "  سهرة   الخميس ", member_ids: [id(1)] }), { name: "سهرة الخميس", member_ids: [id(1)], photo_path: null });
  assert.deepEqual(parseGroupCreateBody({ name: "x", member_ids: [id(1)], photo_path: PHOTO })?.photo_path, PHOTO);
  assert.equal(parseGroupCreateBody({ name: " ", member_ids: [id(1)] }), null);
  assert.equal(parseGroupCreateBody({ name: "x".repeat(31), member_ids: [id(1)] }), null);
  assert.equal(parseGroupCreateBody({ name: "x", member_ids: [] }), null);
  assert.deepEqual(parseGroupCreateBody({ name: "x", member_ids: [id(1), id(1)] })?.member_ids, [id(1)]);
  assert.equal(parseGroupCreateBody({ name: "x", member_ids: [id(1), "bad"] }), null);
  const eleven = Array.from({ length: GROUP_MAX_MEMBERS - 1 }, (_, i) => id(i + 1));
  assert.ok(parseGroupCreateBody({ name: "x", member_ids: eleven }));
  assert.equal(parseGroupCreateBody({ name: "x", member_ids: [...eleven, id(99)] }), null);
  assert.equal(parseGroupCreateBody({ name: "x", member_ids: [id(1)], photo_path: "../etc" }), null);
});

test("الرسالة: نصٌّ أو GIF وحدَه أو صورةٌ بتعليق، والاقتباسُ معرّف", () => {
  assert.deepEqual(parseGroupSendBody({ body: " هلا " }), { body: "هلا", gif_id: null, image_path: null, reply_to: null });
  assert.ok(parseGroupSendBody({ body: "", gif_id: "abc123" }));
  assert.equal(parseGroupSendBody({ body: "x", gif_id: "abc123" }), null);
  assert.ok(parseGroupSendBody({ body: "تعليق", image_path: PHOTO }));
  assert.equal(parseGroupSendBody({ body: "", gif_id: "abc", image_path: PHOTO }), null);
  assert.equal(parseGroupSendBody({ body: "  " }), null);
  assert.equal(parseGroupSendBody({ body: "x".repeat(1001) }), null);
  assert.equal(parseGroupSendBody({ body: "x", reply_to: "nope" }), null);
  assert.equal(parseGroupSendBody({ body: "x", reply_to: id(3) })?.reply_to, id(3));
});

test("الإدارة: كلُّ فعلٍ بحقوله وحدها", () => {
  assert.deepEqual(parseGroupManageBody({ action: "read" }), { action: "read" });
  assert.deepEqual(parseGroupManageBody({ action: "leave", x: 1 }), { action: "leave" });
  assert.deepEqual(parseGroupManageBody({ action: "mute", muted: true }), { action: "mute", muted: true });
  assert.equal(parseGroupManageBody({ action: "mute" }), null);
  assert.deepEqual(parseGroupManageBody({ action: "add", member_ids: [id(4)] }), { action: "add", member_ids: [id(4)] });
  assert.equal(parseGroupManageBody({ action: "remove", person_id: "x" }), null);
  assert.deepEqual(parseGroupManageBody({ action: "edit", name: " جديد " }), { action: "edit", name: "جديد", photo_path: null, clear_photo: false });
  assert.deepEqual(parseGroupManageBody({ action: "edit", clear_photo: true }), { action: "edit", name: null, photo_path: null, clear_photo: true });
  assert.equal(parseGroupManageBody({ action: "edit" }), null);
  assert.equal(parseGroupManageBody({ action: "edit", name: "  " }), null);
  assert.equal(parseGroupManageBody({ action: "drop" }), null);
});
