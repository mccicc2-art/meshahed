import { test } from "node:test";
import assert from "node:assert/strict";
import { movieOut, knownUpcoming, releaseToday } from "./release.ts";

/* ١٧ ديسمبر ٢٠٢٦ الساعة ١١ مساءً بغرينتش = ١٨ ديسمبر في UTC+14 */
const NOW = Date.UTC(2026, 11, 17, 23, 0);

test("اليومُ يومُ أوّل منطقةٍ زمنيّة", () => {
  assert.equal(releaseToday(NOW), "2026-12-18");
});

test("يُفتح يومَ العرض وبعده، ويُقفل قبله", () => {
  assert.equal(movieOut("2026-12-18", "Post Production", NOW), true);
  assert.equal(movieOut("2026-12-17", null, NOW), true);
  assert.equal(movieOut("2026-12-19", "Released", NOW), false);
});

test("بلا تاريخ: مقفلٌ ما لم تقل TMDB «Released»", () => {
  assert.equal(movieOut(null, "In Production", NOW), false);
  assert.equal(movieOut("", undefined, NOW), false);
  assert.equal(movieOut(null, "Released", NOW), true);
});

test("قوائمُ الضغط المطوَّل لا تُخفي إلّا تاريخاً معروفاً لم يأتِ", () => {
  assert.equal(knownUpcoming("2026-12-19", NOW), true);
  assert.equal(knownUpcoming("2026-12-18", NOW), false);
  assert.equal(knownUpcoming(null, NOW), false);
  assert.equal(knownUpcoming(undefined, NOW), false);
});
