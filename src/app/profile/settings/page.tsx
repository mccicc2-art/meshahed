import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { AccountSettings } from "@/components/AccountSettings";

export default async function AccountSettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/profile" className="text-sm text-muted hover:text-foreground">
        → رجوع للملف الشخصي
      </Link>
      <h1 className="text-2xl font-bold mt-3 mb-6">إعدادات الحساب</h1>

      <AccountSettings
        email={user.email ?? ""}
        initialUsername={profile?.username ?? ""}
        initialNickname={profile?.nickname ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        genres={profile?.favorite_genres ?? []}
      />
    </div>
  );
}
