import { test } from "node:test";
import assert from "node:assert/strict";
import { read, stripComments } from "./source.ts";
import { FEED_COMMENT_KINDS, FEED_NEWS_KINDS } from "../../src/core/communityFeed.ts";

/**
 * ====== Phase 11-M · M0 — عقدُ «المجتمع» بين الصفحة والباب ======
 * (١) **جردُ أنواع البطاقات** (خطّة §٧): نوعٌ يُضاف إلى `lib/data` ولا يُضاف إلى الجرد يختفي
 * من خطّ التطبيق بلا خطأ — هنا يكسر `npm test`.
 * (٢) **مصدرٌ واحد**: الصفحةُ والبابُ يقرآن `buildCommunity`، والترتيبُ `orderCommunityFeed`،
 * ولا يعود أحدُهما إلى نداءات الخطّ بيده (نسخةٌ ثانيةٌ تفترق).
 */

const DATA = stripComments(read("src/lib/data.ts"));
const quoted = (s: string) => [...s.matchAll(/"([\w_]+)"/g)].map((m) => m[1]).sort();

test("أنواعُ صفوف الرأي في الجرد = `FeedKind`", () => {
  const m = /export type FeedKind\s*=([^;]*);/.exec(DATA);
  assert.ok(m, "لم يُعثر على FeedKind");
  assert.deepEqual(quoted(m[1]), [...FEED_COMMENT_KINDS].sort());
});

test("أنواعُ أخبار لوبز في الجرد = `LoopzNewsItem.kind`", () => {
  const m = /export interface LoopzNewsItem\s*\{[\s\S]*?kind:([\s\S]*?);/.exec(DATA);
  assert.ok(m, "لم يُعثر على LoopzNewsItem.kind");
  assert.deepEqual(quoted(m[1]), [...FEED_NEWS_KINDS].sort());
});

test("الصفحةُ والبابُ يقرآن النواةَ نفسَها", () => {
  const page = stripComments(read("src/app/people/page.tsx"));
  const route = stripComments(read("src/app/api/v1/community/route.ts"));
  const all = stripComments(read("src/app/api/v1/community/people/route.ts"));
  const feed = stripComments(read("src/components/ActivityFeed.tsx"));
  const payload = stripComments(read("src/lib/communityPayload.ts"));
  for (const [name, src] of [["page", page], ["route", route], ["people", all]] as const) {
    assert.match(src, /\bbuildCommunity\(/, `${name} لا يقرأ buildCommunity`);
    assert.doesNotMatch(src, /\bgetCommunityFeed\(|\bgetTalkRooms\(|\bgetPeopleLeaderboard\(/, `${name} يعيد نداءات النواة بيده`);
  }
  assert.match(feed, /\borderCommunityFeed\(/, "ActivityFeed لا يرتّب بالنواة");
  assert.match(payload, /\borderCommunityFeed[<(]/, "الحمولةُ لا ترتّب بالنواة");
  assert.doesNotMatch(feed, /LIKE_MS\s*=/, "صيغةُ الترتيب نُسخت في ActivityFeed");
});
