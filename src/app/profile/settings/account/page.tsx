import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { settingsCardRows } from "@/components/settings/SettingsGroup";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { PrivacyData } from "@/components/PrivacyData";

/**
 * الحساب — **البريدُ ومنطقةُ الخطر، والاسمُ بابُه «تعديل الملف»**
 * (D-462).
 *
 * ⚠️ **ولا نموذجَ هنا عمداً**: كان القسمُ يعرض `AccountSettings` بزرِّ
 * حفظٍ — **وذلك الحفظُ يرسل `is_private` و`hide_follow_lists` بقيمتهما
 * الافتراضيّة `false` لأن الصفحة لا تعرفهما** — **فحفظُ صفحةٍ لا تملك
 * القيمةَ يمحو ما ضُبط في صفحةٍ أخرى.** **وحقلٌ للقراءة لا يحتاج زرَّ
 * حفظٍ أصلاً.**
 *
 * **وحذفُ الحساب هنا لا في الفهرس** (مواصفةُ أحمد): **فعلٌ لا رجعةَ فيه
 * لا يجلس في قائمةٍ تُمرَّر بالإبهام** — **بابُه صفحةٌ تُفتح قصداً**،
 * وتحصينُه الثنائيُّ باقٍ كما هو (ضغطةٌ تُسلّح وأخرى تُنفّذ).
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const p = await getProfile();
  const username = p?.username ?? "";

  return (
    <SettingsPageLayout title={t.setAccount}>
      <SettingsSection hint={t.emailHint}>
        <div className={settingsCardRows}>
          <SettingsRow
            href="/profile/edit"
            icon="edit"
            title={t.setNameHandle}
            subtitle={t.setNameHandleSub}
            value={username ? `@${username}` : undefined}
          />
          {/* **البريدُ يُعرض ولا يُعدَّل**: الدخولُ عبر Google وحدَه،
              **وحقلٌ يُكتب فيه ولا يُحفظ أسوأُ من نصٍّ ساكن** (D-217) */}
          <SettingsRow icon="mail" title={t.emailSection} subtitle={user.email ?? ""} />
        </div>
      </SettingsSection>

      {/* **ومنطقةُ الخطر في القاع وحدَها** — بعنوانٍ أحمرَ يقول ما هي
          قبل أن تُقرأ (مواصفةُ أحمد) */}
      <div>
        <h2 className="px-1 mb-2 text-12 font-semibold uppercase tracking-wide text-[color:var(--error)]">
          {t.setDangerZone}
        </h2>
        <PrivacyData locale={locale} only={["delete"]} />
      </div>
    </SettingsPageLayout>
  );
}
