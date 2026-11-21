import { test } from "node:test";
import assert from "node:assert/strict";
import { countNoun } from "./countNoun.ts";

/* 🆕 T469 — المفردُ لـ١ و٢ و١١ فأكثر، والجمعُ للصفر ومن ٣ إلى ١٠ · 🆕 T502 — ومن ١١ إلى ٩٩ منوَّن */
test("اسم المعدود: العربية", () => {
  assert.equal(countNoun("ar", "shows", 0, "مسلسلات"), "مسلسلات");
  assert.equal(countNoun("ar", "shows", 1, "مسلسلات"), "مسلسل");
  assert.equal(countNoun("ar", "shows", 2, "مسلسلات"), "مسلسل");
  assert.equal(countNoun("ar", "shows", 3, "مسلسلات"), "مسلسلات");
  assert.equal(countNoun("ar", "movies", 10, "أفلام"), "أفلام");
  /* 🆕 T502 — «٧ د»: من ١١ إلى ٩٩ منوَّنٌ منصوب */
  assert.equal(countNoun("ar", "movies", 11, "أفلام"), "فيلمًا");
  assert.equal(countNoun("ar", "shows", 65, "مسلسلات"), "مسلسلًا");
  assert.equal(countNoun("ar", "ratings", 85, "تقييماتي"), "تقييمًا");
  assert.equal(countNoun("ar", "shows", 99, "مسلسلات"), "مسلسلًا");
  assert.equal(countNoun("ar", "movies", 100, "أفلام"), "فيلم");
  assert.equal(countNoun("ar", "movies", 149, "أفلام"), "فيلم");
  /* حكمُ «١ أ»: المفردُ فوق المئة دائماً، لا بآخر رقمين */
  assert.equal(countNoun("ar", "shows", 103, "مسلسلات"), "مسلسل");
});

/* 🆕 T502 — المتابِعون في سطر الملفّ: جمعُهم من القاعدة لا من القاموس */
test("اسم المعدود: المتابِعون", () => {
  assert.equal(countNoun("ar", "followers", 0, "متابِع"), "متابِعين");
  assert.equal(countNoun("ar", "followers", 1, "متابِع"), "متابِع");
  assert.equal(countNoun("ar", "followers", 2, "متابِع"), "متابِع");
  assert.equal(countNoun("ar", "followers", 7, "متابِع"), "متابِعين");
  assert.equal(countNoun("ar", "followers", 20, "متابِع"), "متابِعًا");
  assert.equal(countNoun("ar", "followers", 150, "متابِع"), "متابِع");
  assert.equal(countNoun("en", "followers", 1, "followers"), "follower");
  assert.equal(countNoun("en", "followers", 20, "followers"), "followers");
});

test("اسم المعدود: الإنجليزية كما هي", () => {
  assert.equal(countNoun("en", "shows", 65, "Shows"), "Shows");
  assert.equal(countNoun("en", "ratings", 1, "Ratings"), "Ratings");
});
