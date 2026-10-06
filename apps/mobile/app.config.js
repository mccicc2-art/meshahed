/**
 * D-1305 — إشعاراتُ الدفع تحتاج `google-services.json` (مشروع Firebase `loopztv-26`) في البناء.
 *
 * الملفُّ ليس سرّاً بتعريف Firebase (يُشحن داخل كلِّ APK)، لكنّه يحمل مفتاحَ API بصيغةٍ يلتقطها فاحصُ الأسرار في
 * GitHub فيرفض الدفعةَ كلَّها — والمستودعُ عامّ. فلا يُودَع: يُرفع متغيّرَ ملفٍّ في EAS باسم `GOOGLE_SERVICES_JSON`
 * (بيئة production)، وEAS يضع مسارَه هنا وقتَ البناء. محلّيّاً: انسخه إلى `apps/mobile/google-services.json` (مُهمَل في git).
 *
 * 🔴 المتغيّرُ غائبٌ ⇒ البناءُ يفشل عند ملفٍّ غير موجود — عمداً: بناءٌ ينجح بلا Firebase يشحن تطبيقاً لا يستلم إشعاراً
 * ولا يقول ذلك.
 *
 * بقيّةُ الإعداد في `app.json` كما هي؛ هذا الملفُّ يضيف الحقلَ الواحد.
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});
