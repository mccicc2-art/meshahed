import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsSoon } from "@/components/settings/SettingsSoon";

/**
 * الإشعارات — **حالةٌ مُعلنة لا مفاتيحُ كاذبة** (D-462).
 *
 * ⚠️ **ولا مفتاحَ واحدٌ هنا عمداً**: **لا عمودَ تفضيلاتٍ في `profiles`
 * ولا قناةَ دفعٍ ولا بريد** — **ومفتاحٌ يُقلَب ولا يُخزَّن كذبةٌ تُكتشف
 * بعد إعادة التحميل** (D-217/D-030). **والجرسُ يبقى المصدرَ الحقيقيّ**
 * لما وصل. يُبنى القسمُ يومَ تُبنى القناة، ومطلبُه مسجَّلٌ في
 * `DECISIONS_NEEDED`.
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { t } = await getT();

  return (
    <SettingsPageLayout title={t.setNotifications}>
      <SettingsSoon title={t.settingsSoonTitle} body={t.setNotifSoonBody} icon="bell" />
      <p className="text-[12px] text-muted text-center">{t.setNotifBellHint}</p>
    </SettingsPageLayout>
  );
}
