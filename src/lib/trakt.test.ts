import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { traktAuthorizeUrl, traktConfigured, traktPkce } from "./trakt.ts";

test("PKCE verifier is 43–128 url-safe chars and the challenge is its S256", async () => {
  const { verifier, challenge } = await traktPkce();
  assert.match(verifier, /^[A-Za-z0-9\-_]{43,128}$/);
  const expected = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(challenge, expected);
});

test("two runs never share a verifier", async () => {
  const a = await traktPkce();
  const b = await traktPkce();
  assert.notEqual(a.verifier, b.verifier);
});

test("authorize URL carries the challenge and S256, never a secret", () => {
  process.env.TRAKT_CLIENT_ID = "test-id";
  process.env.TRAKT_CLIENT_SECRET = "should-not-appear";
  const u = new URL(traktAuthorizeUrl("https://loopztv.com/api/trakt/callback", "st", "ch"));
  assert.equal(u.searchParams.get("code_challenge"), "ch");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("client_id"), "test-id");
  assert.equal(u.toString().includes("should-not-appear"), false);
});

test("configured needs only the client id (PKCE apps have no secret)", () => {
  process.env.TRAKT_CLIENT_ID = "test-id";
  delete process.env.TRAKT_CLIENT_SECRET;
  assert.equal(traktConfigured(), true);
  delete process.env.TRAKT_CLIENT_ID;
  assert.equal(traktConfigured(), false);
});
