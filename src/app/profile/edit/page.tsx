import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { ProfileForm } from "@/components/ProfileForm";

export default async function EditProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/profile" className="text-sm text-muted hover:text-foreground">
        → رجوع للملف الشخصي
      </Link>
      <h1 className="text-2xl font-bold mt-3 mb-6">تعديل الملف الشخصي</h1>

      <ProfileForm
        userId={user.id}
        email={user.email ?? ""}
        initialNickname={profile?.nickname ?? ""}
        initialAvatarUrl={profile?.avatar_url ?? null}
        initialGenres={profile?.favorite_genres ?? []}
      />
    </div>
  );
}
