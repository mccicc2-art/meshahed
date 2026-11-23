import { test } from "node:test";
import assert from "node:assert/strict";
import { countNoun } from "./countNoun.ts";

/* 🆕 T529 — كلمةٌ ثابتةٌ بعد أيِّ عدد (نقضُ قاعدة T469/T502 بحكم أحمد ٢٣ نوفمبر) */
test("اسم المعدود: العربية ثابتة", () => {
  for (const n of [0, 1, 2, 3, 10, 11, 65, 99, 100, 150]) {
    assert.equal(countNoun("ar", "shows", n, "مسلسلات"), "مسلسل");
    assert.equal(countNoun("ar", "movies", n, "أفلام"), "فيلم");
    assert.equal(countNoun("ar", "ratings", n, "تقييماتي"), "تقييم");
    assert.equal(countNoun("ar", "followers", n, "المتابِعون"), "المتابِعون");
  }
});

test("اسم المعدود: الإنجليزية كما هي", () => {
  assert.equal(countNoun("en", "shows", 65, "Shows"), "Shows");
  assert.equal(countNoun("en", "ratings", 1, "Ratings"), "Ratings");
  assert.equal(countNoun("en", "followers", 1, "followers"), "follower");
  assert.equal(countNoun("en", "followers", 20, "followers"), "followers");
});
