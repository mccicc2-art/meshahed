/**
 * 🆕 **عقدُ مزوّدي الترايلر** (D-759، مواصفةُ أحمد المكتوبة — القسم الأوّل).
 *
 * **أربعةُ مزوّدين في العقد واثنان منفَّذان اليوم:**
 * - `youtube` — **المسارُ الافتراضيُّ الآن** عبر IFrame Player API الرسمي.
 * - `file` — ملفُّ MP4 مرخَّصُ العرض يُبثّ من مصدره (معاينات iTunes منذ
 *   D-758): لا تنزيلَ ولا إعادةَ استضافة.
 * - `mux` / `cloudflare` — **بأمر أحمد: لا يُنفَّذان قبل تأكيد حقوق
 *   الملفّات واختيار الخدمة.** العقدُ محجوزٌ هنا كي يكون التحويلُ يومَها
 *   تبديلَ مزوّدٍ لا إعادةَ بناء.
 *
 * ⚠️ **والملفُّ بلا استيراداتٍ عمداً** (درسُ D-734/D-669): تقرؤه مكوّناتُ
 * العميل وملفّاتُ الخادم معاً بأمان.
 */

export type TrailerProviderId = "youtube" | "file" | "mux" | "cloudflare";

/** المزوّدان المنفَّذان — والاختيارُ من بيانات العنصر لا من إعدادٍ خفيّ */
export type ActiveTrailerProvider = Extract<TrailerProviderId, "youtube" | "file">;

export function providerOf(item: { fileUrl: string | null }): ActiveTrailerProvider {
  return item.fileUrl ? "file" : "youtube";
}
