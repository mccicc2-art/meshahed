/**
 * 🆕 **صنفُ المنصّة من وسم العميل** (D-909) — دالّةٌ صافيةٌ في النواة
 * لأنّ قارئَيها اثنان: **فعلُ نبضة الحضور** (الويب) و**`/api/v1/me`**
 * (تطبيق Expo) — **ونسختان من ترتيبِ فحصٍ حسّاسٍ تفترقان عند أوّل تعديل**
 * (D-145).
 *
 * 🔑 **والترتيبُ هو المنطق كلُّه**، وكلُّ سطرٍ فيه يسبق سطراً لسبب:
 * - **أندرويد قبل لينكس**: وسمُ كلِّ هاتفِ أندرويد يقول `Linux` أيضاً —
 *   **والفحصُ المعكوس يجعل كلَّ هواتف أندرويد «لينكس»** ويُفرغ اللوحةَ
 *   من السؤال الذي بُنيت له.
 * - **iOS قبل ماك**: وسمُ الآيباد يقول `Mac OS X` صراحةً.
 * - **ووسومُ التطبيق أوّلاً**: عميلُ Expo على أندرويد يرسل `okhttp` بلا
 *   كلمة `Android`، وعلى iOS يرسل `CFNetwork/Darwin` بلا `iPhone`.
 *
 * ⚠️ **وما لا يُعرف «أخرى» لا تخميناً**: عمودُ القاعدة محبوسٌ في قائمةٍ
 * مغلقة، **ورقمٌ مخمَّنٌ أسوأُ من رقمٍ غائب** (D-063).
 */
export type Platform = "android" | "ios" | "windows" | "mac" | "linux" | "other";

export function platformFromUA(ua: string | null | undefined): Platform {
  const s = (ua ?? "").toLowerCase();
  if (!s) return "other";
  if (s.includes("okhttp")) return "android";
  if (s.includes("cfnetwork") || s.includes("darwin")) return "ios";
  if (s.includes("android")) return "android";
  if (s.includes("iphone") || s.includes("ipad") || s.includes("ipod")) return "ios";
  if (s.includes("windows")) return "windows";
  if (s.includes("macintosh") || s.includes("mac os")) return "mac";
  if (s.includes("linux") || s.includes("x11")) return "linux";
  return "other";
}

/** الاسمُ العربيُّ لصفحة الإدارة — **مكانٌ واحدٌ لا خريطةٌ في كلِّ صفحة.** */
export const PLATFORM_AR: Record<Platform, string> = {
  android: "أندرويد",
  ios: "آيفون",
  windows: "ويندوز",
  mac: "ماك",
  linux: "لينكس",
  other: "أخرى",
};
