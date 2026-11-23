import { test } from "node:test";
import assert from "node:assert/strict";
import { DB_TIMEOUT_MS, withDefaultTimeout } from "./dbFetch.ts";

test("a call with no signal gets a timeout signal", async () => {
  let seen: RequestInit | undefined;
  const f = withDefaultTimeout((async (_i: RequestInfo | URL, init?: RequestInit) => {
    seen = init;
    return new Response("ok");
  }) as typeof fetch);
  await f("https://example.test/rest/v1/x", { method: "POST", headers: { a: "1" } });
  assert.ok(seen?.signal instanceof AbortSignal);
  assert.equal(seen?.method, "POST");
  assert.deepEqual(seen?.headers, { a: "1" });
});

test("a caller's own signal is kept untouched", async () => {
  const own = new AbortController().signal;
  let seen: RequestInit | undefined;
  const f = withDefaultTimeout((async (_i: RequestInfo | URL, init?: RequestInit) => {
    seen = init;
    return new Response("ok");
  }) as typeof fetch);
  await f("https://example.test/", { signal: own });
  assert.equal(seen?.signal, own);
});

test("a stalled call is aborted after the timeout", async () => {
  const f = withDefaultTimeout(((_i: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    })) as typeof fetch, 20);
  // مؤقّتُ AbortSignal.timeout لا يُبقي العمليّةَ حيّة — مؤقّتٌ عاديّ يُبقيها حتى ينتهي الاختبار
  const keep = setTimeout(() => {}, 1_000);
  try {
    await assert.rejects(f("https://example.test/"), (e: Error) => e.name === "TimeoutError");
  } finally {
    clearTimeout(keep);
  }
});

test("the default stays above the database's own member statement timeout (8 s)", () => {
  assert.ok(DB_TIMEOUT_MS > 8_000);
  assert.ok(DB_TIMEOUT_MS < 300_000);
});
