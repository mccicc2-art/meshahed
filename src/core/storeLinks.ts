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

/** عنوانُ التطبيق الخاصّ (`scheme` في `apps/mobile/app.json`) — زرُّ «افتح الدعوة في التطبيق» يفتحه بالكود */
export const APP_SCHEME = "com.loopztv.app";

/** رابطُ فتح الدعوة في التطبيق: `com.loopztv.app://join/<CODE>` — يقرؤه `+native-intent.tsx` */
export function appInviteLink(code: string): string {
  return `${APP_SCHEME}://join/${encodeURIComponent(code)}`;
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
