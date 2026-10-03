import { test } from "node:test";
import assert from "node:assert/strict";
import { episodeDisplayName, episodeWordName, isGenericEpisodeName } from "./episodeName.ts";

/** D-1255 — الاسمُ العامُّ «الحلقة N» يُكتب بالحروف حتى ٢٠ وبلغة القارئ؛ الحقيقيُّ لا يُمسّ */
test("بالحروف حتى ٢٠ ثمّ رقم", () => {
  assert.equal(episodeWordName(1, "ar"), "الحلقة الأولى");
  assert.equal(episodeWordName(11, "ar"), "الحلقة الحادية عشرة");
  assert.equal(episodeWordName(20, "ar"), "الحلقة العشرون");
  assert.equal(episodeWordName(21, "ar"), "الحلقة 21");
  assert.equal(episodeWordName(1, "en"), "Episode One");
  assert.equal(episodeWordName(20, "en"), "Episode Twenty");
  assert.equal(episodeWordName(1156, "en"), "Episode 1156");
});

test("العامُّ: فارغ، أو «حلقة» + رقمُ الحلقة نفسُه — باللغتين", () => {
  assert.equal(isGenericEpisodeName("الحلقة 1", 1), true);
  assert.equal(isGenericEpisodeName("Episode 1", 1), true);
  assert.equal(isGenericEpisodeName("episode #12", 12), true);
  assert.equal(isGenericEpisodeName("حلقة 3", 3), true);
  assert.equal(isGenericEpisodeName("", 4), true);
  assert.equal(isGenericEpisodeName(null, 4), true);
});

test("الحقيقيُّ لا يُمسّ: اسمٌ، أو رقمٌ لا يطابق، أو كلامٌ بعد الرقم", () => {
  assert.equal(isGenericEpisodeName("Black Widower", 1), false);
  assert.equal(isGenericEpisodeName("Episode 3", 5), false);
  assert.equal(isGenericEpisodeName("Episode 1: Pilot", 1), false);
  assert.equal(episodeDisplayName("Toil and Till", 2, "ar"), "Toil and Till");
});

test("العامُّ يُعاد بلغة القارئ لا بلغة النسخة التي وصل بها (D-1254)", () => {
  assert.equal(episodeDisplayName("الحلقة 1", 1, "en"), "Episode One");
  assert.equal(episodeDisplayName("Episode 2", 2, "ar"), "الحلقة الثانية");
  assert.equal(episodeDisplayName("Episode 45", 45, "ar"), "الحلقة 45");
});

test("«Episode 3» عنواناً فعليّاً (سجلٌّ فيه وصفٌ أو صورة) يبقى كما هو — طلبُ أحمد", () => {
  assert.equal(isGenericEpisodeName("Episode 3", 3, { overview: "The team regroups.", still_path: null }), false);
  assert.equal(isGenericEpisodeName("Episode 3", 3, { overview: "", still_path: "/abc.jpg" }), false);
  assert.equal(episodeDisplayName("Episode 3", 3, "ar", { overview: "The team regroups." }), "Episode 3");
  /* سجلٌّ لم يُملأ: اسمٌ مؤقّت */
  assert.equal(episodeDisplayName("Episode 3", 3, "en", { overview: "", still_path: null }), "Episode Three");
});

test("«الحلقة N» العربيّة عامّةٌ دائماً — غيابُ ترجمةٍ لا عنوان", () => {
  assert.equal(episodeDisplayName("الحلقة 3", 3, "ar", { overview: "وصف", still_path: "/x.jpg" }), "الحلقة الثالثة");
});
