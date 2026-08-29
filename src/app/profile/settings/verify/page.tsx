import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { getVerificationScreen } from "@/lib/actions";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { VerifyScreen } from "@/components/settings/VerifyScreen";

/**
 * 🆕 **الإعدادات ← الحساب ← طلب التوثيق** (D-775، مسارُ أحمد حرفاً).
 *
 * **والصفحةُ خادميّةٌ تقرأ ثمّ تسلّم**: الأهليّةُ والحالةُ والمزوّدون
 * يُقرأون في موجةٍ واحدةٍ من القاعدة (`getVerificationScreen`)،
 * **والشاشةُ ترسم ما وصلها ولا تحسب شيئاً** (D-145).
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const { eligibility, state, providers } = await getVerificationScreen();

  return (
    <SettingsPageLayout title={t.verifyTitle} fallbackHref="/profile/settings/account">
      <VerifyScreen
        locale={locale}
        eligibility={eligibility}
        state={state}
        providers={providers}
      />
    </SettingsPageLayout>
  );
}
