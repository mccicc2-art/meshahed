import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { PrivacyDoc } from "@/components/legal/PrivacyDoc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Loopz stores, why, and how to get it back or delete it.",
};

/**
 * سياسة الخصوصية.
 *
 * صفحةٌ عامّة بلا حارس: `getUser()` غير مستدعاة هنا عمداً. شاشة موافقة
 * Google تشترط رابطاً يفتحه أي زائر — ولو حرسناها بتسجيل الدخول لسقط
 * التحقّق عند أول فحص، وهي أصلاً وثيقةٌ يقرؤها من لم يسجّل بعد.
 *
 * والنصّ هنا لا في `i18n.ts`: القاموس يُشحن كاملاً إلى المتصفّح في كل
 * صفحة (~١٦ كيلوبايت مضغوطة)، ووثيقتان قانونيتان طويلتان فيه ضريبةٌ على
 * كل شاشةٍ في التطبيق مقابل صفحةٍ تُفتح مرّةً في العمر.
 */
export default async function PrivacyPage() {
  /* النصُّ في `PrivacyDoc` — تشاركه النسخةُ العارية `/app/privacy` (D-1345) */
  return <PrivacyDoc locale={await getLocale()} />;
}
