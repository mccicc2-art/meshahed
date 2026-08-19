import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ProfileForm } from "@/components/ProfileForm";

/** المظهرُ واللغة — **الثيمُ ولغةُ الواجهة** (D-462). */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const p = await getProfile();

  return (
    <SettingsPageLayout title={t.setAppearance}>
      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-[15px] font-bold mb-1">{t.languageSection}</h2>
        <p className="text-[12px] text-muted leading-relaxed mb-3">{t.languageHint}</p>
        <LanguageSwitch locale={locale} />
      </section>

      {/* الثيمُ من `ProfileForm` بحدِّه — **ولا نموذجٌ ثانٍ يكتب في نفس
          الجدول** (حجّةُ `only` الأصليّة: نموذجان معاً يكتب حفظُ أحدهما
          قيمَ الآخر الابتدائية فوق تعديلٍ لم يُحفظ). */}
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
        only={["theme"]}
      />
    </SettingsPageLayout>
  );
}
