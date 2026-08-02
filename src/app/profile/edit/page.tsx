import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { ProfileForm } from "@/components/ProfileForm";

export default async function EditProfilePage() {
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
        <Link href="/profile/settings" className="text-sm text-accent hover:brightness-110">
          {t.accountSettings} ›
        </Link>
      </div>
      <h1 className="text-2xl font-bold mt-3 mb-6">{t.editProfile}</h1>

      <ProfileForm
        userId={user.id}
        email={user.email ?? ""}
        locale={locale}
        initialNickname={profile?.nickname ?? ""}
        initialAvatarUrl={profile?.avatar_url ?? null}
        initialCoverUrl={profile?.cover_url ?? null}
        initialTheme={profile?.theme ?? "amber"}
        initialGenres={profile?.favorite_genres ?? []}
      />
    </div>
  );
}
