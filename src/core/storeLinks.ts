/**
 * ====== 🆕 روابطُ المتجرين — مصدرٌ واحد (المهمة ٣٧٠) ======
 *
 * كانت ثابتةً داخل `GET /api/v1/app/config` وحده (لافتةُ «حدّث التطبيق»)، وصفحةُ الدعوة (`/invite/[code]`) تحتاجها
 * أيضاً — **فخرجت هنا كي لا يفترق رابطان لمتجرٍ واحد يومَ يتبدّل أحدهما**.
 * `ascAppId` في `apps/mobile/eas.json`.
 */
export const STORE_URL = {
  ios: "https://apps.apple.com/app/id6820369011",
  android: "https://play.google.com/store/apps/details?id=com.loopztv.app",
} as const;

/**
 * 🆕 T530 — **صفحةُ كتابة التقييم في المتجر** («قيّم لوبز» في الإعدادات، أحمد «٢أ»): App Store يفتح نافذةَ الكتابة نفسَها
 * (`action=write-review`)، وGoogle Play صفحةَ التطبيق وتقييماته. رابطٌ لا مكافأةَ معه — المكافأةُ على التقييم ممنوعةٌ في المتجرين.
 */
export const STORE_REVIEW_URL = {
  ios: `${STORE_URL.ios}?action=write-review`,
  android: `${STORE_URL.android}&showAllReviews=true`,
} as const;

/**
 * 🆕 المهمة ٤٢١ — **تجربةُ أندرويد المغلقة** (قرارُ أحمد «٢ أ»، ١٨ نوفمبر): التطبيقُ على Google Play في اختبارٍ مغلقٍ حتى
 * يُفتح للعموم (حسابٌ شخصيّ: ١٢ مختبِراً × ١٤ يوماً)، فرابطُ المتجر وحدَه يقول للزائر «غير متاح». الطريقُ: الانضمامُ إلى
 * قروب المختبِرين (`group`) ثمّ تفعيلُ التجربة والتنزيل (`optIn`) بحساب Google نفسِه. **يومَ النشر للعموم**: `closed` يصير
 * `false` فتعود صفحةُ الدعوة إلى رابط Play الحامل للكود (`playInviteLink`).
 */
export const ANDROID_TEST = {
  closed: true,
  group: "https://groups.google.com/g/loopz-testers",
  optIn: "https://play.google.com/apps/testing/com.loopztv.app",
} as const;

/** عنوانُ التطبيق الخاصّ (`scheme` في `apps/mobile/app.json`) — زرُّ «افتح الدعوة في التطبيق» يفتحه بالكود */
export const APP_SCHEME = "com.loopztv.app";

/** رابطُ فتح الدعوة في التطبيق: `com.loopztv.app://join/<CODE>` — يقرؤه `+native-intent.tsx` */
export function appInviteLink(code: string): string {
  return `${APP_SCHEME}://join/${encodeURIComponent(code)}`;
}

/**
 * 🆕 المهمة ٤٣٤ — **زرُّ أندرويد يفتح Loopz إن كان مثبّتاً، وإلّا يذهب إلى `fallback`** (قرارُ أحمد ١٩ نوفمبر: «إذا ضغط والتطبيقُ
 * عنده يدخله للتطبيق، وإذا ما عنده يوديه للمتجر»). رابطُ `intent://` يسأل Chrome أندرويد نفسَه: الحزمةُ مثبّتة ⇠ يُسلَّم
 * `com.loopztv.app://join/<CODE>` للتطبيق (يقرؤه `+native-intent.tsx` كما يقرأ زرَّ «افتح Loopz»)، وغيرُ مثبّتة ⇠ يفتح
 * `browser_fallback_url` بلا رسالة خطأ. ⚖️ لا شيءَ في التطبيق يتغيّر: العنوانُ الخاصُّ معلَنٌ في كلِّ بناءٍ منذ ٣٧٠.
 * 🍎 iPhone لا يملك مثلَه في الويب — Safari لا يخبر الصفحةَ بما ثُبّت، ومحاولةُ الفتح بلا تطبيقٍ تُظهر خطأً — فشارتُه تذهب إلى
 * App Store دائماً، ومن عنده التطبيقُ يجد هناك «فتح» (قرارُ أحمد «١ أ»).
 */
export function androidOpenLink(code: string, fallback: string): string {
  return `intent://join/${encodeURIComponent(cleanInviteCode(code))}#Intent;scheme=${APP_SCHEME};package=${APP_SCHEME};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

/**
 * 🆕 1.14.1 — **رابطُ Google Play في صفحة الدعوة يحمل الكود** (`referrer=ref%3D<CODE>`): Play يعيده للتطبيق بعد التثبيت
 * (`apps/mobile/src/invite/installReferrer.ts`) فيعرف الترحيبُ مَن دعا العضوَ دون أن يرجع للصفحة. App Store لا يحمل مثله.
 */
export function playInviteLink(code: string): string {
  return `${STORE_URL.android}&referrer=${encodeURIComponent(`ref=${cleanInviteCode(code)}`)}`;
}

/** تنقيةُ الكود الشكليّة نفسُها في كلِّ باب (`A-Z0-9`، ≤ ١٠) — الحكمُ الحقيقيُّ في جسم `claim_referral` */
export function cleanInviteCode(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

/**
 * 🆕 المهمة ٤٢٨ — **رابطُ الدعوة الذي تنسخه صفحةُ الدعوة إلى حافظة الزائر** (قرارُ أحمد ١٨ نوفمبر «اجل سوي ب»): المتجرُ لا يحمل
 * شيئاً إلى التطبيق، فمن ثبّت ولم يرجع إلى الصفحة يصل الترحيبَ والرابطُ في حافظته — فيلصقه بزرّ Apple (بلا سؤال النظام) أو
 * يقرؤه أندرويد وحدَه. رابطٌ كاملٌ لا كودٌ مجرّد: إن لصقه الزائرُ في مكانٍ آخر بقي رابطاً يُفتح.
 */
export function inviteShareLink(code: string): string {
  return `https://loopztv.com/join/${encodeURIComponent(cleanInviteCode(code))}`;
}

/**
 * 🆕 المهمة ٤٢٨ — **الكودُ من نصٍّ لصقه العضو**: رابطُ دعوةٍ (`/join/` · `/p/` · `/invite/` على أيّ نطاقٍ لنا) أو الكودُ وحدَه.
 * ⚖️ **صارمٌ عمداً**: الحافظةُ تحمل أيّ شيء (رقمَ هاتف، كلمةً، رابطاً غريباً)، ونصٌّ لا يشبه دعوتَنا يُقرأ «لا كود» — لا يُرسل
 * إلى الخادم ليُسأل عنه. الكودُ وحدَه: ٤–١٠ من A-Z0-9 فيه رقمٌ وحرفٌ معاً (كلمةٌ عاديّةٌ منسوخة لا تمرّ). والحكمُ الأخير للخادم.
 * `pasted`: نصٌّ لصقه العضوُ بيده (زرُّ «لصق») — قصدُه دعوةٌ، فيُقبل الكودُ حروفاً وحدَها أيضاً (كودُ شريكٍ بلا أرقام).
 */
export function inviteCodeFromText(raw: string | null | undefined, pasted = false): string | null {
  const text = String(raw ?? "").trim();
  if (!text || text.length > 300) return null;
  const link = text.match(/(?:loopztv\.com|meshahed\.vercel\.app)\/(?:join|p|invite)\/([A-Za-z0-9]{1,10})(?![A-Za-z0-9])/i);
  if (link) return link[1].toUpperCase();
  if (/^[A-Za-z0-9]{4,10}$/.test(text) && (pasted || (/[0-9]/.test(text) && /[A-Za-z]/.test(text)))) return text.toUpperCase();
  return null;
}

/**
 * 🆕 1.14.1 — عكسُ `playInviteLink`: الكودُ من نصّ مصدر التثبيت كما يعيده Google Play (`ref=ABC123`، مفكوكاً أو مرمَّزاً مرّةً)،
 * أو `null` لمصدرٍ بلا دعوة (`utm_source=google-play&utm_medium=organic`) أو كودٍ لا يصحّ شكلُه.
 */
export function inviteCodeFromReferrer(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw;
  if (!/[=&]/.test(text)) {
    try {
      text = decodeURIComponent(text);
    } catch {
      /* نصٌّ لا يُفكّ — يُقرأ كما هو */
    }
  }
  for (const part of text.split("&")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq) !== "ref") continue;
    let code = part.slice(eq + 1);
    try {
      code = decodeURIComponent(code);
    } catch {
      /* كما هو */
    }
    return /^[A-Za-z0-9]{1,10}$/.test(code) ? code.toUpperCase() : null;
  }
  return null;
}
