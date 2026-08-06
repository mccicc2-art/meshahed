import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsShell } from "@/components/SettingsShell";

/**
 * الإعدادات — صفحة واحدة بقائمة جانبية.
 *
 * كانت موزّعة على «تعديل الملف» و«إعدادات الحساب»، فصارت هنا كلها:
 * الملف والحساب والخصوصية والمظهر والتخصيص، ومكانان محجوزان لما لم
 * يُبنَ بعد. و`/profile/edit` صار يحوّل إلى هنا فلا يبقى بابان لغرفة.
 */
const SECTIONS = [
  "profile",
  "account",
  "privacy",
  "appearance",
  "customize",
  "widgets",
  "billing",
] as const;

type SectionKey = (typeof SECTIONS)[number];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const profile = await getProfile();
  const { s } = await searchParams;

  const initial: SectionKey = (SECTIONS as readonly string[]).includes(s ?? "")
    ? (s as SectionKey)
    : "profile";

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        {t.backToProfile}
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-4">{t.settingsNavHeading}</h1>

      <SettingsShell
        userId={user.id}
        email={user.email ?? ""}
        locale={locale}
        nickname={profile?.nickname ?? ""}
        username={profile?.username ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        coverUrl={profile?.cover_url ?? null}
        coverPos={profile?.cover_pos ?? 30}
        avatarPos={profile?.avatar_pos ?? 50}
        theme={profile?.theme ?? "amber"}
        genres={profile?.favorite_genres ?? []}
        hideName={!!profile?.hide_name}
        homePrefs={profile?.home_prefs}
        initial={initial}
      />
    </div>
  );
}
