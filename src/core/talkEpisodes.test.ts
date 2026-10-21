import { test } from "node:test";
import assert from "node:assert/strict";
import { airedEpisodes, bulletinEpisode, episodeTitle, roomAiring, inheritEpisodes, rowsOfEpisode, seasonsOf } from "./talkEpisodes.ts";
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

/* R52 — الحلقاتُ تقف عند آخر ما عُرض */
test("seasonsOf stops at the last aired episode", () => {
  const seasons = [{ season_number: 1, episode_count: 170 }, { season_number: 2, episode_count: 26 }, { season_number: 3, episode_count: 12 }];
  assert.deepEqual(seasonsOf({ seasons, last_episode_to_air: { season_number: 2, episode_number: 3 } }), [
    { season: 1, episodes: 170 },
    { season: 2, episodes: 3 },
  ]);
  assert.deepEqual(seasonsOf({ seasons, last_episode_to_air: null }), []);
  assert.equal(seasonsOf({ seasons }).length, 3);
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

/* R54 — «الأكثر نشاطاً»: الردُّ باثنين */
test("orderTalk active: a reply weighs two likes", () => {
  const rows = [
    { id: "liked", parent_id: null, created_at: "2026-10-20T10:00:00Z", likes: 3 },
    { id: "talked", parent_id: null, created_at: "2026-10-20T09:00:00Z", likes: 0 },
    { id: "k1", parent_id: "talked", created_at: "2026-10-20T11:00:00Z" },
    { id: "k2", parent_id: "talked", created_at: "2026-10-20T11:05:00Z" },
  ];
  assert.deepEqual(orderTalk(rows, "active").map((r) => r.id).slice(0, 2), ["talked", "liked"]);
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

/* 🆕 R56 — أرقامُ TMDB الكلّيّة (ون بيس) وما عُرض فقط، والعنوانُ المكرّرُ من الرقم يسقط */
test("airedEpisodes keeps TMDB numbers, drops unaired, newest first", () => {
  const eps = [
    { episode_number: 1156, air_date: "2026-04-05" },
    { episode_number: 1180, air_date: "2026-09-27" },
    { episode_number: 1181, air_date: "2026-10-25" },
    { episode_number: 1182, air_date: null },
  ];
  assert.deepEqual(airedEpisodes(eps, "2026-10-21").map((e) => e.episode_number), [1180, 1156]);
});

test("episodeTitle hides names that only repeat the number", () => {
  assert.equal(episodeTitle("الحلقة 1156"), null);
  assert.equal(episodeTitle("Episode 12"), null);
  assert.equal(episodeTitle("  "), null);
  assert.equal(episodeTitle(null), null);
  assert.equal(episodeTitle("The Battle Begins"), "The Battle Begins");
  assert.equal(episodeTitle("الحلقة الأخيرة"), "الحلقة الأخيرة");
});

test("roomAiring: out on the air day or the day after, next from the library, recent bulletin alone", () => {
  const b = (air: string) => ({ s: 23, e: 1180, air });
  assert.deepEqual(roomAiring(b("2026-10-21"), "2026-10-28", "2026-10-21"), { next: "2026-10-28", out: 1180 });
  assert.deepEqual(roomAiring(b("2026-10-20"), null, "2026-10-21"), { next: null, out: 1180 });
  assert.deepEqual(roomAiring(b("2026-10-15"), "2026-10-26", "2026-10-21"), { next: "2026-10-26", out: null });
  assert.deepEqual(roomAiring(b("2026-10-10"), null, "2026-10-21"), { next: null, out: null });
  /* 🆕 R57 — ١٥–٦٠ يوماً بلا موعد: «On break» (ون بيس ٢٧ سبتمبر)، وبعد الستّين لا شارة */
  assert.deepEqual(roomAiring(b("2026-09-27"), null, "2026-10-21"), { next: null, out: null, pause: true });
  assert.deepEqual(roomAiring(b("2026-10-06"), "2026-09-22", "2026-10-21"), { next: null, out: null, pause: true });
  assert.equal(roomAiring(b("2026-08-01"), null, "2026-10-21"), null);
  assert.equal(roomAiring(null, "2026-10-01", "2026-10-21"), null);
  assert.deepEqual(roomAiring(null, "2026-11-02", "2026-10-21"), { next: "2026-11-02", out: null });
});
