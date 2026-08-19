import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { traktConfigured } from "@/lib/trakt";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { ImportPanel } from "@/components/ImportPanel";
import { PrivacyData } from "@/components/PrivacyData";

/**
 * الاستيرادُ والتصدير — **بياناتُك داخلةً وخارجة** (D-462).
 *
 * **والتصديرُ انتقل إلى هنا من «الخصوصية»**: كان بجوار حذفِ الحساب
 * **لأن كليهما «بياناتُك»** — **والسؤالُ الذي يجمعه بالاستيراد أقربُ**:
 * كيف تدخل مكتبتُك وكيف تخرج.
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();

  return (
    <SettingsPageLayout title={t.setImport}>
      <ImportPanel locale={locale} traktReady={traktConfigured()} />
      <PrivacyData locale={locale} only={["export"]} />
    </SettingsPageLayout>
  );
}
