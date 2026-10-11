import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { appleClientSecret, appleExchange, appleIdTokenSub, appleRevoke, normalizePem, APPLE_REVOKE_URL, APPLE_TOKEN_URL, type ApplePost } from "./appleSecret.ts";

const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const KEY = { teamId: "TEAM123456", keyId: "KEY1234567", privateKey: pem, clientId: "com.loopztv.app" };

const part = (jwt: string, i: number) => JSON.parse(Buffer.from(jwt.split(".")[i], "base64url").toString("utf8"));

test("apple client secret: the header and claims Apple requires", () => {
  const jwt = appleClientSecret(KEY, 1_800_000_000);
  assert.equal(jwt.split(".").length, 3);
  assert.deepEqual(part(jwt, 0), { alg: "ES256", kid: "KEY1234567", typ: "JWT" });
  assert.deepEqual(part(jwt, 1), { iss: "TEAM123456", iat: 1_800_000_000, exp: 1_800_000_300, aud: "https://appleid.apple.com", sub: "com.loopztv.app" });
});

test("apple client secret: a raw r||s signature that verifies with the public key", () => {
  const jwt = appleClientSecret(KEY, 1_800_000_000);
  const [h, p, s] = jwt.split(".");
  const sig = Buffer.from(s, "base64url");
  /* ES256 في JWT = ٦٤ بايتاً بالضبط؛ DER كان يأتي ٧٠–٧٢ */
  assert.equal(sig.length, 64);
  assert.equal(verify("sha256", Buffer.from(`${h}.${p}`), { key: pair.publicKey, dsaEncoding: "ieee-p1363" }, sig), true);
});

test("apple client secret: a key pasted on one line with literal \\n still signs", () => {
  const oneLine = pem.trim().replace(/\n/g, "\\n");
  assert.equal(normalizePem(oneLine), pem.trim());
  assert.equal(appleClientSecret({ ...KEY, privateKey: normalizePem(oneLine) }, 1).split(".").length, 3);
});

test("apple id token: sub is read, junk is null", () => {
  const body = Buffer.from(JSON.stringify({ sub: "001234.abcdef.5678", email: "x@privaterelay.appleid.com" })).toString("base64url");
  assert.equal(appleIdTokenSub(`a.${body}.c`), "001234.abcdef.5678");
  assert.equal(appleIdTokenSub("not-a-jwt"), null);
  assert.equal(appleIdTokenSub(`a.${Buffer.from("{}").toString("base64url")}.c`), null);
  assert.equal(appleIdTokenSub(undefined), null);
});

const idToken = (sub: string) => `h.${Buffer.from(JSON.stringify({ sub })).toString("base64url")}.s`;
/** ناقلٌ مزيّف: يحفظ ما أُرسل ويردّ بما قيل له */
function fake(reply: { status: number; json: Record<string, unknown> | null }) {
  const sent: { url: string; fields: Record<string, string> }[] = [];
  const post: ApplePost = async (url, fields) => {
    sent.push({ url, fields });
    return reply;
  };
  return { post, sent };
}

test("apple exchange: sends what Apple expects and keeps the refresh token of the same Apple user", async () => {
  const f = fake({ status: 200, json: { refresh_token: "r.abc", id_token: idToken("001.sub") } });
  const out = await appleExchange(KEY, "code-1", "001.sub", f.post, 1_800_000_000);
  assert.deepEqual(out, { ok: true, refresh: "r.abc" });
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].url, APPLE_TOKEN_URL);
  const { client_secret, ...rest } = f.sent[0].fields;
  assert.deepEqual(rest, { client_id: "com.loopztv.app", code: "code-1", grant_type: "authorization_code" });
  assert.equal(part(client_secret, 1).sub, "com.loopztv.app");
});

test("apple exchange: a code for another Apple account is not kept", async () => {
  const f = fake({ status: 200, json: { refresh_token: "r.abc", id_token: idToken("999.other") } });
  assert.deepEqual(await appleExchange(KEY, "code-1", "001.sub", f.post), { ok: false, why: "mismatch", detail: "" });
});

test("apple exchange: refusals and empty answers are 'rejected', never a token", async () => {
  assert.deepEqual(await appleExchange(KEY, "c", "s", fake({ status: 400, json: { error: "invalid_grant" } }).post), { ok: false, why: "rejected", detail: "400 invalid_grant" });
  assert.equal((await appleExchange(KEY, "c", "s", fake({ status: 200, json: { id_token: idToken("s") } }).post)).ok, false);
  assert.equal((await appleExchange(KEY, "c", "s", fake({ status: 200, json: null }).post)).ok, false);
});

test("apple revoke: refresh token with its hint; only 200 counts", async () => {
  const f = fake({ status: 200, json: null });
  assert.deepEqual(await appleRevoke(KEY, "r.abc", f.post), { ok: true, detail: "200" });
  assert.equal(f.sent[0].url, APPLE_REVOKE_URL);
  assert.equal(f.sent[0].fields.token, "r.abc");
  assert.equal(f.sent[0].fields.token_type_hint, "refresh_token");
  assert.equal(f.sent[0].fields.client_id, "com.loopztv.app");
  assert.equal((await appleRevoke(KEY, "r.abc", fake({ status: 400, json: { error: "invalid_client" } }).post)).ok, false);
});
