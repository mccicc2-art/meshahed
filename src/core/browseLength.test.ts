import { test } from "node:test";
import assert from "node:assert/strict";
import { BROWSE_LENGTHS, BROWSE_COUNTRIES, lengthMatches, parseBrowse, splitCountries } from "./browse.ts";

/* 🆕 D-1551 — طولُ العمل: مواسمُ المسلسلات وحلقاتُ الأنمي، والحدُّ الأعلى الفارغ مفتوح */
test("طول العمل: حدود المواسم", () => {
  assert.equal(lengthMatches("s:1-1", 1, 10), true);
  assert.equal(lengthMatches("s:1-1", 2, 20), false);
  assert.equal(lengthMatches("s:2-3", 3, 30), true);
  assert.equal(lengthMatches("s:4-", 9, 90), true);
  assert.equal(lengthMatches("s:4-", 3, 90), false);
});

test("طول العمل: حدود الحلقات بالكور", () => {
  assert.equal(lengthMatches("e:1-12", 1, 12), true);
  assert.equal(lengthMatches("e:13-26", 1, 13), true);
  assert.equal(lengthMatches("e:13-26", 1, 27), false);
  assert.equal(lengthMatches("e:27-100", 1, 100), true);
  /* ون بيس موسمٌ واحدٌ عند TMDB بأكثر من ألف حلقة — يقع في «طويل جداً» لا في «موسم واحد» */
  assert.equal(lengthMatches("e:101-", 1, 1150), true);
});

test("طول العمل: المجهول لا يطابق", () => {
  assert.equal(lengthMatches("s:1-1", undefined, undefined), false);
  assert.equal(lengthMatches("e:1-12", 1, 0), false);
});

test("طول العمل: كلُّ خيارٍ يُقرأ من الرابط ويجعل التصفّح نشطاً", () => {
  for (const x of BROWSE_LENGTHS) {
    const b = parseBrowse({ type: "tv", len: x.slug });
    assert.equal(b.length?.slug, x.slug);
    assert.equal(b.active, true);
  }
  assert.equal(parseBrowse({ type: "tv", len: "nope" }).length, null);
});

test("البلدان: السعودية ثم مصر أوّلاً، ولا بلدَ يضيع ولا يتكرّر", () => {
  const { top, rest } = splitCountries();
  assert.deepEqual(top.slice(0, 2).map((c) => c.code), ["SA", "EG"]);
  assert.equal(top.length + rest.length, BROWSE_COUNTRIES.length);
  assert.equal(new Set([...top, ...rest].map((c) => c.code)).size, BROWSE_COUNTRIES.length);
});
