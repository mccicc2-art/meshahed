import { test } from "node:test";
import assert from "node:assert/strict";
import { orderThread, buildTree, countUnder, canReplyTo, MAX_DEPTH } from "./threadOrder.ts";
import { parseThreadReplyBody, parseThreadReportBody, parseThreadVoteBody, parseThreadTarget } from "./threadActs.ts";

/**
 * ====== Phase 11-M · M3 — ترتيبُ الخيط وشجرتُه وأجسامُ أفعاله ======
 * القواعدُ منقولةٌ من `ThreadReplies` حرفاً: الزمنُ · الأصواتُ للجذور · Plus أوّلاً في الرأي · العمقُ ٣ · الأبُ الغائبُ يرفع ابنَه جذراً.
 */

const r = (id: string, at: number, extra: { parent?: string; score?: number; plan?: string } = {}) => ({
  id,
  parent_id: extra.parent ?? null,
  created_at: new Date(Date.UTC(2026, 8, 1, 0, at)).toISOString(),
  score: extra.score ?? 0,
  person: { plan: extra.plan ?? null },
});

test("الغرفة: الجذورُ بالأصوات والأبناءُ بعدها بالزمن", () => {
  const rows = [r("a", 1, { score: 1 }), r("b", 2, { score: 5 }), r("c", 3, { parent: "a" }), r("d", 4, { score: 5 })];
  assert.deepEqual(orderThread(rows, { votes: true, plusFirst: false }).map((x) => x.id), ["b", "d", "a", "c"]);
});

test("الرأي: جذورُ Plus أوّلاً، ولا شيءَ يتغيّر إن كانوا كلُّهم من صنفٍ واحد", () => {
  const rows = [r("a", 1), r("b", 2, { plan: "plus" }), r("c", 3, { parent: "a" })];
  assert.deepEqual(orderThread(rows, { votes: false, plusFirst: true }).map((x) => x.id), ["b", "a", "c"]);
  assert.deepEqual(orderThread([r("x", 2), r("y", 1)], { votes: false, plusFirst: true }).map((x) => x.id), ["y", "x"]);
});

test("الشجرة: العمقُ يُحسب، والأبُ الغائبُ يرفع ابنَه جذراً، وغيرُ المتداخلة كلُّها جذور", () => {
  const rows = [r("a", 1), r("b", 2, { parent: "a" }), r("c", 3, { parent: "b" }), r("d", 4, { parent: "gone" })];
  const t = buildTree(rows, true);
  assert.deepEqual(t.roots.map((x) => x.id), ["a", "d"]);
  assert.equal(t.depth.get("c"), 2);
  assert.equal(countUnder(t, "a"), 2);
  assert.equal(buildTree(rows, false).roots.length, 4);
});

test("الردّ: حتى العمق ٣ في الغرفة، وتحت الجذر وحدَه في غيرها", () => {
  assert.equal(canReplyTo(r("a", 1), MAX_DEPTH - 1, true), true);
  assert.equal(canReplyTo(r("a", 1), MAX_DEPTH, true), false);
  assert.equal(canReplyTo(r("a", 1), 0, false), true);
  assert.equal(canReplyTo(r("b", 1, { parent: "a" }), 1, false), false);
});

test("أجسامُ الأفعال: الصورةُ والـGIF والحرقُ للغرفة وحدَها، والفارغُ يُرفض", () => {
  const talk = { kind: "talk", tmdb_id: 1, media_type: "tv" };
  assert.deepEqual(parseThreadReplyBody({ target: talk, body: " ", gif_id: "abc" }), {
    target: talk, body: "", parent_id: null, has_spoiler: false, image_url: null, gif_id: "abc",
  });
  assert.equal(parseThreadReplyBody({ target: talk, body: "  " }), null);
  const post = parseThreadReplyBody({ target: { kind: "post", key: "n:1" }, body: "hi", gif_id: "abc", has_spoiler: true });
  assert.equal(post?.gif_id, null);
  assert.equal(post?.has_spoiler, false);
  assert.equal(parseThreadTarget({ kind: "review", tmdb_id: 1, media_type: "tv" }), null);
  assert.deepEqual(parseThreadReportBody({ target: { kind: "review", user_id: "u", tmdb_id: 1, media_type: "movie" }, what: "review" })?.what, "review");
  assert.equal(parseThreadReportBody({ target: talk, what: "review" }), null);
  assert.equal(parseThreadVoteBody({ post_id: "p", vote: 2, tmdb_id: 1, media_type: "tv" }), null);
  assert.equal(parseThreadVoteBody({ post_id: "p", vote: -1, tmdb_id: 1, media_type: "tv" })?.vote, -1);
});
