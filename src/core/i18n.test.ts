import { test } from "node:test";
import assert from "node:assert/strict";
import { getDict } from "./i18n.ts";

const ar = getDict("ar");
const en = getDict("en");

test("importDoneBody: العدد يطابق المعدود والصفر يسقط", () => {
  assert.equal(ar.importDoneBody(0, 1, 0), "أُضيف إلى مكتبتك حلقة واحدة.");
  assert.equal(ar.importDoneBody(1, 2, 0), "أُضيف إلى مكتبتك مسلسل واحد وحلقتان.");
  assert.equal(ar.importDoneBody(3, 10, 2), "أُضيف إلى مكتبتك 3 مسلسلات و10 حلقات وفيلمان.");
  assert.equal(ar.importDoneBody(12, 1500, 11), "أُضيف إلى مكتبتك 12 مسلسلاً و1,500 حلقة و11 فيلماً.");
  assert.equal(ar.importDoneBody(0, 0, 0), "لا جديد — مكتبتك محدّثة بالفعل.");
});

test("importDoneBody: English singular/plural and list joining", () => {
  assert.equal(en.importDoneBody(0, 1, 0), "Added 1 episode to your library.");
  assert.equal(en.importDoneBody(1, 0, 2), "Added 1 show and 2 movies to your library.");
  assert.equal(en.importDoneBody(2, 30, 1), "Added 2 shows, 30 episodes and 1 movie to your library.");
  assert.equal(en.importDoneBody(0, 0, 0), "Nothing new — your library is already up to date.");
});
