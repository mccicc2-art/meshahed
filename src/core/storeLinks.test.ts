import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteCodeFromReferrer, playInviteLink } from "./storeLinks.ts";

test("playInviteLink carries the code in Play's referrer parameter", () => {
  const url = new URL(playInviteLink("ab12"));
  assert.equal(url.searchParams.get("id"), "com.loopztv.app");
  assert.equal(url.searchParams.get("referrer"), "ref=AB12");
});

test("the referrer Play hands back yields the same code", () => {
  const referrer = new URL(playInviteLink("XYZ789")).searchParams.get("referrer");
  assert.equal(inviteCodeFromReferrer(referrer), "XYZ789");
  assert.equal(inviteCodeFromReferrer("ref%3DXYZ789"), "XYZ789");
  assert.equal(inviteCodeFromReferrer("utm_source=x&ref=abc1"), "ABC1");
});

test("an organic install or a malformed code yields nothing", () => {
  assert.equal(inviteCodeFromReferrer("utm_source=google-play&utm_medium=organic"), null);
  assert.equal(inviteCodeFromReferrer(""), null);
  assert.equal(inviteCodeFromReferrer(null), null);
  assert.equal(inviteCodeFromReferrer("ref=ABC-123"), null);
  assert.equal(inviteCodeFromReferrer("ref=TOOLONGCODE1"), null);
});
