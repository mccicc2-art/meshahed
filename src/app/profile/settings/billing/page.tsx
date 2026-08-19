import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { Icon } from "@/components/Icon";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsSoon } from "@/components/settings/SettingsSoon";

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
      <SettingsSoon title={t.settingsSoonTitle} body={t.settingsBillingHint} icon="card" />
      <Link
        href="/features"
        className="inline-flex items-center gap-2 text-14 font-medium text-accent hover:underline"
      >
        <Icon name="sparkle-star" size={16} />
        {t.featuresLink}
      </Link>
    </SettingsPageLayout>
  );
}
