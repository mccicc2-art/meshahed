import { test } from "node:test";
import assert from "node:assert/strict";
import { placeKitsuEpisode } from "./kitsuEpisode.ts";

/* Bleach في TMDB: موسمٌ من ٣٦٦ ثمّ «حرب الألف عام»، ومواسمُ خاصّة (٠) لا تُعدّ */
const bleach = [
  { season_number: 0, episode_count: 10 },
  { season_number: 1, episode_count: 366 },
  { season_number: 2, episode_count: 13 },
];

test("الرقمُ التسلسليُّ يغلب ترقيمَ IMDb حين تختلف القسمة", () => {
  /* IMDb «م٢ ح٥» = الحلقة ٢٥ في السلسلة ⇐ TMDB «م١ ح٢٥» لا «م٢ ح٥» */
  assert.deepEqual(placeKitsuEpisode(bleach, { imdbSeason: 2, imdbEpisode: 5, absoluteEpisode: 25 }), { season: 1, episode: 25 });
  assert.deepEqual(placeKitsuEpisode(bleach, { imdbSeason: 17, imdbEpisode: 1, absoluteEpisode: 367 }), { season: 2, episode: 1 });
});

test("القسمةُ نفسُها في الطرفين تعطي الجوابَ نفسَه", () => {
  const split = [{ season_number: 1, episode_count: 24 }, { season_number: 2, episode_count: 23 }];
  assert.deepEqual(placeKitsuEpisode(split, { imdbSeason: 2, imdbEpisode: 3, absoluteEpisode: 27 }), { season: 2, episode: 3 });
});

test("بلا رقمٍ تسلسليّ: ترقيمُ IMDb بشرط أن يسعه TMDB", () => {
  assert.deepEqual(placeKitsuEpisode(bleach, { imdbSeason: 0, imdbEpisode: 4 }), { season: 0, episode: 4 });
  assert.deepEqual(placeKitsuEpisode(bleach, { imdbSeason: 2, imdbEpisode: 5 }), { season: 2, episode: 5 });
  assert.equal(placeKitsuEpisode(bleach, { imdbSeason: 2, imdbEpisode: 14 }), null);
  assert.equal(placeKitsuEpisode(bleach, { imdbSeason: 9, imdbEpisode: 1 }), null);
  assert.equal(placeKitsuEpisode(bleach, {}), null);
});

test("أبعدُ ممّا يعرفه TMDB ينزل إلى IMDb أو لا شيء", () => {
  assert.equal(placeKitsuEpisode(bleach, { absoluteEpisode: 500 }), null);
  assert.deepEqual(placeKitsuEpisode(bleach, { imdbSeason: 2, imdbEpisode: 1, absoluteEpisode: 500 }), { season: 2, episode: 1 });
  assert.equal(placeKitsuEpisode([], { imdbSeason: 1, imdbEpisode: 1, absoluteEpisode: 1 }), null);
});
