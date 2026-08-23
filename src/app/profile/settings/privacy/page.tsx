import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { AccountSettings } from "@/components/AccountSettings";
import { LibraryAccessList } from "@/components/LibraryAccessList";
import { BlockedList } from "@/components/BlockedList";

/**
 * الخصوصيةُ والأمان — **من يراك وماذا يرى** (D-462).
 *
 * 🆕 **وخمسُ بطاقاتٍ صارت بطاقةً وصفّين** (D-555): ثلاثةُ مفاتيحَ في
 * بطاقةٍ واحدة، **وقائمتا الناس صفّان يقولان عددَهما وورقتان تفتحانهما**
 * — **وكلتاهما فارغةٌ عند أكثر الحسابات**، **وبطاقةٌ كاملةٌ تقول «لا
 * أحد» أسوأُ استعمالٍ لشاشةٍ ممكن.**
 *
 * ⚠️ **والتلميحُ العامُّ في الأعلى سقط**: **كان يقول ما تقوله المفاتيحُ
 * الثلاثةُ تحته بسطرِها** — **وشرحٌ يُقرأ مرّتين لا يُقرأ مرّة.**
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const p = await getProfile();

  return (
    <SettingsPageLayout title={t.setPrivacy}>
      {/* **بلا عنوانِ قسم**: هذه هي الصفحةُ نفسُها، **وعنوانٌ يكرّر
          عنوانَ الترويسة فوقه مباشرةً كلمةٌ ضائعة.** */}
      <AccountSettings
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

      <SettingsSection label={t.setGroupPeople}>
        <div className="space-y-3">
          {/* استثناءُ «حساب خاص» الفرديّ: منحةُ رؤية المكتبة (D-070) */}
          <LibraryAccessList locale={locale} />
          {/* بابُ الرجوع الوحيد عن الحظر */}
          <BlockedList locale={locale} />
        </div>
      </SettingsSection>
    </SettingsPageLayout>
  );
}
