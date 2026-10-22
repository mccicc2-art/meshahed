import { test } from "node:test";
import assert from "node:assert/strict";
import { fribbEpisodeOf, imdbEpisodeOf, matchByAirDate, placeOnTmdb } from "./kitsuEpisode.ts";

test("جدولُ Fribb: رقمُ TMDB والموسمُ والإزاحة، وبلا موسمٍ عاديٍّ لا شيء", () => {
  /* مدخلُ «حرب الألف عام — الجزء الرابع» كما هو في anime-list-full.json */
  const tybw4 = { kitsu_id: 49444, themoviedb_id: { tv: 30984 }, season: { tvdb: 17, tmdb: 2 }, episode_offset: { tvdb: 40, tmdb: 40 } };
  assert.deepEqual(fribbEpisodeOf(tybw4, 1), { tmdbId: 30984, at: { season: 2, episode: 41 } });
  assert.deepEqual(fribbEpisodeOf(tybw4, 4), { tmdbId: 30984, at: { season: 2, episode: 44 } });
  assert.deepEqual(fribbEpisodeOf({ kitsu_id: 244, themoviedb_id: { tv: 30984 }, season: { tmdb: 1 } }, 7), { tmdbId: 30984, at: { season: 1, episode: 7 } });
  assert.equal(fribbEpisodeOf({ kitsu_id: 1, themoviedb_id: { tv: 5 } }, 1), null);
  assert.equal(fribbEpisodeOf({ kitsu_id: 1, themoviedb_id: { tv: 5 }, season: { tmdb: 0 } }, 1), null);
  assert.equal(fribbEpisodeOf({ kitsu_id: 1, season: { tmdb: 1 } }, 1), null);
  assert.equal(fribbEpisodeOf(tybw4, 0), null);
});

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

test("تاريخُ العرض: حلقةٌ واحدةٌ في اليوم أو قبله أو بعده، والازدواجُ لا شيء", () => {
  const tybw = [
    { season: 1, episode: 40, air_date: "2025-12-27" },
    { season: 1, episode: 41, air_date: "2026-07-04" },
    { season: 1, episode: 42, air_date: "2026-07-11" },
    { season: 0, episode: 1, air_date: "2026-07-04" },
  ];
  assert.deepEqual(matchByAirDate(tybw, "2026-07-04"), { season: 1, episode: 41 });
  assert.deepEqual(matchByAirDate(tybw, "2026-07-10"), { season: 1, episode: 42 });
  assert.equal(matchByAirDate(tybw, "2026-08-01"), null);
  assert.equal(matchByAirDate([...tybw, { season: 1, episode: 43, air_date: "2026-07-11" }], "2026-07-11"), null);
  assert.equal(matchByAirDate(tybw, "not-a-date"), null);
});
