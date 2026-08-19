import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { CustomizeTabs } from "@/components/settings/CustomizeTabs";

/**
 * الرئيسيةُ والملفّ — **سطحان لا صفحتان** (D-129، ومكانُه الآن صفحتُه).
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const p = await getProfile();

  return (
    <SettingsPageLayout title={t.setHomeProfile}>
      <CustomizeTabs
        locale={locale}
        nickname={p?.nickname ?? ""}
        avatarUrl={p?.avatar_url ?? null}
        genres={p?.favorite_genres ?? []}
        homePrefs={p?.home_prefs}
        profilePrefs={p?.profile_prefs}
      />
    </SettingsPageLayout>
  );
}
