import { test } from "node:test";
import assert from "node:assert/strict";
import { mustUpdate, versionBelow } from "./appConfig.ts";

const store = { ios: "https://apps.apple.com/app/id1", android: "https://play.google.com/store/apps/details?id=x" };

test("versionBelow compares dotted numbers part by part", () => {
  assert.equal(versionBelow("1.14.1", "1.15.0"), true);
  assert.equal(versionBelow("1.15.0", "1.15.0"), false);
  assert.equal(versionBelow("1.15", "1.15.0"), false);
  assert.equal(versionBelow("1.9.9", "1.10.0"), true);
  assert.equal(versionBelow("2.0.0", "1.99.99"), false);
});

test("an older binary on a platform with a minimum gets its store link", () => {
  const c = { min_versions: { ios: "1.15.0", android: null }, store_url: store };
  assert.equal(mustUpdate(c, "ios", "1.14.1"), store.ios);
});

test("each platform decides alone: Android is not forced by the iPhone number", () => {
  const c = { min_versions: { ios: "1.15.0", android: null }, store_url: store };
  assert.equal(mustUpdate(c, "android", "1.14.1"), null);
});

test("the new version, a missing number, a missing link or no reply forces nothing", () => {
  assert.equal(mustUpdate({ min_versions: { ios: "1.15.0", android: "1.15.0" }, store_url: store }, "ios", "1.15.0"), null);
  assert.equal(mustUpdate({ min_versions: { ios: null, android: null }, store_url: store }, "ios", "1.0.0"), null);
  assert.equal(mustUpdate({ min_versions: { ios: "1.15.0", android: "1.15.0" }, store_url: { ios: null, android: null } }, "ios", "1.0.0"), null);
  assert.equal(mustUpdate(null, "android", "1.0.0"), null);
  /* ردٌّ من خادمٍ قديمٍ بلا الحقل الجديد */
  assert.equal(mustUpdate({ store_url: store } as never, "android", "1.0.0"), null);
});
