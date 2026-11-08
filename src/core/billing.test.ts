import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAY_UPGRADE_GRACE_MS, commissionOf, environmentOf, parseRcBody, partnerExample, rowKeyOf, rowPatchOf, tierOfProduct, userIdOf, type RcEvent } from "./billing.ts";

const NOW = Date.parse("2026-12-01T10:00:00Z");
const UID = "0b6f8c2e-4a1d-4f3e-9c2b-7d5e6f8a9b10";
const ev = (p: Partial<RcEvent>): RcEvent => ({
  id: "e1",
  type: "INITIAL_PURCHASE",
  app_user_id: UID,
  product_id: "plus_yearly",
  environment: "PRODUCTION",
  store: "APP_STORE",
  transaction_id: "t1",
  original_transaction_id: "o1",
  purchased_at_ms: NOW,
  expiration_at_ms: NOW + 365 * 86_400_000,
  price: 26.66,
  tax_percentage: 0.1304,
  commission_percentage: 0.1304,
  ...p,
});

test("الجسم: حدثٌ بمعرّفٍ ونوع، وغيرُه لا شيء", () => {
  assert.equal(parseRcBody({ event: { id: "x", type: "TEST" } })?.type, "TEST");
  assert.equal(parseRcBody({ event: { type: "TEST" } }), null);
  assert.equal(parseRcBody(null), null);
});

test("صاحبُ الحدث: معرّفُ Supabase، والمجهولُ لا يُنسب", () => {
  assert.equal(userIdOf(ev({})), UID);
  assert.equal(userIdOf(ev({ app_user_id: "$RCAnonymousID:abc", aliases: ["$RCAnonymousID:abc", UID] })), UID);
  assert.equal(userIdOf(ev({ app_user_id: "$RCAnonymousID:abc", original_app_user_id: null, aliases: [] })), null);
});

test("البيئةُ والطبقةُ والمفتاح", () => {
  assert.equal(environmentOf(ev({})), "production");
  assert.equal(environmentOf(ev({ environment: "SANDBOX" })), "sandbox");
  assert.equal(tierOfProduct("gold_yearly"), "gold");
  assert.equal(tierOfProduct("loopz_gold:yearly"), "gold");
  assert.equal(tierOfProduct("plus_monthly"), "plus");
  assert.equal(rowKeyOf(ev({})), "app_store:o1");
  assert.equal(rowKeyOf(ev({ original_transaction_id: null, transaction_id: null })), null);
});

test("الصفّ: شراءٌ شغّال · إيقافُ التجديد يكمل مدّته · الاسترجاعُ ينهيه الآن · الانتهاء", () => {
  const buy = rowPatchOf(ev({}), NOW)!;
  assert.equal(buy.status, "active");
  assert.equal(buy.plan, "plus");
  const off = rowPatchOf(ev({ type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" }), NOW)!;
  assert.equal(off.status, "canceled");
  assert.equal(off.current_period_end, new Date(NOW + 365 * 86_400_000).toISOString());
  const refund = rowPatchOf(ev({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", price: -26.66 }), NOW)!;
  assert.equal(refund.status, "expired");
  assert.equal(refund.current_period_end, new Date(NOW).toISOString());
  assert.equal(rowPatchOf(ev({ type: "EXPIRATION" }), NOW)!.status, "expired");
  assert.equal(rowPatchOf(ev({ type: "TEST" }), NOW), null);
});

test("تبديلُ المنتج: الترقيةُ فوريّة، والنزولُ ينتظر التجديد", () => {
  const up = rowPatchOf(ev({ type: "PRODUCT_CHANGE", product_id: "plus_yearly", new_product_id: "gold_yearly" }), NOW, { plan: "plus" })!;
  assert.equal(up.plan, "gold");
  assert.equal(up.product_id, "gold_yearly");
  assert.equal(rowPatchOf(ev({ type: "PRODUCT_CHANGE", product_id: "gold_yearly", new_product_id: "plus_yearly" }), NOW, { plan: "gold" }), null);
  assert.equal(rowPatchOf(ev({ type: "PRODUCT_CHANGE", product_id: "plus_monthly", new_product_id: "plus_yearly" }), NOW, { plan: "plus" }), null);
});

test("T344 + A-51 — ترقيةُ قوقل تُلغي الشراءَ القديم بمهلة (الذهبيُّ يأتي في صفٍّ جديد)", () => {
  const up = (exp: number | null) =>
    rowPatchOf(ev({ type: "PRODUCT_CHANGE", store: "PLAY_STORE", product_id: "loopz_plus:monthly", new_product_id: "loopz_gold:yearly", expiration_at_ms: exp }), NOW, { plan: "plus" })!;
  /* شهرٌ باقٍ: يبقى بلس «أُلغي» مهلةً واحدة — لا مجّانيّاً قبل وصول الذهبيّ، ولا بلس شهراً بعده */
  const old = up(NOW + 30 * 86_400_000);
  assert.equal(old.status, "canceled");
  assert.equal(old.plan, "plus");
  assert.equal(old.product_id, "loopz_plus:monthly");
  assert.equal(old.cancel_at_period_end, true);
  assert.equal(old.current_period_end, new Date(NOW + PLAY_UPGRADE_GRACE_MS).toISOString());
  /* نهايتُه قبل المهلة: إليها لا بعدها */
  assert.equal(up(NOW + 60_000).current_period_end, new Date(NOW + 60_000).toISOString());
  /* بلا نهايةٍ في الحدث: المهلةُ وحدها */
  assert.equal(up(null).current_period_end, new Date(NOW + PLAY_UPGRADE_GRACE_MS).toISOString());
  /* نهايتُه مضت: يُختم منتهياً الآن كما كان */
  const past = up(NOW - 1);
  assert.equal(past.status, "expired");
  assert.equal(past.current_period_end, new Date(NOW).toISOString());
  /* وأبل تُبقي الشراءَ نفسَه: الصفُّ يُرقّى في مكانه ويبقى نشطاً */
  const apple = rowPatchOf(ev({ type: "PRODUCT_CHANGE", store: "APP_STORE", product_id: "plus_yearly", new_product_id: "gold_yearly" }), NOW, { plan: "plus" })!;
  assert.equal(apple.status, "active");
  assert.equal(apple.plan, "gold");
  /* والنزولُ في قوقل كما في أبل: لا يُمسّ */
  assert.equal(rowPatchOf(ev({ type: "PRODUCT_CHANGE", store: "PLAY_STORE", product_id: "loopz_gold:yearly", new_product_id: "loopz_plus:monthly" }), NOW, { plan: "gold" }), null);
});

test("العمولة: ٢٥٪ من الصافي في السنة الأولى، والاسترجاعُ يعكسها، والتجربةُ لا شيء", () => {
  const c = commissionOf(ev({}), NOW)!;
  /* ٢٦٫٦٦$ × ٣٫٧٥ = ٩٩٫٩٨ ريال · صافٍ بعد ٢٦٫٠٨٪ ≈ ٧٣٫٩١ · عمولةٌ ≈ ١٨٫٤٨ */
  assert.equal(c.kind, "earned");
  assert.ok(Math.abs(c.net - 73.9) < 0.05, String(c.net));
  assert.ok(Math.abs(c.amount - 18.48) < 0.02, String(c.amount));
  assert.equal(c.key, "app_store:t1:earned");
  const back = commissionOf(ev({ type: "CANCELLATION", price: -26.66 }), NOW)!;
  assert.equal(back.kind, "reversed");
  assert.ok(back.amount < 0);
  assert.notEqual(back.key, c.key);
  assert.equal(commissionOf(ev({ environment: "SANDBOX" }), NOW), null);
  assert.equal(commissionOf(ev({ price: 0 }), NOW), null);
  /* بعد السنة الأولى لا عمولة، ولا مرساةَ لا عمولة */
  assert.equal(commissionOf(ev({ purchased_at_ms: NOW + 366 * 86_400_000 }), NOW), null);
  assert.equal(commissionOf(ev({}), null), null);
});

test("مثالُ صفحة الشريك: ٩٩٫٩٩ ⇢ ٧٣٫٩١ ⇢ ١٨٫٤٨", () => {
  assert.deepEqual(partnerExample(99.99), { net: 73.91, commission: 18.48 });
});
