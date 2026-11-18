import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SupportersBoard } from "@/components/supporters/SupportersBoard";
import { SUPPORTER_WORDS } from "@/components/supporters/supporterWords";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return { title: SUPPORTER_WORDS[locale === "en" ? "en" : "ar"].title, robots: { index: false } };
}

/**
 * 🆕 **«داعمو لوبز»** (T413) — لوحةُ أعضاء Gold كما في التطبيق. صفحةُ الأعضاء: يفتحها المشتركُ وغيرُه من صفحة الاشتراك
 * («ادعم لوبز») ومن سطر «داعم لوبز منذ» في الملفّات.
 */
export default async function SupportersPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale } = await getT();
  return (
    <div className="pb-6">
      <SupportersBoard locale={locale} />
    </div>
  );
}
