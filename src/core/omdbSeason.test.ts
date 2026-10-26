import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_EPISODE_LOOKUPS, ratingNumber, readSeasonList } from "./omdbSeason.ts";

/* 🆕 D-1553 — أيُّ حلقةٍ تستحقّ سؤالاً مفرداً من OMDb */
test("تقييم الحلقة: الرقم يُقرأ و«N/A» غياب", () => {
  assert.equal(ratingNumber("8.3"), 8.3);
  assert.equal(ratingNumber("N/A"), null);
  assert.equal(ratingNumber(undefined), null);
  assert.equal(ratingNumber("0"), null);
});

test("قائمة الموسم: الموجود يُؤخذ و«N/A» المعروضة تُسأل", () => {
  const { ratings, missing } = readSeasonList(
    [
      { Episode: "1", imdbRating: "N/A", Released: "2004-09-22" },
      { Episode: "2", imdbRating: "9.1", Released: "2004-09-29" },
      { Episode: "3", imdbRating: "N/A", Released: "2004-10-06" },
    ],
    "2026-10-26",
  );
  assert.deepEqual(ratings, { 2: 9.1 });
  assert.deepEqual(missing, [1, 3]);
});

test("قائمة الموسم: حلقة لم تُعرض بعد لا تُسأل", () => {
  const { missing } = readSeasonList(
    [
      { Episode: "1", imdbRating: "7.5", Released: "2026-10-01" },
      { Episode: "2", imdbRating: "N/A", Released: "2026-11-02" },
      { Episode: "3", imdbRating: "N/A", Released: "N/A" },
    ],
    "2026-10-26",
  );
  assert.deepEqual(missing, []);
});

test("قائمة الموسم: الحلقة الساقطة من القائمة تُسأل، وللأسئلة سقف", () => {
  assert.deepEqual(
    readSeasonList([{ Episode: "1", imdbRating: "8" }, { Episode: "4", imdbRating: "8" }], "2026-10-26").missing,
    [2, 3],
  );
  const many = Array.from({ length: 40 }, (_, i) => ({ Episode: String(i + 1), imdbRating: "N/A", Released: "2000-01-01" }));
  assert.equal(readSeasonList(many, "2026-10-26").missing.length, MAX_EPISODE_LOOKUPS);
});
