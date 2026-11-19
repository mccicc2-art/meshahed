import { test } from "node:test";
import assert from "node:assert/strict";
import { countNoun } from "./countNoun.ts";

/* 🆕 T469 — المفردُ لـ١ و٢ و١١ فأكثر، والجمعُ للصفر ومن ٣ إلى ١٠ */
test("اسم المعدود: العربية", () => {
  assert.equal(countNoun("ar", "shows", 0, "مسلسلات"), "مسلسلات");
  assert.equal(countNoun("ar", "shows", 1, "مسلسلات"), "مسلسل");
  assert.equal(countNoun("ar", "shows", 2, "مسلسلات"), "مسلسل");
  assert.equal(countNoun("ar", "shows", 3, "مسلسلات"), "مسلسلات");
  assert.equal(countNoun("ar", "movies", 10, "أفلام"), "أفلام");
  assert.equal(countNoun("ar", "movies", 11, "أفلام"), "فيلم");
  assert.equal(countNoun("ar", "movies", 149, "أفلام"), "فيلم");
  assert.equal(countNoun("ar", "ratings", 85, "تقييماتي"), "تقييم");
  /* حكمُ «١ أ»: المفردُ فوق المئة دائماً، لا بآخر رقمين */
  assert.equal(countNoun("ar", "shows", 103, "مسلسلات"), "مسلسل");
});

test("اسم المعدود: الإنجليزية كما هي", () => {
  assert.equal(countNoun("en", "shows", 65, "Shows"), "Shows");
  assert.equal(countNoun("en", "ratings", 1, "Ratings"), "Ratings");
});
