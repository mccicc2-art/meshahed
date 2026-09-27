import { test } from "node:test";
import assert from "node:assert/strict";
import { authVerdict, formatVerdict, type AuthRow } from "./authVerdict.ts";

/**
 * ====== K6a — الحكمُ على سجلٍّ حقيقيّ ======
 * الصفوفُ من سجلّ Supabase صباحَ ٢٧ سبتمبر (جوال خالد): خمسُ دوراتِ خروجٍ/دخولٍ بمحاولتين قبل D-1160، ثمّ
 * دورةٌ بمحاولةٍ واحدةٍ بعده. **إن لم يرَ الحكمُ ذلك العطلَ في بياناته هو فلن يراه غداً.**
 */
const day = (t: string) => `2026-09-27 ${t}`;
const L = (t: string): AuthRow => ({ t: day(t), ev: "logout" });
const A = (t: string): AuthRow => ({ t: day(t), ev: "authorize" });
const P = (t: string): AuthRow => ({ t: day(t), ev: "pkce" });

const SEPT27: AuthRow[] = [
  L("09:56:56"), A("09:56:58"), P("09:57:03"), A("09:57:05"), P("09:57:10"),
  L("10:08:25"), A("10:08:27"), P("10:08:32"), A("10:08:33"), P("10:08:38"),
  L("10:22:13"), A("10:22:15"), P("10:22:20"), A("10:22:23"), P("10:22:27"),
  L("10:23:02"), A("10:23:05"), P("10:23:09"), A("10:23:11"), P("10:23:22"),
  L("10:41:46"), A("10:41:49"), P("10:41:56"), A("10:43:03"), P("10:43:09"),
  L("10:59:28"), A("10:59:29"), P("10:59:34"),
];

test("٢٧ سبتمبر: خمسُ محاولاتٍ مزدوجةٍ تسقط، والأخيرةُ بعد D-1160 تنجح", () => {
  const eps = authVerdict(SEPT27);
  assert.deepEqual(
    eps.map((e) => e.verdict),
    ["FAIL:repeat", "FAIL:repeat", "FAIL:repeat", "FAIL:repeat", "FAIL:repeat", "PASS"],
  );
  assert.deepEqual(eps[5], { start: day("10:59:28"), logouts: 1, windows: 1, pkce: 1, verdict: "PASS" });
  assert.match(formatVerdict(eps), /— 1\/6 PASS$/);
});

test("الترتيبُ لا يُفترض: صفوفٌ مبعثرةٌ تُرتَّب بالوقت أوّلاً", () => {
  const shuffled = [...SEPT27].reverse();
  assert.deepEqual(authVerdict(shuffled), authVerdict(SEPT27));
});

test("خروجان متقاربان بلا دخولٍ بينهما = خروجٌ بضغطتين (عطلُ ما قبل D-1156)", () => {
  const eps = authVerdict([L("11:00:00"), L("11:00:06"), A("11:00:10"), P("11:00:15")]);
  assert.equal(eps.length, 1);
  assert.equal(eps[0].logouts, 2);
  assert.equal(eps[0].verdict, "FAIL:double-logout");
});

test("خروجان متباعدان حلقتان — ولا دخولَ بعد الأوّل ليس فشلاً", () => {
  const eps = authVerdict([L("11:00:00"), L("11:05:00"), A("11:05:03"), P("11:05:08")]);
  assert.deepEqual(eps.map((e) => e.verdict), ["no-login", "PASS"]);
  assert.match(formatVerdict(eps), /— 1\/1 PASS$/);
});

test("نافذةُ Google بلا تبادل = دخولٌ لم يكتمل (أُلغي أو ضاع الرابط)", () => {
  assert.equal(authVerdict([L("12:00:00"), A("12:00:02")])[0].verdict, "FAIL:no-exchange");
});

test("دخولٌ بلا خروجٍ قبله (أوّلُ النافذة) يُحكم وحدَه، ويقبل ISO", () => {
  const eps = authVerdict([
    { t: "2026-09-28T08:00:00.000", ev: "authorize" },
    { t: "2026-09-28T08:00:05Z", ev: "pkce" },
  ]);
  assert.deepEqual(eps, [{ start: "2026-09-28T08:00:00.000", logouts: 0, windows: 1, pkce: 1, verdict: "PASS" }]);
});

test("لا صفوف ⇒ لا حلقات", () => {
  assert.deepEqual(authVerdict([]), []);
  assert.equal(formatVerdict([]), "— 0/0 PASS");
});
