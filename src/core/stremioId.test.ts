import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStremioVideo, parseSubtitlesVideo, STREMIO_TOKEN_RE } from "./stremioId.ts";

test("فيلمٌ وحلقةٌ بصيغة Cinemeta", () => {
  assert.deepEqual(parseStremioVideo("movie", "tt15239678.json"), { kind: "movie", imdb: "tt15239678" });
  assert.deepEqual(parseStremioVideo("series", "tt0944947:1:5.json"), { kind: "tv", imdb: "tt0944947", season: 1, episode: 5 });
  assert.deepEqual(parseStremioVideo("series", "tt0944947%3A2%3A10.json"), { kind: "tv", imdb: "tt0944947", season: 2, episode: 10 });
  assert.deepEqual(parseStremioVideo("series", "tt0944947:0:3"), { kind: "tv", imdb: "tt0944947", season: 0, episode: 3 });
});

test("ما ليس IMDb أو خارجَ الحدود يُرفض ولا يُخمَّن", () => {
  for (const [type, id] of [
    ["series", "kitsu:1:5.json"],
    ["series", "tmdb:1399:1:5.json"],
    ["series", "tt0944947.json"],
    ["series", "tt0944947:1:0.json"],
    ["series", "tt0944947:1001:1.json"],
    ["series", "tt0944947:1:20001.json"],
    ["series", "tt0944947:a:1.json"],
    ["movie", "tt0944947:1:1.json"],
    ["tv", "tt0944947:1:1.json"],
    ["movie", "%E0%A4%A.json"],
  ] as const) {
    assert.equal(parseStremioVideo(type, id), null, `${type} ${id}`);
  }
});

test("طلبُ الترجمة: المعرّفُ أو videoID في الإضافات", () => {
  const ep = { kind: "tv", imdb: "tt0944947", season: 1, episode: 5 };
  assert.deepEqual(parseSubtitlesVideo("series", ["tt0944947:1:5.json"]), ep);
  assert.deepEqual(parseSubtitlesVideo("series", ["tt0944947:1:5", "videoHash=abc&videoSize=123.json"]), ep);
  assert.deepEqual(parseSubtitlesVideo("series", ["8e245d9679d31e12", "videoID=tt0944947%3A1%3A5&videoSize=1.json"]), ep);
  assert.deepEqual(parseSubtitlesVideo("movie", ["0123abcd", "videoID=tt15239678.json"]), { kind: "movie", imdb: "tt15239678" });
  assert.equal(parseSubtitlesVideo("series", ["8e245d9679d31e12.json"]), null);
  assert.equal(parseSubtitlesVideo("series", ["a", "b", "c"]), null);
  assert.equal(parseSubtitlesVideo("series", ["x", "videoID=kitsu%3A1%3A5.json"]), null);
});

test("شكلُ الرمز", () => {
  assert.ok(STREMIO_TOKEN_RE.test("ls_" + "a".repeat(43)));
  assert.ok(!STREMIO_TOKEN_RE.test("lw_" + "a".repeat(43)));
  assert.ok(!STREMIO_TOKEN_RE.test("ls_" + "a".repeat(42)));
});
