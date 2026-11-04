import { test } from "node:test";
import assert from "node:assert/strict";
import { plexRecordsOf, plexServersOf } from "./plexImport.ts";

test("السيرفرات: ما يقدّم «server» وحده، وروابطُ https بترتيب المحلّيّ ثمّ البعيد ثمّ الوسيط", () => {
  const out = plexServersOf([
    { name: "Home", provides: "server", accessToken: "tok", connections: [
      { uri: "https://1-2-3-4.abc.plex.direct:32400", local: false, relay: true },
      { uri: "https://192-168-1-5.abc.plex.direct:32400/", local: true, relay: false },
      { uri: "http://192.168.1.5:32400", local: true, relay: false },
      { uri: "https://9-9-9-9.abc.plex.direct:32400", local: false, relay: false },
    ] },
    { name: "Phone", provides: "client,player", accessToken: "x", connections: [] },
  ]);
  assert.deepEqual(out, [{ name: "Home", token: "tok", uris: [
    "https://192-168-1-5.abc.plex.direct:32400",
    "https://9-9-9-9.abc.plex.direct:32400",
    "https://1-2-3-4.abc.plex.direct:32400",
  ] }]);
});

test("السجلّات: ما شوهد وحده · TMDB بلا مطابقة · IMDb للفيلم · الاسمُ لما سواه · وتاريخُ آخر مشاهدة", () => {
  const recs = plexRecordsOf({
    movies: [
      { type: "movie", title: "Heat", year: 1995, viewCount: 2, lastViewedAt: 1_600_000_000, userRating: 9, Guid: [{ id: "tmdb://949" }] },
      { type: "movie", title: "Arrival", viewCount: 1, Guid: [{ id: "imdb://tt2543164" }] },
      { type: "movie", title: "Unseen", viewCount: 0, Guid: [{ id: "tmdb://1" }] },
      { type: "movie", title: "Local Film", year: 2001, viewCount: 1 },
    ],
    shows: [
      { ratingKey: 10, title: "Dark", Guid: [{ id: "tmdb://70523" }], userRating: 10 },
      { ratingKey: 11, title: "Home Video Show", year: 2010, userRating: 6 },
    ],
    episodes: [
      { grandparentRatingKey: 10, parentIndex: 1, index: 1, viewCount: 1, lastViewedAt: 1_600_000_000 },
      { grandparentRatingKey: 10, parentIndex: 1, index: 2, viewCount: 1 },
      { grandparentRatingKey: 10, parentIndex: 1, index: 3, viewCount: 0 },
      { grandparentRatingKey: 11, parentIndex: 2, index: 4, viewCount: 3 },
    ],
  });
  assert.deepEqual(recs, [
    { kind: "tmdb-movie", tmdbId: 949, title: "Heat", at: "2020-09-13T12:26:40.000Z", rating: 9 },
    { kind: "imdb", imdb: "tt2543164", media: "movie", name: "Arrival", role: "rated", rating: undefined, at: undefined },
    { kind: "movie-name", name: "Local Film", year: 2001, at: undefined, rating: undefined },
    { kind: "ep-name", show: "Home Video Show", year: 2010, s: 2, e: 4, at: undefined },
    { kind: "tmdb-show", tmdbId: 70523, title: "Dark", episodes: [{ s: 1, e: 1, at: "2020-09-13T12:26:40.000Z" }, { s: 1, e: 2, at: undefined }], rating: 10 },
    { kind: "rating-show", show: "Home Video Show", rating: 6 },
  ]);
});
