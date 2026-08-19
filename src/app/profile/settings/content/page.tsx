import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT, getWatchRegion } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { RegionSwitch } from "@/components/RegionSwitch";
import { ProfileForm } from "@/components/ProfileForm";

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
  const p = await getProfile();

  return (
    <SettingsPageLayout title={t.setContent}>
      <ProfileForm
        userId={user.id}
        email={user.email ?? ""}
        locale={locale}
        initialNickname={p?.nickname ?? ""}
        initialAvatarUrl={p?.avatar_url ?? null}
        initialCoverUrl={p?.cover_url ?? null}
        initialCoverPos={p?.cover_pos ?? 30}
        initialAvatarPos={p?.avatar_pos ?? 50}
        initialTheme={p?.theme ?? "amber"}
        initialGenres={p?.favorite_genres ?? []}
        initialBio={p?.bio ?? null}
        only={["genres"]}
      />

      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-[15px] font-bold mb-1">{t.regionSection}</h2>
        <p className="text-[12px] text-muted leading-relaxed mb-3">{t.regionHint}</p>
        <RegionSwitch locale={locale} region={region} />
      </section>
    </SettingsPageLayout>
  );
}
