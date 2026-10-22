import { test } from "node:test";
import assert from "node:assert/strict";
import { imdbEpisodeOf, placeOnTmdb } from "./kitsuEpisode.ts";

/* مدخلاتٌ من جدول الإضافة كما هي (static/data/imdb_mapping.json) */
const bleach = { kitsu_id: 244, imdb_id: "tt0434665", fromSeason: 1, fromEpisode: 1 };
const onePiece = { kitsu_id: 12, imdb_id: "tt0388629", fromSeason: 1, fromEpisode: 1, nonImdbEpisodes: [590] };
const onePieceSpecials = { kitsu_id: 45690, imdb_id: "tt0388629", fromSeason: 0, fromEpisode: 40, imdbEpisodes: [40, 41, 49, 50] };
const deathNote = { kitsu_id: 1376, imdb_id: "tt0877057" };

test("حلقةُ Kitsu في ترقيم IMDb", () => {
  assert.deepEqual(imdbEpisodeOf(bleach, 25), { season: 1, episode: 25 });
  assert.deepEqual(imdbEpisodeOf(deathNote, 7), { season: 1, episode: 7 });
  assert.deepEqual(imdbEpisodeOf({ kitsu_id: 1, fromSeason: 2, fromEpisode: 13 }, 1), { season: 2, episode: 13 });
});

test("nonImdbEpisodes: الحلقةُ نفسُها لا شيء، وما بعدها ينقص واحداً", () => {
  assert.equal(imdbEpisodeOf(onePiece, 590), null);
  assert.deepEqual(imdbEpisodeOf(onePiece, 589), { season: 1, episode: 589 });
  assert.deepEqual(imdbEpisodeOf(onePiece, 591), { season: 1, episode: 590 });
});

test("imdbEpisodes: القائمةُ الصريحة، والفراغُ لا شيء", () => {
  assert.deepEqual(imdbEpisodeOf(onePieceSpecials, 3), { season: 0, episode: 49 });
  assert.equal(imdbEpisodeOf(onePieceSpecials, 5), null);
  assert.equal(imdbEpisodeOf({ kitsu_id: 1092, fromSeason: 0, fromEpisode: 7, imdbEpisodes: [7, null, null] }, 2), null);
  assert.equal(imdbEpisodeOf(bleach, 0), null);
});

const tmdbBleach = [
  { season_number: 0, episode_count: 10 },
  { season_number: 1, episode_count: 366 },
  { season_number: 2, episode_count: 13 },
];

test("على مواسم TMDB: ما يسعه موسمُه يبقى فيه", () => {
  assert.deepEqual(placeOnTmdb(tmdbBleach, { season: 1, episode: 25 }), { season: 1, episode: 25 });
  assert.deepEqual(placeOnTmdb(tmdbBleach, { season: 0, episode: 4 }), { season: 0, episode: 4 });
});

test("الفائضُ يرحل إلى المواسم التالية، والخاصُّ لا يفيض", () => {
  assert.deepEqual(placeOnTmdb(tmdbBleach, { season: 1, episode: 367 }), { season: 2, episode: 1 });
  assert.equal(placeOnTmdb(tmdbBleach, { season: 1, episode: 380 }), null);
  assert.equal(placeOnTmdb(tmdbBleach, { season: 0, episode: 11 }), null);
});

test("موسمٌ لا يعرفه TMDB ⇐ لا شيء", () => {
  assert.equal(placeOnTmdb(tmdbBleach, { season: 4, episode: 6 }), null);
  assert.equal(placeOnTmdb([], { season: 1, episode: 1 }), null);
});
