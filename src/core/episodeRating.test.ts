import { test } from "node:test";
import assert from "node:assert/strict";
import { TMDB_EPISODE_MIN_VOTES, episodeTmdbFallback } from "./episodeRating.ts";

/* 🆕 D-1554 — بديلُ TMDB لتقييم الحلقة */
test("تقييم الحلقة: IMDb يغلب دائماً", () => {
  assert.equal(episodeTmdbFallback(8.3, true, 9.1, 500), null);
});

test("تقييم الحلقة: لا بديل حين لا نعرف إن كان لـIMDb رقم", () => {
  assert.equal(episodeTmdbFallback(null, false, 8.0, 500), null);
});

test("تقييم الحلقة: عتبة الأصوات", () => {
  assert.equal(TMDB_EPISODE_MIN_VOTES, 30);
  assert.equal(episodeTmdbFallback(null, true, 8.04, 30), 8);
  assert.equal(episodeTmdbFallback(undefined, true, 7.86, 31), 7.9);
  assert.equal(episodeTmdbFallback(null, true, 10, 29), null);
  assert.equal(episodeTmdbFallback(null, true, 8, undefined), null);
});

test("تقييم الحلقة: صفرُ TMDB غيابٌ لا رقم", () => {
  assert.equal(episodeTmdbFallback(null, true, 0, 100), null);
});
