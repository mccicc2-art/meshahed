import { test } from "node:test";
import assert from "node:assert/strict";
import { aiRankByOverview } from "./ai.ts";

const items = Array.from({ length: 5 }, (_, i) => ({ title: `T${i + 1}`, year: "2018", overview: `A long enough synopsis number ${i + 1} about something specific.` }));
const reply = (text: string, status = 200) =>
  (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status })) as unknown as typeof fetch;

test("rank: no key → null", async () => {
  delete process.env.GEMINI_API_KEY;
  assert.equal(await aiRankByOverview("x", items), null);
});
test("rank: full permutation is used", async () => {
  process.env.GEMINI_API_KEY = "test";
  globalThis.fetch = reply("[5,1,2,3,4]");
  assert.deepEqual(await aiRankByOverview("x", items), [4, 0, 1, 2, 3]);
});
test("rank: fenced, partial and dirty answer is completed in original order", async () => {
  globalThis.fetch = reply("```json\n[5, 5, 99, \"2\", 3]\n```");
  assert.deepEqual(await aiRankByOverview("x", items), [4, 1, 2, 0, 3]);
});
test("rank: too short or unreadable → null", async () => {
  globalThis.fetch = reply("[5]");
  assert.equal(await aiRankByOverview("x", items), null);
  globalThis.fetch = reply("sorry");
  assert.equal(await aiRankByOverview("x", items), null);
});
test("rank: upstream failure → null", async () => {
  globalThis.fetch = reply("[]", 500);
  assert.equal(await aiRankByOverview("x", items), null);
});
test("rank: fewer than two synopses → null without a call", async () => {
  let called = 0;
  globalThis.fetch = (async () => { called++; return new Response("{}"); }) as unknown as typeof fetch;
  assert.equal(await aiRankByOverview("x", items.map((i) => ({ ...i, overview: "" }))), null);
  assert.equal(called, 0);
});
