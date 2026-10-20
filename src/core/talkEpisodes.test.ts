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
