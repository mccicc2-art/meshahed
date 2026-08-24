import { redirect } from "next/navigation";
import { getUser, getContentPrefs } from "@/lib/data";
import { getT, getWatchRegion, getTitleMode } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { RegionSwitch } from "@/components/RegionSwitch";
import { TitleModeSection } from "@/components/settings/TitleModeSection";
import {
  ContentPrefsSection,
  ContentPrefsReset,
} from "@/components/settings/ContentPrefsSection";

/**
 * تفضيلاتُ المحتوى — **الأنواعُ وبلدُ المشاهدة** (D-462، مواصفةُ أحمد:
 * «انقل Favourite genres وWatch country إلى Content preferences»).
 *
 * **وكانا في مكانين لا يجمعهما معنى**: الأنواعُ في «تعديل الملفّ»
 * والبلدُ في «المظهر» — **وكلاهما يجيب سؤالاً واحداً: ماذا يُعرض عليّ.**
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const region = await getWatchRegion();
  const titleMode = await getTitleMode();
  const contentPrefs = await getContentPrefs();

  return (
    <SettingsPageLayout title={t.setContent}>
      <ContentPrefsSection locale={locale} initial={contentPrefs} signedIn />

      <SettingsGroup>
        <TitleModeSection locale={locale} initialMode={titleMode} />
        <RegionSwitch locale={locale} region={region} />
      </SettingsGroup>

      <ContentPrefsReset locale={locale} />
    </SettingsPageLayout>
  );
}
