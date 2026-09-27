import { test } from "node:test";
import assert from "node:assert/strict";
import { err, httpStatus, ok, type ErrorCode } from "./result.ts";

/**
 * ====== K6b — شكلُ النتيجة عقدٌ بين الخادم والتطبيق ======
 *
 * التطبيقُ (`apps/mobile/src/api.ts`) يحكم على الردّ بسطرٍ واحد: **`"error" in json`** ⇒ فشل، وإلّا
 * `{ data, invalidates }`. و`401` وحدَه يطلق إعادةَ طلب الرمز. فما يُثبَّت هنا: كلُّ صنفِ خطأٍ له رمزُ HTTP،
 * و`unauthenticated` هو `401` لا غير، والنجاحُ لا يحمل `error` أبداً، والفشلُ لا يحمل `data`.
 */

const CODES: ErrorCode[] = [
  "unauthenticated",
  "forbidden",
  "not_found",
  "invalid_input",
  "rate_limited",
  "conflict",
  "upstream",
  "internal",
];

test("كلُّ صنفِ خطأٍ له رمزُ HTTP خطأ (٤xx/٥xx) — ولا صنفَ بلا رمز", () => {
  assert.deepEqual(Object.keys(httpStatus).sort(), [...CODES].sort());
  for (const c of CODES) assert.ok(httpStatus[c] >= 400 && httpStatus[c] < 600, c);
});

test("`unauthenticated` = 401 وحدَه — عليه يعيد التطبيقُ طلبَ الرمز", () => {
  assert.equal(httpStatus.unauthenticated, 401);
  assert.deepEqual(CODES.filter((c) => httpStatus[c] === 401), ["unauthenticated"]);
  assert.equal(httpStatus.rate_limited, 429);
});

test("النجاحُ: `data` + `invalidates` (فارغةٌ في القراءة) — بلا `error`", () => {
  const r = ok({ k2: true });
  assert.deepEqual(r, { ok: true, data: { k2: true }, invalidates: [] });
  assert.ok(!("error" in r));
  assert.deepEqual(ok(1, ["home"]).invalidates, ["home"]);
});

test("الفشلُ: `error.code` + `error.message_key` (مفتاحٌ لا نصّ) — بلا `data`", () => {
  const r = err("rate_limited", "apiRateLimited", { retry_after_ms: 3000 });
  assert.deepEqual(r, { ok: false, error: { code: "rate_limited", message_key: "apiRateLimited", retry_after_ms: 3000 } });
  assert.ok(!("data" in r));
  assert.match(r.error.message_key, /^[a-zA-Z]+$/);
});
