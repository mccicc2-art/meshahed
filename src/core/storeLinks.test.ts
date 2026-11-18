import { test } from "node:test";
import assert from "node:assert/strict";
import { androidOpenLink, inviteCodeFromReferrer, inviteCodeFromText, inviteShareLink, playInviteLink } from "./storeLinks.ts";

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

test("the link the invite page copies reads back as its code", () => {
  assert.equal(inviteShareLink("7ysj89cu"), "https://loopztv.com/join/7YSJ89CU");
  assert.equal(inviteCodeFromText(inviteShareLink("7YSJ89CU")), "7YSJ89CU");
  assert.equal(inviteCodeFromText("جرّب Loopz https://loopztv.com/p/ab12cd معي"), "AB12CD");
  assert.equal(inviteCodeFromText("loopztv.com/invite/LOOPZX"), "LOOPZX");
  assert.equal(inviteCodeFromText(" 7ysj89cu "), "7YSJ89CU");
});

test("clipboard text that is not an invite yields nothing", () => {
  assert.equal(inviteCodeFromText(""), null);
  assert.equal(inviteCodeFromText(null), null);
  assert.equal(inviteCodeFromText("hello"), null);
  assert.equal(inviteCodeFromText("ahmed", true), "AHMED");
  assert.equal(inviteCodeFromText("0551234567"), null);
  assert.equal(inviteCodeFromText("https://example.com/join/AB12"), null);
  assert.equal(inviteCodeFromText("loopztv.com/join/TOOLONGCODE1"), null);
});

test("androidOpenLink opens the app by its scheme and falls back to the given page", () => {
  const link = androidOpenLink("7ysj-89cu", "https://groups.google.com/g/loopz-testers");
  assert.equal(
    link,
    "intent://join/7YSJ89CU#Intent;scheme=com.loopztv.app;package=com.loopztv.app;S.browser_fallback_url=https%3A%2F%2Fgroups.google.com%2Fg%2Floopz-testers;end",
  );
});
