import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">الملف الشخصي</h1>
      <ProfileForm
        userId={user.id}
        email={user.email ?? ""}
        initialNickname={profile?.nickname ?? ""}
        initialAvatarUrl={profile?.avatar_url ?? null}
        initialGenres={profile?.favorite_genres ?? []}
      />

      <form action="/auth/signout" method="post" className="mt-10 sm:hidden">
        <button className="w-full py-3 rounded-xl border border-border text-muted hover:text-red-300 hover:border-red-400/60 transition">
          تسجيل الخروج
        </button>
      </form>
    </div>
  );
}
