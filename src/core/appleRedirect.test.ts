import { test } from "node:test";
import assert from "node:assert/strict";
import { appleAuthUrl, appleNameOf, appleOriginFor, readApplePending } from "./appleRedirect.ts";

test("the Apple URL uses the web client, form_post and our return page", () => {
  const u = new URL(appleAuthUrl({ origin: "https://loopztv.com", state: "s".repeat(32), hashedNonce: "h", locale: "ar" }));
  assert.equal(u.origin + u.pathname, "https://appleid.apple.com/auth/authorize");
  assert.equal(u.searchParams.get("client_id"), "com.loopztv.web");
  assert.equal(u.searchParams.get("redirect_uri"), "https://loopztv.com/auth/apple");
  assert.equal(u.searchParams.get("response_mode"), "form_post");
  assert.equal(u.searchParams.get("response_type"), "code id_token");
  assert.equal(u.searchParams.get("nonce"), "h");
});

test("only the two registered origins return to themselves", () => {
  assert.equal(appleOriginFor("https://loopztv.com"), "https://loopztv.com");
  assert.equal(appleOriginFor("https://www.loopztv.com"), "https://www.loopztv.com");
  assert.equal(appleOriginFor("https://meshahed.vercel.app"), null);
  assert.equal(appleOriginFor("https://evil.example"), null);
});

test("the pending cookie is read only in its shape", () => {
  const ok = JSON.stringify({ s: "a".repeat(32), n: "b".repeat(32), next: "/show/1" });
  assert.deepEqual(readApplePending(ok), { s: "a".repeat(32), n: "b".repeat(32), next: "/show/1" });
  assert.equal(readApplePending(JSON.stringify({ s: "short", n: "b".repeat(32), next: "/" })), null);
  assert.equal(readApplePending("not json"), null);
  assert.equal(readApplePending(undefined), null);
});

test("the first-sign-in name is joined, cleaned and capped", () => {
  assert.equal(appleNameOf(JSON.stringify({ name: { firstName: " Ahmed ", lastName: "Ali\n" } })), "Ahmed Ali");
  assert.equal(appleNameOf(JSON.stringify({ name: { firstName: "x".repeat(60) } })).length, 40);
  assert.equal(appleNameOf("{bad"), "");
  assert.equal(appleNameOf(undefined), "");
});
