import { test } from "node:test";
import assert from "node:assert/strict";
import { GOOGLE_STASH_MAX_AGE_MS, googleAuthUrl, parseGoogleReturn, takeStash } from "./googleRedirect.ts";

test("the auth URL asks for an id_token returning to our own page", () => {
  const u = new URL(googleAuthUrl({ clientId: "cid", origin: "https://loopztv.com", state: "s".repeat(32), hashedNonce: "h", locale: "ar" }));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("redirect_uri"), "https://loopztv.com/auth/google");
  assert.equal(u.searchParams.get("response_type"), "id_token");
  assert.equal(u.searchParams.get("nonce"), "h");
  assert.equal(u.searchParams.get("hl"), "ar");
});

test("the return hash gives the token, the state or the error", () => {
  assert.deepEqual(parseGoogleReturn("#state=abc&id_token=t.o.k"), { idToken: "t.o.k", state: "abc", error: null });
  assert.deepEqual(parseGoogleReturn("#error=access_denied&state=abc"), { idToken: null, state: "abc", error: "access_denied" });
  assert.deepEqual(parseGoogleReturn(""), { idToken: null, state: null, error: null });
});

test("the stash is taken only with the same state and while fresh", () => {
  const now = 1_000_000_000;
  const state = "x".repeat(32);
  const raw = JSON.stringify({ state, nonce: "n", next: "/show/1", at: now - 1000 });
  assert.deepEqual(takeStash(raw, state, now), { state, nonce: "n", next: "/show/1", at: now - 1000 });
  assert.equal(takeStash(raw, "y".repeat(32), now), null);
  assert.equal(takeStash(raw, null, now), null);
  assert.equal(takeStash(JSON.stringify({ state, nonce: "n", next: "/", at: now - GOOGLE_STASH_MAX_AGE_MS - 1 }), state, now), null);
  assert.equal(takeStash("not json", state, now), null);
  assert.equal(takeStash(JSON.stringify({ state: "short", nonce: "n", next: "/", at: now }), "short", now), null);
});
