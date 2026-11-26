import { test } from "node:test";
import assert from "node:assert/strict";
import { ASK_MAX, parseAskItems } from "./deviceLinks.ts";
import { isPlatformSignal, signalSourceLabel, signalSourceOf } from "./stremio.ts";

/* 🆕 T579 — أسئلةُ «شاهدتها؟» من سجلّ المنصّة: ما يصحّ يمرّ، وما لا يصحّ يسقط وحدَه */
test("parseAskItems keeps valid episodes and movies and drops the rest", () => {
  const at = "2026-11-26T10:00:00.000Z";
  const out = parseAskItems([
    { kind: "tv", tmdb_id: 70523, season: 1, episode: 3, at, title: "  Dark  " },
    { kind: "movie", tmdb_id: 550, season: 7, episode: 2, at },
    { kind: "tv", tmdb_id: 1, season: 1, at },
    { kind: "tv", tmdb_id: 1, season: 1, episode: 0, at },
    { kind: "tv", tmdb_id: -4, season: 1, episode: 1, at },
    { kind: "show", tmdb_id: 1, season: 1, episode: 1, at },
    { kind: "movie", tmdb_id: 2, at: "yesterday" },
    null,
  ]);
  assert.deepEqual(out, [
    { kind: "tv", tmdb_id: 70523, season: 1, episode: 3, at, title: "Dark" },
    { kind: "movie", tmdb_id: 550, season: null, episode: null, at, title: null },
  ]);
  assert.deepEqual(parseAskItems("x"), []);
});

test("parseAskItems caps one sync at ASK_MAX", () => {
  const at = "2026-11-26T10:00:00Z";
  const many = Array.from({ length: ASK_MAX + 50 }, (_, i) => ({ kind: "movie", tmdb_id: i + 1, at }));
  assert.equal(parseAskItems(many).length, ASK_MAX);
});

test("platform signal sources are known and named", () => {
  assert.equal(signalSourceOf("netflix"), "netflix");
  assert.equal(signalSourceOf("shahid"), "shahid");
  assert.equal(signalSourceOf("unknown"), "stremio");
  assert.equal(isPlatformSignal("osn"), true);
  assert.equal(isPlatformSignal("kodi"), false);
  assert.equal(signalSourceLabel("shahid", "شاهد"), "شاهد");
  assert.equal(signalSourceLabel("netflix", "شاهد"), "Netflix");
});
