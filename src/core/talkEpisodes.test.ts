import { test } from "node:test";
import assert from "node:assert/strict";
import { bulletinEpisode, inheritEpisodes, rowsOfEpisode, seasonsOf } from "./talkEpisodes.ts";
import { orderTalk } from "./threadOrder.ts";

/* D-1495 — نقاشُ الحلقات */
test("replies inherit their root's episode, through depth", () => {
  const rows = inheritEpisodes([
    { id: "a", parent_id: null, season: 3, episode: 10 },
    { id: "b", parent_id: "a", season: null, episode: null },
    { id: "c", parent_id: "b", season: null, episode: null },
    { id: "d", parent_id: null, season: null, episode: null },
  ]);
  assert.deepEqual(rows.map((r) => [r.id, r.season, r.episode]), [["a", 3, 10], ["b", 3, 10], ["c", 3, 10], ["d", null, null]]);
});

test("filtering by episode keeps that episode only; null keeps all", () => {
  const rows = [{ season: 3, episode: 10 }, { season: 3, episode: 9 }, { season: null, episode: null }];
  assert.equal(rowsOfEpisode(rows, { season: 3, episode: 10 }).length, 1);
  assert.equal(rowsOfEpisode(rows, null).length, 3);
});

test("bulletin episode and seasons are read defensively", () => {
  assert.deepEqual(bulletinEpisode({ s: 2, e: 5 }), { season: 2, episode: 5 });
  assert.equal(bulletinEpisode({ s: "x" }), null);
  assert.deepEqual(seasonsOf({ seasons: [{ season_number: 0, episode_count: 3 }, { season_number: 2, episode_count: 8 }, { season_number: 1, episode_count: 10 }, { season_number: 3, episode_count: 0 }] }), [
    { season: 1, episodes: 10 },
    { season: 2, episodes: 8 },
  ]);
});

/* D-1496 — «الأحدث ⌄» */
test("orderTalk: newest roots first, replies after in time order; active by weight", () => {
  const rows = [
    { id: "old", parent_id: null, created_at: "2026-10-20T10:00:00Z", likes: 5 },
    { id: "new", parent_id: null, created_at: "2026-10-20T12:00:00Z", likes: 0 },
    { id: "r1", parent_id: "old", created_at: "2026-10-20T11:00:00Z" },
  ];
  assert.deepEqual(orderTalk(rows, "latest").map((r) => r.id), ["new", "old", "r1"]);
  assert.deepEqual(orderTalk(rows, "active").map((r) => r.id), ["old", "new", "r1"]);
});

/* D-1508 — «عام» و«الحلقات» */
import { generalRows, episodeRoomRows, episodeStats, episodeBulletin, latestBulletin, talkEpisodeKey } from "./talkEpisodes.ts";

const room = [
  { id: "b10", parent_id: null, season: 4, episode: 10, bulletin: "Episode 10 is out", created_at: "2026-10-14" },
  { id: "r1", parent_id: "b10", season: 4, episode: 10, bulletin: null, created_at: "2026-10-15" },
  { id: "p1", parent_id: null, season: 4, episode: 10, bulletin: null, created_at: "2026-10-16" },
  { id: "p1r", parent_id: "p1", season: 4, episode: 10, bulletin: null, created_at: "2026-10-17" },
  { id: "b9", parent_id: null, season: 4, episode: 9, bulletin: "Episode 9 is out", created_at: "2026-10-07" },
  { id: "g1", parent_id: null, season: null, episode: null, bulletin: null, created_at: "2026-10-18" },
  { id: "g1r", parent_id: "g1", season: null, episode: null, bulletin: null, created_at: "2026-10-19" },
];

test("general holds people's words with no episode — no bulletins", () => {
  assert.deepEqual(generalRows(room).map((r) => r.id), ["g1", "g1r"]);
});

test("episode room drops its bulletin and lifts replies to it as roots", () => {
  const r = episodeRoomRows(room, { season: 4, episode: 10 });
  assert.deepEqual(r.map((x) => [x.id, x.parent_id]), [["r1", null], ["p1", null], ["p1r", "p1"]]);
});

test("episode stats count roots and replies, latest time, bulletins excluded", () => {
  const s = episodeStats(room);
  assert.deepEqual(s.get(talkEpisodeKey(4, 10)), { count: 3, last: "2026-10-17" });
  assert.equal(s.get(talkEpisodeKey(4, 9)), undefined);
});

test("the episode's bulletin and the latest bulletin", () => {
  assert.equal(episodeBulletin(room, { season: 4, episode: 9 })?.id, "b9");
  assert.equal(episodeBulletin(room, { season: 1, episode: 1 }), null);
  assert.equal(latestBulletin(room)?.id, "b10");
});
