import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLoopzNames, collectEnglish } from "./loopzNames.ts";
import { parseTitleMode, resolveMediaTitle, sampleNames, TITLE_MODES, TITLE_SAMPLES } from "./titleMode.ts";

const arList = {
  page: 1,
  results: [
    { id: 1, name: "صراع العروش", original_name: "Game of Thrones", original_language: "en" },
    { id: 2, name: "عوالم خفية", original_name: "عوالم خفية", original_language: "ar" },
    { id: 3, name: "هجوم العمالقة", original_name: "進撃の巨人", original_language: "ja" },
    { id: 3, title: "فيلمٌ بالرقم نفسِه", original_title: "기생충", original_language: "ko" },
    { id: 4, name: "الموسم 1", episode_count: 10 },
  ],
};
const enList = {
  results: [
    { id: 1, name: "Game of Thrones", original_name: "Game of Thrones", original_language: "en" },
    { id: 2, name: "Hidden Secret", original_name: "عوالم خفية", original_language: "ar" },
    { id: 3, name: "Attack on Titan", original_name: "進撃の巨人", original_language: "ja" },
    { id: 3, title: "Parasite", original_title: "기생충", original_language: "ko" },
  ],
};

test("Arabic response: English name for foreign works, Arabic works keep Arabic, movie and tv with the same id stay apart", () => {
  const out = applyLoopzNames(arList, collectEnglish(enList));
  assert.deepEqual(
    out.results.map((r) => ("title" in r ? r.title : r.name)),
    ["Game of Thrones", "عوالم خفية", "Attack on Titan", "Parasite", "الموسم 1"],
  );
});

test("the input is not mutated (it is shared between concurrent requests)", () => {
  const before = JSON.stringify(arList);
  applyLoopzNames(arList, collectEnglish(enList));
  assert.equal(JSON.stringify(arList), before);
});

test("English response needs no second call: only the Arabic work changes", () => {
  const out = applyLoopzNames(enList, null);
  assert.deepEqual(
    out.results.map((r) => ("title" in r ? r.title : r.name)),
    ["Game of Thrones", "عوالم خفية", "Attack on Titan", "Parasite"],
  );
});

test("the English call failed: English-language works still get their original, others keep the row's name", () => {
  const out = applyLoopzNames(arList, new Map());
  assert.equal(out.results[0].name, "Game of Thrones");
  assert.equal(out.results[2].name, "هجوم العمالقة");
});

test("works nested in a details response are corrected too; seasons are untouched", () => {
  const details = {
    id: 3, name: "هجوم العمالقة", original_name: "進撃の巨人", original_language: "ja",
    seasons: [{ id: 9, name: "الموسم 1" }],
    recommendations: { results: [{ id: 1, name: "صراع العروش", original_name: "Game of Thrones", original_language: "en" }] },
  };
  const out = applyLoopzNames(details, new Map([["t:3", "Attack on Titan"]]));
  assert.equal(out.name, "Attack on Titan");
  assert.equal(out.seasons[0].name, "الموسم 1");
  assert.equal(out.recommendations.results[0].name, "Game of Thrones");
});

test("the default mode is loopz, it is listed first, and the removed mode falls to it", () => {
  assert.equal(TITLE_MODES[0], "loopz");
  assert.equal(parseTitleMode(undefined), "loopz");
  assert.equal(parseTitleMode("both"), "loopz");
  assert.equal(parseTitleMode("original"), "original");
});

test("preview samples: loopz and original differ only on the Japanese title, in both locales", () => {
  for (const locale of ["ar", "en"] as const) {
    const loopz = TITLE_SAMPLES.map((s) => resolveMediaTitle(sampleNames(s, locale), "loopz").primary);
    assert.deepEqual(loopz, ["Game of Thrones", "عوالم خفية", "Attack on Titan"]);
    const original = TITLE_SAMPLES.map((s) => resolveMediaTitle(sampleNames(s, locale), "original").primary);
    assert.deepEqual(original, ["Game of Thrones", "عوالم خفية", "進撃の巨人"]);
  }
});

test("a live row arrives already corrected: loopz shows it as is, one line", () => {
  assert.deepEqual(resolveMediaTitle({ localized: "Attack on Titan", original: "進撃の巨人" }, "loopz"), { primary: "Attack on Titan", secondary: null });
  assert.deepEqual(resolveMediaTitle({ localized: "عوالم خفية", original: "عوالم خفية" }, "loopz"), { primary: "عوالم خفية", secondary: null });
});

test("the other modes are unchanged", () => {
  const n = { localized: "صراع العروش", original: "Game of Thrones", translit: "جيم أوف ثرونز" };
  assert.equal(resolveMediaTitle(n, "localized").primary, "صراع العروش");
  assert.equal(resolveMediaTitle(n, "original").primary, "Game of Thrones");
  assert.equal(resolveMediaTitle(n, "translit").primary, "جيم أوف ثرونز");
});
