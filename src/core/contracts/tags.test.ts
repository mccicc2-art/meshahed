import { test } from "node:test";
import assert from "node:assert/strict";
import { listTag, postTag, titleTag, uniqueTags, userProfileTag } from "./tags.ts";

/**
 * ====== الوسومُ تُبنى ولا تُكتب بأصابع (Phase 9 §4.3) ======
 *
 * **ولمَ اختبارٌ لسطرٍ من قوالبِ نصوص؟** لأنّ الوسمَ **عقدٌ بين منصّتين**:
 * الويب يترجمه إلى مسار، والتطبيق يطابقه بمفتاح استعلام. **وحرفٌ يختلف بينهما
 * لا يُنتج خطأً — يُنتج شاشةً لا تتحدّث.** فالشكلُ يُثبَّت هنا مرّةً واحدة.
 */

test("شكلُ الوسم ثابتٌ: نوعُ العمل ثمّ المعرّف", () => {
  assert.equal(titleTag("tv", 1399), "title:tv:1399");
  assert.equal(titleTag("movie", 27205), "title:movie:27205");
  assert.equal(listTag("abc-123"), "list:abc-123");
  assert.equal(postTag("k1"), "post:k1");
  assert.equal(userProfileTag("ahmed"), "user:ahmed:profile");
});

test("التكرارُ يُزال — كلُّ وسمٍ زائدٍ جلبٌ زائدٌ على شبكة الجوّال", () => {
  assert.deepEqual(
    uniqueTags(["home", "home", "me:library", titleTag("tv", 1)]),
    ["home", "me:library", "title:tv:1"],
  );
  assert.deepEqual(uniqueTags([]), []);
});
