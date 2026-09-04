import { test } from "node:test";
import assert from "node:assert/strict";
import { platformFromUA } from "./platform.ts";

/**
 * **الحالاتُ المثبَّتةُ هنا هي التي تكسر الترتيبَ إن قُلب** — لا عيّناتٌ
 * للزينة: **وسمُ أندرويد الحيُّ يقول `Linux`**، **ووسمُ الآيباد يقول
 * `Mac OS X`** — وكلاهما مأخوذٌ من `auth.sessions` في الإنتاج (٥ سبتمبر).
 */
test("أندرويد لا يُقرأ لينكس رغم أنّ وسمَه يقول Linux", () => {
  assert.equal(
    platformFromUA(
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36",
    ),
    "android",
  );
});

test("الآيفون لا يُقرأ ماك رغم أنّ وسمَه يقول Mac OS X", () => {
  assert.equal(
    platformFromUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile Safari/604.1",
    ),
    "ios",
  );
});

test("وسمُ التطبيق يُقرأ قبل كلِّ شيء", () => {
  assert.equal(platformFromUA("okhttp/4.12.0"), "android");
  assert.equal(platformFromUA("Loopz/1.0 CFNetwork/1568 Darwin/24.0.0"), "ios");
});

test("ويندوز وماك ولينكس", () => {
  assert.equal(platformFromUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152"), "windows");
  assert.equal(platformFromUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605"), "mac");
  assert.equal(platformFromUA("Mozilla/5.0 (X11; Ubuntu; Linux x86_64) Firefox/131.0"), "linux");
});

test("الغائبُ والمجهولُ «أخرى» — لا تخمين", () => {
  assert.equal(platformFromUA(null), "other");
  assert.equal(platformFromUA(""), "other");
  assert.equal(platformFromUA("node"), "other");
});
