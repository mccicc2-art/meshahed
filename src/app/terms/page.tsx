import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { TermsDoc } from "@/components/legal/TermsDoc";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The rules for using Loopz, in plain language.",
};

/**
 * شروط الاستخدام.
 *
 * صفحةٌ عامّة بلا حارس، لنفس سبب صفحة الخصوصية: شاشة موافقة Google تطلب
 * رابطاً يفتحه أي زائر. والنصّ داخل الملف لا في القاموس المشترك.
 */
export default async function TermsPage() {
  /* النصُّ في `TermsDoc` — تشاركه النسخةُ العارية `/app/terms` (D-1345) */
  return <TermsDoc locale={await getLocale()} />;
}
