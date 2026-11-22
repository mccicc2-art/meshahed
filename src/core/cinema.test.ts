import { test } from "node:test";
import assert from "node:assert/strict";
import { cinemaFresh, cinemaKey, cinemaOrigin, cinemaStatus, pickCinemaMatch, riyadhToday } from "./cinema.ts";

test("origin comes from TMDB, not from the cinema's dubbing label", () => {
  assert.equal(cinemaOrigin({ original_language: "ar", origin_country: [] }), "arabic");
  assert.equal(cinemaOrigin({ original_language: "en", origin_country: ["EG"] }), "arabic");
  /* «القطّ في القبّعة» مدبلجاً: الصالةُ تكتب Arabic والفيلمُ أجنبيّ */
  assert.equal(cinemaOrigin({ original_language: "en", origin_country: ["US"] }, ["Arabic"]), "foreign");
  assert.equal(cinemaOrigin({ original_language: "hi", origin_country: ["IN"] }), "foreign");
});

test("without TMDB data the site languages decide, and mixed versions read foreign", () => {
  assert.equal(cinemaOrigin(null, ["Arabic"]), "arabic");
  assert.equal(cinemaOrigin(null, ["عربي"]), "arabic");
  assert.equal(cinemaOrigin(null, ["Arabic", "English"]), "foreign");
  assert.equal(cinemaOrigin(null, []), "foreign");
});

test("a coming-soon film moves to now on its Saudi release day", () => {
  assert.equal(cinemaStatus({ status: "soon", release_date: "2026-11-26" }, "2026-11-25"), "soon");
  assert.equal(cinemaStatus({ status: "soon", release_date: "2026-11-26" }, "2026-11-26"), "now");
  assert.equal(cinemaStatus({ status: "soon", release_date: null }, "2030-01-01"), "soon");
  assert.equal(cinemaStatus({ status: "now", release_date: "2027-01-01" }, "2026-11-26"), "now");
});

test("Riyadh's day turns three hours before UTC's", () => {
  assert.equal(riyadhToday(new Date("2026-11-25T20:59:00Z")), "2026-11-25");
  assert.equal(riyadhToday(new Date("2026-11-25T21:00:00Z")), "2026-11-26");
});

test("a row stays live for three days after the latest reading", () => {
  assert.equal(cinemaFresh("2026-11-25", "2026-11-25"), true);
  assert.equal(cinemaFresh("2026-11-22", "2026-11-25"), true);
  assert.equal(cinemaFresh("2026-11-18", "2026-11-25"), false);
});

test("the key ignores case, punctuation, accents and & versus and", () => {
  assert.equal(cinemaKey("Dune: Part Three"), cinemaKey("dune part three"));
  assert.equal(cinemaKey("Fast & Furious"), cinemaKey("Fast and Furious"));
  assert.equal(cinemaKey("Amélie"), cinemaKey("Amelie"));
  assert.equal(cinemaKey("حدوتة"), "حدوتة");
});

test("matching is strict: same name, a sane year window, most popular wins", () => {
  const hits = [
    { id: 1, title: "Crypto", release_date: "2019-04-12", popularity: 9 },
    { id: 2, title: "Crypto", release_date: "2026-10-30", popularity: 4 },
    { id: 3, title: "Crypto Kids", release_date: "2026-10-30", popularity: 50 },
  ];
  assert.equal(pickCinemaMatch(hits, "Crypto", 2026)?.id, 2);
  assert.equal(pickCinemaMatch(hits, "Unknown film", 2026), null);
  /* الاسمُ الأصليّ يكفي */
  assert.equal(pickCinemaMatch([{ id: 7, title: "The Ministers Door", original_title: "Ala Bab Alwazer", release_date: "2026-11-01" }], "Ala Bab Alwazer", 2026)?.id, 7);
  /* بلا تاريخ: اسمٌ قصيرٌ يُرفض وطويلٌ يُقبل */
  assert.equal(pickCinemaMatch([{ id: 8, title: "Hadoota" }], "Hadoota", 2026), null);
  assert.equal(pickCinemaMatch([{ id: 9, title: "Matloub 3a2eleyain" }], "Matloub 3a2eleyain", 2026)?.id, 9);
  /* العرضُ السعوديُّ متأخّرٌ سنتين يُقبل، وفيلمٌ بالاسم نفسه بعد سنتين يُرفض */
  assert.equal(pickCinemaMatch([{ id: 12, title: "Late One", release_date: "2024-05-01" }], "Late One", 2026)?.id, 12);
  assert.equal(pickCinemaMatch([{ id: 13, title: "Far One", release_date: "2028-05-01" }], "Far One", 2026), null);
  /* بين المتطابقين في النافذة: الأشهر */
  assert.equal(
    pickCinemaMatch([{ id: 10, title: "Avatar", release_date: "2026-12-18", popularity: 1 }, { id: 11, title: "Avatar", release_date: "2025-12-19", popularity: 80 }], "Avatar", 2026)?.id,
    11,
  );
});
