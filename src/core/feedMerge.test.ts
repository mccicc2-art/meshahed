import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeFeedStreams } from "./feedMerge.ts";

const at = (h: number) => ({ updated_at: new Date(Date.UTC(2026, 9, 30, h)).toISOString(), h });

test("no stream full → everything kept, no next page", () => {
  const r = mergeFeedStreams([at(10), at(8)], false, [at(9), at(1)], false);
  assert.equal(r.items.length, 4);
  assert.equal(r.cutoff, null);
});

test("members full → persona rows older than the last member row wait for the next page", () => {
  const r = mergeFeedStreams([at(10), at(8)], true, [at(9), at(5)], false);
  assert.deepEqual(r.items.map((x) => x.h).sort(), [10, 8, 9].sort());
  assert.equal(r.cutoff, at(8).updated_at);
});

test("personas full → member rows older than the last persona row wait", () => {
  const r = mergeFeedStreams([at(10), at(2)], false, [at(9), at(6)], true);
  assert.deepEqual(r.items.map((x) => x.h).sort(), [10, 9, 6].sort());
  assert.equal(r.cutoff, at(6).updated_at);
});

test("both full → the newer of the two edges wins", () => {
  const r = mergeFeedStreams([at(10), at(4)], true, [at(9), at(7)], true);
  assert.equal(r.cutoff, at(7).updated_at);
  assert.ok(r.items.every((x) => x.h >= 7));
});

test("empty persona stream leaves the member page untouched", () => {
  const r = mergeFeedStreams([at(10), at(8)], true, [], false);
  assert.equal(r.items.length, 2);
  assert.equal(r.cutoff, at(8).updated_at);
});
