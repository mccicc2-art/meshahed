import { test } from "node:test";
import assert from "node:assert/strict";
import { sortTalkRooms, talkActivity } from "./talkSort.ts";

/** D-1201 — ترتيبُ «النقاشات»: المثبَّتُ أوّلاً في الترتيبين · «الأكثر تفاعلاً» بتفاعل الأسبوع · التعادلُ بالأحدث */
const r = (id: string, postsWeek: number, likesWeek: number, lastAt: string, pin = 0) => ({ id, postsWeek, likesWeek, lastAt, pin });
const rooms = [
  r("old-big", 0, 0, "2026-09-01T00:00:00Z"),
  r("fresh", 1, 0, "2026-09-29T00:00:00Z"),
  r("hot", 3, 9, "2026-09-20T00:00:00Z"),
  r("pinned", 0, 0, "2026-08-01T00:00:00Z", 1),
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

test("latest: pinned first, then newest post", () => {
  assert.deepEqual(ids(sortTalkRooms(rooms, "latest", (x) => x.pin)), ["pinned", "fresh", "hot", "old-big"]);
});

test("active: pinned first, then this week's posts + likes, ties by newest", () => {
  assert.deepEqual(ids(sortTalkRooms(rooms, "active", (x) => x.pin)), ["pinned", "hot", "fresh", "old-big"]);
});

test("activity counts likes; missing likes (before migration 192) count as zero", () => {
  assert.equal(talkActivity({ postsWeek: 3, likesWeek: 9, lastAt: "" }), 12);
  assert.equal(talkActivity({ postsWeek: 3, lastAt: "" }), 3);
});

test("input is not mutated", () => {
  const before = ids(rooms);
  sortTalkRooms(rooms, "active", (x) => x.pin);
  assert.deepEqual(ids(rooms), before);
});
