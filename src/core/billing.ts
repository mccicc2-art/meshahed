/**
 * ====== 🆕 الاشتراكاتُ من RevenueCat — المنطقُ الخالص (خطّةُ Loopz+ v2 §9 المرحلة ١، هجرة ٢٣٨) ======
 *
 * 🔑 **حدثٌ واحدٌ ⇐ صفٌّ واحدٌ في `subscriptions`** لكلِّ شراءٍ عند المتجر (`store:original_transaction_id`)، والمرآةُ في
 * القاعدة تعيد حسابَ الخطّة من صفوف العضو كلِّها — فلا يحتاج الخادمُ أن يعرف «هل صار بلس؟»، يكتب ما قاله المتجر وحده.
 *
 * ⚖️ **ما لا نعرفه يقيناً من وثائق RevenueCat مكتوبٌ هنا ليُختبر في المرحلة ٤** (تجاربُ المتجر على الجوالين):
 * - الترقيةُ (بلس ⇢ ذهبي) فوريّةٌ في المتجرين (الخطّة §٦)، فحدثُ `PRODUCT_CHANGE` الصاعدُ يرقّي الصفَّ في حينه؛ والنازلُ
 *   (ذهبي ⇢ بلس، سنوي ⇢ شهري) مؤجَّلٌ إلى التجديد فلا يُمسّ — والتجديدُ يحمل المنتجَ الجديد.
 * - **العمولةُ مفتاحُها المعاملةُ لا الحدث** (`store:transaction_id` وإشارتُه): حدثان يحملان سعرَ المعاملة نفسها (ترقيةٌ
 *   وتجديد) لا يضاعفانها، والاسترجاعُ (سعرٌ سالب) سطرٌ مستقلٌّ يعكسها.
 */

export type RcEnvironment = "production" | "sandbox";
export type SubTier = "plus" | "gold";
export type SubStatus = "active" | "past_due" | "canceled" | "expired";

/** ما نقرؤه من حدث RevenueCat — الحقولُ الأخرى تُتجاهل */
export interface RcEvent {
  id: string;
  type: string;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  product_id?: string | null;
  new_product_id?: string | null;
  entitlement_ids?: string[] | null;
  period_type?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  environment?: string | null;
  store?: string | null;
  /** بالدولار، سالبٌ في الاسترجاع، صفرٌ في التجربة المجانيّة */
  price?: number | null;
  tax_percentage?: number | null;
  commission_percentage?: number | null;
  /** ما يصلنا من السعر (١ − الضريبة − رسم المتجر) كما يقدّره RevenueCat — يُقدَّم على الحساب حين يُرسل */
  takehome_percentage?: number | null;
  cancel_reason?: string | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

/** يقرأ جسمَ الويبهوك (`{ api_version, event }`) — `null` لما ليس حدثاً */
export function parseRcBody(raw: unknown): RcEvent | null {
  const ev = (raw as { event?: unknown } | null)?.event as Record<string, unknown> | undefined;
  if (!ev || typeof ev !== "object") return null;
  if (typeof ev.id !== "string" || !ev.id || typeof ev.type !== "string" || !ev.type) return null;
  return ev as unknown as RcEvent;
}

/** صاحبُ الحدث: التطبيقُ يدخل بـ`Purchases.logIn(uid)` فالمعرّفُ معرّفُ Supabase؛ المجهولُ (`$RCAnonymousID`) لا يُنسب لأحد */
export function userIdOf(ev: RcEvent): string | null {
  for (const id of [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])]) if (isUuid(id)) return id.toLowerCase();
  return null;
}

export function environmentOf(ev: RcEvent): RcEnvironment {
  return String(ev.environment ?? "").toUpperCase() === "PRODUCTION" ? "production" : "sandbox";
}

/** الطبقةُ من المنتج: معرّفاتُ المتجر `gold_yearly` · `plus_yearly` · `plus_monthly` (الخطّة §٩ المرحلة ٣)، والاستحقاقُ احتياط */
export function tierOfProduct(productId: string | null | undefined, entitlements?: string[] | null): SubTier {
  if (/gold/i.test(String(productId ?? ""))) return "gold";
  if (!productId && (entitlements ?? []).includes("gold")) return "gold";
  return "plus";
}

export const tierRank = (t: SubTier) => (t === "gold" ? 2 : 1);

/** مفتاحُ الصفّ: الشراءُ عند متجره — يبقى هو في التجديدات */
export function rowKeyOf(ev: RcEvent): string | null {
  const tx = ev.original_transaction_id || ev.transaction_id;
  if (!tx) return null;
  return `${String(ev.store ?? "unknown").toLowerCase()}:${tx}`;
}

const iso = (ms: number | null | undefined) => (typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);

/** ما يُكتب في الصفّ لهذا الحدث — `null` = لا تغيير على الصفّ (حدثٌ لا يخصّه أو ترقيةٌ مؤجّلة) */
export interface RowPatch {
  status: SubStatus;
  plan: SubTier;
  product_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export function rowPatchOf(ev: RcEvent, nowMs: number, current?: { plan: SubTier } | null): RowPatch | null {
  const end = iso(ev.expiration_at_ms);
  const plan = tierOfProduct(ev.product_id, ev.entitlement_ids);
  const base = { plan, product_id: ev.product_id ?? null, current_period_end: end };
  switch (ev.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE":
    case "SUBSCRIPTION_EXTENDED":
    case "TEMPORARY_ENTITLEMENT_GRANT":
      return { ...base, status: "active", cancel_at_period_end: false };
    case "PRODUCT_CHANGE": {
      /* الصاعدُ فوريّ، والنازلُ ينتظر التجديد */
      const next = tierOfProduct(ev.new_product_id, null);
      const was = current?.plan ?? plan;
      if (!ev.new_product_id || tierRank(next) <= tierRank(was)) return null;
      return { plan: next, product_id: ev.new_product_id, current_period_end: end, status: "active", cancel_at_period_end: false };
    }
    case "CANCELLATION": {
      /* الاسترجاعُ (دعمُ المتجر) ينهيه الآن؛ إيقافُ التجديد يُبقيه إلى نهاية مدّته المدفوعة */
      if (String(ev.cancel_reason ?? "").toUpperCase() === "CUSTOMER_SUPPORT" || (ev.price ?? 0) < 0) {
        return { ...base, status: "expired", cancel_at_period_end: true, current_period_end: new Date(Math.min(nowMs, ev.expiration_at_ms ?? nowMs)).toISOString() };
      }
      return { ...base, status: "canceled", cancel_at_period_end: true };
    }
    case "BILLING_ISSUE":
      /* مهلةُ المتجر داخلةٌ في `expiration_at_ms` — يبقى بلس إلى نهايتها */
      return { ...base, status: "past_due", cancel_at_period_end: false };
    case "EXPIRATION":
      return { ...base, status: "expired", cancel_at_period_end: true };
    case "SUBSCRIPTION_PAUSED":
      return { ...base, status: "active", cancel_at_period_end: false };
    default:
      return null;
  }
}

/** ريالٌ مربوطٌ بالدولار (٣٫٧٥) — RevenueCat يرسل `price` بالدولار في كلِّ بلد، فالعمولةُ بعملةٍ واحدة */
export const SAR_PER_USD = 3.75;
export const PARTNER_SHARE = 0.25;
const YEAR_MS = 365 * 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface Commission {
  key: string;
  kind: "earned" | "reversed";
  net: number;
  amount: number;
  paidAt: string;
}

/**
 * عمولةُ الشريك على هذه المعاملة: ٢٥٪ من **الصافي** (السعرُ ناقصاً الضريبةَ ورسمَ المتجر، كلاهما نسبةٌ من السعر في الحدث)،
 * في السنة الأولى من أوّل اشتراكٍ حقيقيّ (`anchorMs`)، والسالبُ استرجاعٌ يعكسها. التجربةُ والمجّانيُّ لا شيء.
 */
export function commissionOf(ev: RcEvent, anchorMs: number | null): Commission | null {
  if (environmentOf(ev) !== "production") return null;
  if (ev.type === "TEST" || ev.type === "TRANSFER") return null;
  const price = typeof ev.price === "number" && Number.isFinite(ev.price) ? ev.price : 0;
  if (!price) return null;
  const tx = ev.transaction_id || ev.original_transaction_id;
  if (!tx) return null;
  const paid = typeof ev.purchased_at_ms === "number" ? ev.purchased_at_ms : null;
  if (paid == null || anchorMs == null || paid >= anchorMs + YEAR_MS || paid < anchorMs - 86_400_000) return null;
  const keep = typeof ev.takehome_percentage === "number" && Number.isFinite(ev.takehome_percentage) ? clampPct(ev.takehome_percentage) : Math.max(0, 1 - clampPct(ev.tax_percentage) - clampPct(ev.commission_percentage));
  const net = round2(price * SAR_PER_USD * keep);
  const amount = round2(net * PARTNER_SHARE);
  if (!amount) return null;
  const kind = price < 0 ? "reversed" : "earned";
  return { key: `${String(ev.store ?? "unknown").toLowerCase()}:${tx}:${kind}`, kind, net, amount, paidAt: new Date(paid).toISOString() };
}

const clampPct = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** مثالُ صفحة الشريك من السعر في الكود (الخطّة §٧): ٩٩٫٩٩ ⇢ صافٍ ≈ ٧٣٫٩١ ⇢ عمولةٌ ≈ ١٨٫٤٨ (ضريبةٌ ١٥٪ من السعر الشامل، ورسمُ المتجر ١٥٪ من الباقي) */
export function partnerExample(price: number): { net: number; commission: number } {
  const net = round2((price / 1.15) * 0.85);
  return { net, commission: round2(net * PARTNER_SHARE) };
}

/**
 * 🆕 ردُّ `POST /api/v1/me/billing/sync` — **التطبيقُ يقرأ خطّةَ الخادم** بعد الشراء والاسترجاع (الخطّة §٩ المرحلة ١): المتجرُ
 * يقول «اشتريت» قبل أن يصل الويبهوك، والواجهةُ لا تفتح بلس إلّا حين يقوله الخادم — فتسأل هنا حتى يتبدّل.
 */
export interface BillingSyncPayload {
  plus: boolean;
  gold: boolean;
  plus_until: string | null;
  gold_until: string | null;
  /** آخرُ صفِّ متجر: «يتجدّد» أو «أُلغي ويكمل مدّته» أو «مشكلةُ دفع» — `null` بلا اشتراكٍ من المتجر */
  store: { status: SubStatus; plan: SubTier; current_period_end: string | null; cancel_at_period_end: boolean; environment: RcEnvironment } | null;
}
