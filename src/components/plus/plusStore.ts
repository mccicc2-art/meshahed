import { STORE_URL } from "@/core/storeLinks";

/**
 * ====== 🆕 الاشتراكُ من الويب = بابٌ إلى التطبيق (أحمد ١٨ نوفمبر: «اذا ضغط اشترك تحوله عالتطبيق سواء اندرويد او ابل») ======
 *
 * 🔑 **لا دفعَ في الويب** («كلها ما عدا الدفع»): الشراءُ داخل التطبيق من المتجرين (RevenueCat)، والمزايا تُفتح هنا بالحساب
 * نفسِه (خطّةُ الخادم). فكلُّ ما في هذا الملفّ: إلى أين يذهب الزرُّ في كلِّ جهاز، وبكم يُقال السعر.
 * 🔑 **النصوصُ هنا لا في القاموس المشترك**: `src/core` يُطلق تحديثَ التطبيق الهوائيّ، وشغلُ الويب لا يلمس التطبيق
 * (أحمد ١٨ نوفمبر: «كل شغلنا عالويب … بدون ما نلمس التطبيق»). نصوصُ الشاشة نفسِها (`pw*`) تُقرأ من القاموس كما هي.
 */

/** 🔴 **أندرويد ما زال في الاختبار المغلق** (Alpha، مجموعةُ المختبرين — `claude_18-append-2026-11-15-tester-group.md`): صفحةُ
 *  «انضمّ مختبراً» في Google Play، ومنها يُحمَّل التطبيق (أحمد: «تظهر صفحة انضم نفس فالجوال، منها يقدر يدخل ك مختبر ويحمل
 *  التطبيق»). **يومَ يُفتح للعموم يصير `true`** فيذهب الزرُّ إلى صفحة المتجر — سطرٌ واحد. */
export const ANDROID_PUBLIC = false;
export const PLAY_TESTING = "https://play.google.com/apps/testing/com.loopztv.app";
export const TESTERS_GROUP = "https://groups.google.com/g/loopz-testers";

export const IOS_HREF = STORE_URL.ios;
export const ANDROID_HREF = ANDROID_PUBLIC ? STORE_URL.android : PLAY_TESTING;

/**
 * زرُّ أندرويد على الجوّال: يفتح **شاشةَ الاشتراك في التطبيق** إن كان مثبّتاً (`settings/plus` — المسارُ الذي تفتحه كلُّ
 * أبواب Loopz+ في التطبيق)، وإلا يذهب Chrome إلى `ANDROID_HREF` بنفسه (`browser_fallback_url`). آيفون لا يملك مثلَه
 * بلا خطأٍ مرئيّ، فيذهب إلى App Store مباشرةً (والمتجرُ يقول «فتح» لمن ثبّته).
 */
export function androidAppIntent(): string {
  return `intent://settings/plus#Intent;scheme=com.loopztv.app;package=com.loopztv.app;S.browser_fallback_url=${encodeURIComponent(ANDROID_HREF)};end`;
}

/** رمزُ QR في نافذة الحاسوب يحمل هذا الرابط (`public/qr-get-plus.svg` مولَّدٌ منه) — `src/app/get/route.ts` يوجّهه بحسب الجهاز */
export const GET_PLUS_URL = "https://loopztv.com/get?to=plus";

export type Device = "ios" | "android" | "desktop";

export function deviceOf(ua: string): Device {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export type PlanKey = "yearly" | "monthly" | "gold";

/**
 * **الأسعارُ السعوديّة كما يبيعها المتجران** (Play R187 · App Store 17 نوفمبر — كلاهما شاملُ الضريبة بالرقم نفسِه). التطبيقُ
 * يقرأ السعرَ من المتجر؛ الويبُ لا متجرَ له فيكتبه هنا ويقول إنّ السعرَ في البلد الآخر من المتجر (D-217: لا رقمَ لا يُدفع).
 * أيُّ تغييرٍ في المتجر يتغيّر هنا في السطر نفسِه.
 */
export const PRICES = {
  yearly: { ar: "99.99 ر.س", en: "SAR 99.99", thenAr: "119.99 ر.س", thenEn: "SAR 119.99" },
  monthly: { ar: "12.99 ر.س", en: "SAR 12.99" },
  gold: { ar: "199.99 ر.س", en: "SAR 199.99" },
} as const;

export const WORDS = {
  ar: {
    cta: "اشترك من التطبيق",
    ctaGold: "اشترك في Gold من التطبيق",
    planYearly: "Plus سنوي",
    planMonthly: "Plus شهري",
    planGold: "Gold",
    firstYear: "السنة الأولى",
    then: (p: string) => `ثم ${p} سنوياً`,
    perMonth: "شهرياً",
    cancelAny: "ألغِ متى شئت",
    perYear: "سنوياً · سنوي فقط",
    priceNote: "بالريال السعودي شاملاً الضريبة · السعر في بلدك يحدّده متجر التطبيقات",
    plusFeatures: "مزايا Plus",
    goldWith: "كل مزايا Plus، ومعها",
    goldBoard: "واسمك في لوحة الداعمين",
    goldPartners: "برنامج الشركاء",
    goldPartnersSub: "اكسب من كل اشتراك عن طريقك",
    sheetTitle: "اشترك من تطبيق Loopz",
    sheetBody: "الدفع داخل التطبيق عبر App Store أو Google Play. ادخل بحسابك نفسه، وتُفتح المزايا هنا في الموقع تلقائياً.",
    scan: "امسح بكاميرا جوّالك",
    moreWays: "طرقٌ أخرى",
    scanBody: "في آيفون يفتح App Store، وفي أندرويد يفتح صفحة الانضمام للتجربة في Google Play، ومنها تحمّل التطبيق.",
    appStoreTop: "حمّله من",
    playTop: ANDROID_PUBLIC ? "احصل عليه من" : "انضم للتجربة على",
    androidTesting: "أندرويد في مرحلة التجربة: تنضم مختبراً من صفحة Google Play ثم تحمّل التطبيق.",
    groupFirst: "لم تُقبل؟ انضم أولاً إلى مجموعة المختبرين",
    chosen: "اخترت",
    ownedTitle: (name: string) => `شكراً لاشتراكك. كل مزايا ${name} مفتوحة لك.`,
    ownedUntil: (d: string) => `مفعّل حتى ${d}`,
    ownedActive: "نشط",
    ownedManage: "أدِر اشتراكك وألغِه من المتجر الذي اشتركت منه.",
    included: "مشمول",
    upgrade: "رقِّ إلى Gold من التطبيق",
    gateLine: "الاشتراك من تطبيق Loopz على آيفون وأندرويد",
    terms: "الشروط",
    privacy: "الخصوصية",
    features: "كل ما يقدر عليه Loopz",
    verifiedNote: "التوثيق لا يُباع ولا يأتي مع الاشتراك — يُقدَّم عليه مستقلاً ويُراجَع يدوياً.",
  },
  en: {
    cta: "Subscribe in the app",
    ctaGold: "Get Gold in the app",
    planYearly: "Plus yearly",
    planMonthly: "Plus monthly",
    planGold: "Gold",
    firstYear: "first year",
    then: (p: string) => `then ${p} a year`,
    perMonth: "a month",
    cancelAny: "Cancel any time",
    perYear: "a year · yearly only",
    priceNote: "Saudi riyals including VAT · your app store sets the price in your country",
    plusFeatures: "Plus features",
    goldWith: "Everything in Plus, and",
    goldBoard: "And your name on the supporters board",
    goldPartners: "Partner program",
    goldPartnersSub: "Earn from every subscription you bring",
    sheetTitle: "Subscribe in the Loopz app",
    sheetBody: "You pay inside the app through the App Store or Google Play. Sign in with the same account and the features unlock here on the web too.",
    scan: "Scan with your phone camera",
    moreWays: "Other ways",
    scanBody: "On iPhone it opens the App Store; on Android it opens the Google Play testing page, where you join and install the app.",
    appStoreTop: "Download on the",
    playTop: ANDROID_PUBLIC ? "Get it on" : "Join the beta on",
    androidTesting: "Android is in beta: join as a tester on Google Play, then install the app.",
    groupFirst: "Not accepted? Join the testers group first",
    chosen: "Chosen",
    ownedTitle: (name: string) => `Thanks for subscribing. Every ${name} feature is yours.`,
    ownedUntil: (d: string) => `Active until ${d}`,
    ownedActive: "Active",
    ownedManage: "Manage or cancel your subscription in the store you bought it from.",
    included: "Included",
    upgrade: "Upgrade to Gold in the app",
    gateLine: "Subscribe in the Loopz app on iPhone and Android",
    terms: "Terms",
    privacy: "Privacy",
    features: "Everything Loopz can do",
    verifiedNote: "Verification is not sold and does not come with a subscription — it is applied for separately and reviewed by hand.",
  },
} as const;

export type PlusWords = (typeof WORDS)["ar"] | (typeof WORDS)["en"];
