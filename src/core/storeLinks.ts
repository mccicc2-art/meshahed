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

/** تنقيةُ الكود الشكليّة نفسُها في كلِّ باب (`A-Z0-9`، ≤ ١٠) — الحكمُ الحقيقيُّ في جسم `claim_referral` */
export function cleanInviteCode(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}
