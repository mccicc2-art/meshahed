import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";

/**
 * الاشتراكُ والفوترة — **منقولٌ كما هو من تبويب `billing`** (D-462).
 *
 * ⚠️ **ولا شيءَ اختُرع هنا**: **لا جدولَ اشتراكاتٍ في القاعدة**، فبقي
 * اللوحُ يقول ذلك — **وصفحةُ المميزات بابُه الوحيد** لأن السؤال الذي
 * يجلب المستخدمَ إلى هذا القسم هو «ما المجّانيُّ وما المدفوع؟».
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { t } = await getT();

  return (
    <SettingsPageLayout title={t.setBilling}>
      <SettingsGroup>
        <SettingsRow icon="card" title={t.setPlanFree} value={t.setPlanActive} />
        <SettingsRow
          href="/features"
          icon="sparkle-star"
          title={t.setViewPlans}
          subtitle={t.setPlanComing}
        />
      </SettingsGroup>
    </SettingsPageLayout>
  );
}
