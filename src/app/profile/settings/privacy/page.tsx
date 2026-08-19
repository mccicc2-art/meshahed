import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { AccountSettings } from "@/components/AccountSettings";
import { LibraryAccessList } from "@/components/LibraryAccessList";
import { BlockedList } from "@/components/BlockedList";

/** الخصوصيةُ والأمان — **من يراك وماذا يرى** (D-462). */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const p = await getProfile();

  return (
    <SettingsPageLayout title={t.setPrivacy}>
      <p className="px-1 text-[12px] text-muted leading-relaxed">{t.settingsPrivacyHint}</p>

      <AccountSettings
        email={user.email ?? ""}
        initialUsername={p?.username ?? ""}
        locale={locale}
        initialNickname={p?.nickname ?? ""}
        avatarUrl={p?.avatar_url ?? null}
        genres={p?.favorite_genres ?? []}
        initialHideName={!!p?.hide_name}
        initialIsPrivate={!!p?.is_private}
        initialHideFollowLists={
          !!(p as { hide_follow_lists?: boolean } | null)?.hide_follow_lists
        }
        only={["hideName", "privateAccount", "followLists"]}
      />

      {/* استثناءُ «حساب خاص» الفرديّ: منحةُ رؤية المكتبة (D-070) */}
      <LibraryAccessList locale={locale} />
      {/* بابُ الرجوع الوحيد عن الحظر */}
      <BlockedList locale={locale} />
    </SettingsPageLayout>
  );
}
