import { redirect } from "next/navigation";
import { getUser, getProfile, getMyDmPolicy } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { AccountSettings } from "@/components/AccountSettings";
import { LibraryAccessList } from "@/components/LibraryAccessList";
import { BlockedList } from "@/components/BlockedList";
import { DmPolicySection } from "@/components/settings/DmPolicySection";
import { MatchCardConsent } from "@/components/settings/MatchCardConsent";

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
  const [p, dmPolicy] = await Promise.all([getProfile(), getMyDmPolicy()]);

  return (
    <SettingsPageLayout title={t.setPrivacy}>
      {/* **بلا عنوانِ قسم**: هذه هي الصفحةُ نفسُها، **وعنوانٌ يكرّر
          عنوانَ الترويسة فوقه مباشرةً كلمةٌ ضائعة.** */}
      {/* 🆕 R270 — **الخصوصيةُ على الحاسوب** (أحمد ١٩ نوفمبر): المفاتيحُ الثلاثة و«من يقدر يراسلني» جنباً إلى جنب، ثمّ
          «من يرى مكتبتي» والمحظورون جنباً إلى جنب — المكوّناتُ نفسُها، والشبكةُ وحدها جديدة. وتحت ١٢٨٠ كما كانت. */}
      <div className="desk:hidden space-y-4">
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
      {/* 🆕 T596 — اسمي في بطاقات تطابق الذوق (س٩ «أ»): مطفأٌ افتراضيّاً، ويغيب قبل الهجرة ٢٧٣ */}
      <MatchCardConsent locale={locale} />

      <SettingsGroup label={t.setGroupPeople}>
        {/* 🆕 D-1380 — «من يقدر يراسلني» أوّلَ مجموعة الناس: سؤالٌ عن الناس لا عن الملفّ */}
        <DmPolicySection locale={locale} initial={dmPolicy} />
        <LibraryAccessList locale={locale} />
        <BlockedList locale={locale} />
      </SettingsGroup>
      </div>
      <div className="hidden desk:grid grid-cols-2 items-start gap-4">
      {/* المفاتيحُ والمفتاحُ الرابع في خانةٍ واحدة: الشبكةُ تبقى زوجين زوجين */}
      <div className="space-y-4">
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
      {/* 🆕 T596 — اسمي في بطاقات تطابق الذوق (س٩ «أ»): مطفأٌ افتراضيّاً، ويغيب قبل الهجرة ٢٧٣ */}
      <MatchCardConsent locale={locale} />
      </div>

      <SettingsGroup label={t.setGroupPeople}>
        <DmPolicySection locale={locale} initial={dmPolicy} />
      </SettingsGroup>
      <SettingsGroup>
        <LibraryAccessList locale={locale} />
      </SettingsGroup>
      <SettingsGroup>
        <BlockedList locale={locale} />
      </SettingsGroup>
      </div>
    </SettingsPageLayout>
  );
}
