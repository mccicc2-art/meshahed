import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseLikeBody,
  parseReplyBody,
  parseFollowUserBody,
  parseRoomPinBody,
  parsePostViewsBody,
  VIEWS_BATCH_MAX,
} from "./communityActs.ts";

/**
 * ====== Phase 11-M · M2 — أجسامُ أفعال «المجتمع» ======
 * القارئُ متسامحٌ مع الزائد صارمٌ مع الناقص: وجهةٌ مجهولةٌ أو مفتاحٌ ناقصٌ ⇒ `null` (`invalid_input`) لا فعلٌ على نصفِ مفتاح.
 */

const U = "5b7c2a9e-1111-4a2b-9c3d-000000000001";

test("الإعجاب: الوجهاتُ الثلاث بمفاتيحها، والناقصُ يسقط", () => {
  assert.deepEqual(parseLikeBody({ target: "review", user_id: U, tmdb_id: 7, media_type: "tv", on: true, x: 1 }), {
    target: "review", user_id: U, tmdb_id: 7, media_type: "tv", on: true,
  });
  assert.deepEqual(parseLikeBody({ target: "post", tmdb_id: 7, media_type: "movie", on: false }), {
    target: "post", tmdb_id: 7, media_type: "movie", on: false,
  });
  assert.deepEqual(parseLikeBody({ target: "list_review", user_id: U, list_id: "L", on: true }), {
    target: "list_review", user_id: U, list_id: "L", on: true,
  });
  assert.equal(parseLikeBody({ target: "review", tmdb_id: 7, media_type: "tv", on: true }), null);
  assert.equal(parseLikeBody({ target: "post", tmdb_id: 7, media_type: "anime", on: true }), null);
  assert.equal(parseLikeBody({ target: "post", tmdb_id: 1.5, media_type: "tv", on: true }), null);
  assert.equal(parseLikeBody({ target: "activity", tmdb_id: 7, media_type: "tv", on: true }), null);
  assert.equal(parseLikeBody({ target: "post", tmdb_id: 7, media_type: "tv" }), null);
});

test("الردّ: الفراغُ يُرفض قبل الرحلة، والطويلُ يُقصّ", () => {
  assert.equal(parseReplyBody({ target: "news", post_key: "n:1", body: "   " }), null);
  assert.deepEqual(parseReplyBody({ target: "news", post_key: "n:1", body: "  hi " }), { target: "news", post_key: "n:1", body: "hi" });
  const long = parseReplyBody({ target: "review", user_id: U, tmdb_id: 3, media_type: "movie", body: "x".repeat(1500) });
  assert.equal(long && long.body.length, 1000);
  assert.equal(parseReplyBody({ target: "review", user_id: U, tmdb_id: 3, body: "a" }), null);
});

test("المتابعة والتثبيت والمشاهدات", () => {
  assert.deepEqual(parseFollowUserBody({ user_id: U, on: false }), { user_id: U, on: false });
  assert.equal(parseFollowUserBody({ user_id: U }), null);
  assert.deepEqual(parseRoomPinBody({ tmdb_id: 9, media_type: "tv", on: true }), { tmdb_id: 9, media_type: "tv", on: true });
  assert.deepEqual(parseRoomPinBody({ tmdb_id: 9, media_type: "tv", on: true, global: true }), { tmdb_id: 9, media_type: "tv", on: true, global: true });
  assert.deepEqual(parseRoomPinBody({ tmdb_id: 9, media_type: "tv", on: true, global: "yes" }), { tmdb_id: 9, media_type: "tv", on: true });
  assert.deepEqual(parsePostViewsBody({ keys: ["c:a", "c:a", 3, "n:b"] }), { keys: ["c:a", "n:b"] });
  assert.equal(parsePostViewsBody({ keys: [] }), null);
  const many = parsePostViewsBody({ keys: Array.from({ length: 90 }, (_, i) => `c:${i}`) });
  assert.equal(many?.keys.length, VIEWS_BATCH_MAX);
});
