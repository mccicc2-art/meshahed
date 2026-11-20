import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { episodesFromHistory, pickOAuthError, traktAuthorizeUrl, traktConfigured, traktHeaders, traktPkce } from "./trakt.ts";

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

test("authorize goes to auth.trakt.tv", () => {
  process.env.TRAKT_CLIENT_ID = "test-id";
  const u = new URL(traktAuthorizeUrl("https://loopztv.com/api/trakt/callback", "st", "ch"));
  assert.equal(u.host, "auth.trakt.tv");
});

test("every request carries Trakt's required headers; bearer only when a token is given", () => {
  process.env.TRAKT_CLIENT_ID = "test-id";
  const h = traktHeaders();
  assert.equal(h["trakt-api-key"], "test-id");
  assert.equal(h["trakt-api-version"], "2");
  assert.match(h["user-agent"], /^Loopz\//);
  assert.equal(h["content-type"], "application/json");
  assert.equal("authorization" in h, false);
  assert.equal(traktHeaders("tok").authorization, "Bearer tok");
});

test("history → episodes: rewatches fold onto the latest date, non-episodes and bad rows are dropped", () => {
  const eps = episodesFromHistory([
    { type: "episode", watched_at: "2026-11-01T10:00:00.000Z", episode: { season: 1, number: 1 } },
    { type: "episode", watched_at: "2026-11-18T10:00:00.000Z", episode: { season: 1, number: 1 } },
    { type: "episode", watched_at: "2026-11-02T10:00:00.000Z", episode: { season: 1, number: 2 } },
    { type: "movie", watched_at: "2026-11-02T10:00:00.000Z" },
    { type: "episode", episode: { season: 1 } },
  ]);
  assert.deepEqual(
    eps.sort((a, b) => a.e - b.e),
    [
      { s: 1, e: 1, at: "2026-11-18T10:00:00.000Z" },
      { s: 1, e: 2, at: "2026-11-02T10:00:00.000Z" },
    ],
  );
});

test("history → episodes keeps a watch with no date (the import stamps it)", () => {
  assert.deepEqual(episodesFromHistory([{ type: "episode", episode: { season: 0, number: 3 } }]), [{ s: 0, e: 3, at: undefined }]);
});

test("A-70: pickOAuthError keeps only a short OAuth error code", () => {
  assert.equal(pickOAuthError({ error: "invalid_grant", error_description: "free text" }), "invalid_grant");
  assert.equal(pickOAuthError({ error: "invalid_client" }), "invalid_client");
  assert.equal(pickOAuthError({ error: "Bad Request with spaces" }), "-");
  assert.equal(pickOAuthError({ error: 42 }), "-");
  assert.equal(pickOAuthError({ message: "x" }), "-");
  assert.equal(pickOAuthError(null), "-");
  assert.equal(pickOAuthError("invalid_grant"), "-");
});
