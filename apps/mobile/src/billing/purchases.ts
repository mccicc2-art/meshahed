import { Linking, Platform } from "react-native";
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  PURCHASES_ERROR_CODE,
  STORE_REPLACEMENT_MODE,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import { api, queryClient } from "../api";
import { invalidateMe, invalidateSettings } from "../settings/api";
import { HOME_KEY } from "../home/useHome";
import type { BillingSyncPayload } from "@/core/billing";

/**
 * ====== 🆕 الشراءُ من المتجر — RevenueCat (خطّةُ Loopz+ v2 §٩ المرحلة ٢، بناء 1.14.0) ======
 *
 * 🔑 **المتجرُ يبيع، والخادمُ يحكم**: الشراءُ هنا يكلّم Apple/Google عبر RevenueCat، **والواجهةُ لا تفتح بلس من ردِّ المتجر**
 * بل من خطّة الخادم (`POST /api/v1/me/billing/sync`) حين يصلها الويبهوك (الخطّة §٩ المرحلة ١) — فلا مصدران للحقيقة.
 *
 * 🔑 **المعرّفُ معرّفُ العضو** (`Purchases.logIn(uid)`): الويبهوكُ ينسب الحدثَ بـ`app_user_id` (`userIdOf` في `core/billing.ts`)،
 * ومجهولٌ (`$RCAnonymousID`) لا يُنسب لأحد — فلا شراءَ قبل أن يُعرف العضو (`ready`).
 *
 * 🔑 **المفتاحان مفتاحا SDK عامّان** (RevenueCat يسمّيهما «Public API keys» ويُكتبان في التطبيق نفسِه): لا يكتبان شيئاً ولا يقرآن
 * غيرَ صاحب الجهاز — ليسا سرّاً كمفتاح الخادم أو سرِّ الويبهوك (`REVENUECAT_WEBHOOK_SECRET`، في Vercel وحدَه).
 *
 * 📦 **الحزمُ في عرض `default`** (لوحة RevenueCat، ٦ نوفمبر): `$rc_annual` بلس سنوي · `$rc_monthly` بلس شهري · `gold_annual`
 * ذهبيٌّ سنوي. ما غاب عن منصّةٍ (الذهبيُّ على أندرويد قبل منتجات Play) يغيب من الشاشة بلا كسر.
 */
const KEYS = { ios: "appl_ydYdFlSMCXDBRFwXeGmgxSsxqdy", android: "goog_oPmfCQyptAeCcMeOogWjHooVpNt" } as const;

export const PKG = { plusYearly: "$rc_annual", plusMonthly: "$rc_monthly", goldYearly: "gold_annual" } as const;

let configured = false;
let currentUid: string | null = null;
/** آخرُ عضوٍ طُلب — يُعاد عليه إن فشل الدخول (لا يتبدّل «من أنا» فلا يُنادى من جديد) */
let wantedUid: string | null = null;
let chain: Promise<void> = Promise.resolve();
let readyWaiters: Array<() => void> = [];

function keyOf(): string | null {
  if (Platform.OS === "ios") return KEYS.ios;
  if (Platform.OS === "android") return KEYS.android;
  return null;
}

/**
 * يُنادى كلّما تبدّل «من أنا» (`BillingGate` في `_layout`): عضوٌ ⇒ `configure` أوّلَ مرّةٍ بمعرّفه ثمّ `logIn` لكلِّ عضوٍ جديد؛
 * لا عضو (خروج) ⇒ `logOut` فلا يرث الحسابُ التالي على الجهاز نفسِه مشترياتِ السابق في الذاكرة.
 * ⚠️ **صامتٌ عند العطل**: بناءٌ بلا الوحدة الأصليّة (1.13.x لا يأخذ هذا الكود — البصمةُ تبدّلت، لكنّه احتياط) لا يسقط الإقلاع.
 */
export function identify(uid: string | null): Promise<void> {
  wantedUid = uid;
  /* 🔴 مراجعةُ الصحّة (٦ نوفمبر) — **نداءٌ بعد نداء لا معاً**: خروجٌ ثمّ دخولٌ سريعان كانا يجريان معاً، فإن وصل `logOut` آخراً
     بقي RevenueCat مجهولاً و`currentUid` يقول العضوَ الجديد — والشراءُ يُنسب إلى `$RCAnonymousID` فلا يصل أحداً */
  chain = chain.then(() => identifyNow(uid));
  return chain;
}

async function identifyNow(uid: string | null): Promise<void> {
  try {
    if (!uid) {
      if (configured && currentUid) {
        currentUid = null;
        await Purchases.logOut().catch(() => {});
      }
      return;
    }
    if (uid === currentUid) return;
    const key = keyOf();
    if (!key) return;
    if (!configured) {
      Purchases.configure({ apiKey: key, appUserID: uid });
      configured = true;
    } else {
      await Purchases.logIn(uid);
    }
    currentUid = uid;
    const w = readyWaiters;
    readyWaiters = [];
    w.forEach((f) => f());
  } catch {
    /* بلا متجرٍ على هذا الجهاز — الشاشةُ تقول «غير متاح» */
  }
}

/** ينتظر أن يُعرف العضو (حتى مهلة) — الشاشةُ قد تُفتح قبل أن يصل «من أنا» */
function whenReady(ms = 6000): Promise<boolean> {
  if (configured && currentUid) return Promise.resolve(true);
  /* دخولٌ فشل من قبل (شبكة) ⇒ يُعاد على العضو المطلوب — الشاشةُ فُتحت فهو يريد الشراء الآن */
  if (wantedUid && wantedUid !== currentUid) void identify(wantedUid);
  return new Promise((resolve) => {
    const done = () => resolve(true);
    readyWaiters.push(done);
    setTimeout(() => {
      readyWaiters = readyWaiters.filter((f) => f !== done);
      resolve(configured && !!currentUid);
    }, ms);
  });
}

/** خيارٌ واحدٌ كما تعرضه الشاشة — السعرُ نصُّ المتجر نفسِه بعملة البلد (الخطّة §٢: «لا سعرَ في الكود»)، والعرضُ التمهيديُّ إن كان أهلاً له */
export type Plan = {
  pkg: PurchasesPackage;
  productId: string;
  price: string;
  /** سعرُ السنة الأولى (الدفعُ المقدَّم) — `null` إن لم يكن له عرضٌ أو لم يكن أهلاً */
  intro: string | null;
  /** بلس سنويٌّ للشهر تقريباً (من المتجر) — يُعرض «≈ … /شهر» */
  perMonth: string | null;
  /** 🆕 والسنةُ الأولى للشهر تقريباً (لوحُ `Main`: «≈ ٨٫٣٣ ر.س/شهر» تحت ٩٩٫٩٩) — بعملة المتجر، أو `null` إن تعذّر حسابُه */
  introPerMonth: string | null;
};

/** أشهرُ مدّة العرض التمهيديّ (الدفعُ المقدَّم لسنة ⇒ ١٢) — `null` لوحدةٍ لا تُقسم أشهراً */
function monthsOf(unit: string, n: number): number | null {
  const u = unit.toUpperCase();
  if (u === "YEAR") return 12 * n;
  if (u === "MONTH") return n;
  return null;
}

function perMonthText(amount: number, months: number | null, currency: string): string | null {
  if (!months || !(amount > 0)) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount / months);
  } catch {
    return null;
  }
}

export type Offer = { plusYearly: Plan | null; plusMonthly: Plan | null; goldYearly: Plan | null };

/**
 * `here`: الاشتراكُ من متجر هذا الجهاز — بلسٌ اشتُري على الآيفون لا يُرقّى من أندرويد (Play يرفض معرّفَ منتجٍ من Apple، والآيفونُ
 * يفتح اشتراكاً ثانياً موازياً لاشتراك Play). اشتراكٌ من متجرٍ آخر ⇒ الشاشةُ تعرضه وتديره ولا تبيع فوقه.
 * `monthly`: من معرّف الخطّة أيضاً — في أندرويد معرّفُ المنتج بلا خطّته الأساسيّة فلا يُعرف منه وحدَه.
 */
export type ActiveSub = { productId: string; tier: "plus" | "gold"; managementURL: string | null; willRenew: boolean; expires: string | null; here: boolean; monthly: boolean };

export type Loaded = { offer: Offer; active: ActiveSub | null };

function planOf(p: PurchasesPackage | undefined, eligible: Set<string>): Plan | null {
  if (!p) return null;
  const sp = p.product;
  const intro = sp.introPrice && (Platform.OS === "android" || eligible.has(sp.identifier)) ? sp.introPrice.priceString : null;
  const introPerMonth = intro && sp.introPrice ? perMonthText(sp.introPrice.price, monthsOf(sp.introPrice.periodUnit, sp.introPrice.periodNumberOfUnits), sp.currencyCode) : null;
  return { pkg: p, productId: sp.identifier, price: sp.priceString, intro, perMonth: sp.pricePerMonthString ?? null, introPerMonth };
}

/** الطبقةُ من معرّف المنتج — القاعدةُ نفسُها في الخادم (`tierOfProduct`) */
const tierOf = (productId: string): "plus" | "gold" => (/gold/i.test(productId) ? "gold" : "plus");

function activeOf(info: CustomerInfo): ActiveSub | null {
  const ents = Object.values(info.entitlements.active);
  if (ents.length === 0) return null;
  /* الذهبيُّ يُعلّق على الاستحقاقين (`plus` و`gold`) — فالأعلى أوّلاً */
  const top = ents.find((e) => tierOf(e.productIdentifier) === "gold") ?? ents[0];
  const store = Platform.OS === "ios" ? "APP_STORE" : "PLAY_STORE";
  const plan = `${top.productIdentifier}:${top.productPlanIdentifier ?? ""}`;
  return { productId: top.productIdentifier, tier: tierOf(top.productIdentifier), managementURL: info.managementURL, willRenew: top.willRenew, expires: top.expirationDate, here: top.store === store, monthly: /monthly/i.test(plan) };
}

export async function load(): Promise<Loaded | null> {
  if (!(await whenReady())) return null;
  try {
    const [offerings, info] = await Promise.all([Purchases.getOfferings(), Purchases.getCustomerInfo()]);
    const o = offerings.current ?? offerings.all.default;
    if (!o) return { offer: { plusYearly: null, plusMonthly: null, goldYearly: null }, active: activeOf(info) };
    const byId = (id: string) => o.availablePackages.find((p) => p.identifier === id);
    /* الأهليّةُ للعرض التمهيديّ على iOS تُسأل (من اشترك سابقاً لا يراه)؛ أندرويد لا يعيد إلّا عرضاً هو أهلٌ له */
    const eligible = new Set<string>();
    if (Platform.OS === "ios") {
      const ids = o.availablePackages.map((p) => p.product.identifier);
      const res = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids).catch(() => ({}) as Record<string, { status: INTRO_ELIGIBILITY_STATUS }>);
      for (const [id, e] of Object.entries(res)) if (e.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE) eligible.add(id);
    }
    return {
      offer: { plusYearly: planOf(byId(PKG.plusYearly), eligible), plusMonthly: planOf(byId(PKG.plusMonthly), eligible), goldYearly: planOf(byId(PKG.goldYearly), eligible) },
      active: activeOf(info),
    };
  } catch {
    return null;
  }
}

export type BuyOutcome = { kind: "done"; server: BillingSyncPayload | null } | { kind: "cancelled" } | { kind: "pending" } | { kind: "failed"; message: string };

/**
 * يشتري ثمّ ينتظر الخادم. **الترقيةُ على أندرويد** تحتاج المنتجَ القديم ونمطَ الاستبدال (الخطّة §٦: «charge the prorated
 * difference»)؛ **iOS** يرقّي داخل مجموعة الاشتراك وحدَه (الذهبيُّ أعلى مستوىً) فلا شيءَ يُمرَّر.
 */
export async function buy(plan: Plan, upgradeFrom: ActiveSub | null): Promise<BuyOutcome> {
  if (!(await whenReady())) return { kind: "failed", message: "not_ready" };
  try {
    const change =
      Platform.OS === "android" && upgradeFrom && upgradeFrom.here && upgradeFrom.productId !== plan.productId
        ? {
            oldProductIdentifier: upgradeFrom.productId.split(":")[0],
            /* صعودٌ إلى الذهبيّ فوريٌّ بفرق المدّة الباقية؛ ما عداه (سنويٌّ ⇢ شهريّ) مؤجَّلٌ إلى التجديد (الخطّة §٦) */
            replacementMode: tierOf(plan.productId) === "gold" && upgradeFrom.tier === "plus" ? STORE_REPLACEMENT_MODE.CHARGE_PRORATED_PRICE : STORE_REPLACEMENT_MODE.DEFERRED,
          }
        : null;
    await Purchases.purchasePackage(plan.pkg, null, change);
    return { kind: "done", server: await syncServer(tierOf(plan.productId)) };
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { kind: "cancelled" };
    if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { kind: "pending" };
    return { kind: "failed", message: e instanceof Error ? e.message : String(code ?? "unknown") };
  }
}

export async function restore(): Promise<{ ok: boolean; active: boolean; server: BillingSyncPayload | null }> {
  if (!(await whenReady())) return { ok: false, active: false, server: null };
  try {
    const info = await Purchases.restorePurchases();
    const active = !!activeOf(info);
    return { ok: true, active, server: active ? await syncServer() : await syncOnce() };
  } catch {
    return { ok: false, active: false, server: null };
  }
}

/** «إدارة الاشتراك»: صفحةُ المتجر نفسِه — التبديلُ والإلغاءُ من هناك (نصُّ اللوح) */
export async function manage(active: ActiveSub | null): Promise<void> {
  try {
    if (Platform.OS === "ios") return await Purchases.showManageSubscriptions();
    if (active?.managementURL) return void (await Linking.openURL(active.managementURL));
    const sku = active ? `&sku=${encodeURIComponent(active.productId.split(":")[0])}` : "";
    await Linking.openURL(`https://play.google.com/store/account/subscriptions?package=com.loopztv.app${sku}`);
  } catch {
    /* لا متجر — لا شيء يُفتح */
  }
}

/** هل يرى الخادمُ ما اشتُري؟ — الذهبيُّ بـ`gold`، وبلسٌ باشتراكٍ من المتجر نشطٍ أو في مهلة الدفع */
export function reached(s: BillingSyncPayload | null, want: "plus" | "gold"): boolean {
  if (!s) return false;
  if (want === "gold") return s.gold;
  return !!s.store && (s.store.status === "active" || s.store.status === "past_due") && s.plus;
}

async function syncOnce(): Promise<BillingSyncPayload | null> {
  try {
    return (await api<BillingSyncPayload>("/api/v1/me/billing/sync", { method: "POST" })).data;
  } catch {
    return null;
  }
}

/**
 * **ينتظر الويبهوك** (المتجرُ يقول «اشتريت» قبل أن يصل الحدثُ إلى الخادم): يسأل الخادمَ بمُهَلٍ متزايدة حتى يرى اشتراكاً من
 * المتجر نشطاً، ثمّ يحدّث «من أنا» والإعدادات — فتُرسم الشارةُ وتُفتح المزايا من مصدرها الواحد. أقصاه ~٢٥ث ثمّ آخرُ ما رآه.
 */
export async function syncServer(want: "plus" | "gold" = "plus"): Promise<BillingSyncPayload | null> {
  let last: BillingSyncPayload | null = null;
  for (const wait of [0, 1500, 2500, 4000, 6000, 10000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = (await syncOnce()) ?? last;
    /* 🔴 مراجعةُ الصحّة — **الطبقةُ المشتراة لا أيُّ بلس**: المرقّي إلى الذهبيّ بلسٌ من قبل، فكان السؤالُ يقف من أوّل مرّة
       قبل أن يصل الويبهوك، فلا شارةَ GOLD تُرسم و«تم» يُقال على حالٍ قديمة */
    if (reached(last, want)) break;
  }
  invalidateMe();
  invalidateSettings();
  /* 🆕 T341 — **ورأسُ الرئيسيّة معهما** (آيفون أحمد ٦ نوفمبر: رقّى إلى Gold فصارت الشارةُ GOLD في القائمة والملفّ وبقيت PLUS في
     الرئيسيّة حتى بعد إعادة الفتح): الشارةُ هناك من `me/home` لا من «من أنا»، ونسختُه المحفوظةُ «حديثةٌ» دقيقةً (`staleTime`)
     فلا يُطلب غيرُها. إبطالُها هنا يرسم الطبقةَ الجديدة فور أن يراها الخادم — شراءً وترقيةً واسترجاعاً */
  void queryClient.invalidateQueries({ queryKey: HOME_KEY });
  return last;
}
