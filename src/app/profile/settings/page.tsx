import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { AccountSettings } from "@/components/AccountSettings";

export default async function AccountSettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const profile = await getProfile();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          {t.backToProfile}
        </Link>
        <Link href="/profile/edit" className="text-sm text-accent hover:brightness-110">
          {t.editProfile} ›
        </Link>
      </div>
      <h1 className="text-2xl font-bold mt-3 mb-6">{t.settingsTitle}</h1>

      <AccountSettings
        email={user.email ?? ""}
        locale={locale}
        initialUsername={profile?.username ?? ""}
        initialNickname={profile?.nickname ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        genres={profile?.favorite_genres ?? []}
      />
    </div>
  );
}
