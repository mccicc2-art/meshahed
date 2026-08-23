import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { HelpTourRows } from "@/components/settings/HelpTourRows";

/**
 * المساعدةُ والملاحظات — **بابٌ واحدٌ لأنه الباب الوحيد الموجود**
 * (D-462).
 *
 * ⚠️ **والبريدُ ليس مخترعاً هنا**: **هو نفسُه المنشورُ في «الشروط»
 * و«سياسة الخصوصية»** — **وعنوانان للتواصل في تطبيقٍ واحد يجعلان
 * أحدَهما بلا ردّ** (القاعدة ٦). **ولا مركزَ مساعدةٍ يُدَّعى** قبل أن
 * يُكتب.
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();

  return (
    <SettingsPageLayout title={t.setHelp}>
      {/* التعرّف على التطبيق — الجولة تُعاد من هنا في أي وقت (شرطها)،
          والتلميحاتُ المطفأة تُعاد من جارتها. سطحان لا سطح: الجولة
          رحلةٌ عبر الصفحات، والتلميح سطرٌ في صفحته. */}
      <SettingsGroup label={t.helpLearnGroup}>
        <HelpTourRows locale={locale} />
      </SettingsGroup>

      <SettingsGroup label={t.helpSupportGroup}>
        <SettingsRow
          href="mailto:alharbiahmed3bd@gmail.com"
          icon="mail"
          title={t.setHelpContact}
          subtitle={t.setHelpContactSub}
        />
        <SettingsRow href="/profile/settings/about" icon="info" title={t.setHelpDocs} />
      </SettingsGroup>
    </SettingsPageLayout>
  );
}
