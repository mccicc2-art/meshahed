import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { PrivacyData } from "@/components/PrivacyData";
import { planNameOf } from "@/lib/plan";

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
      <SettingsGroup>
        <SettingsRow
          href="/profile/edit"
          icon="edit"
          title={t.setNameHandle}
          value={username ? `@${username}` : undefined}
        />
        <SettingsRow icon="mail" title={t.emailSection} subtitle={user.email ?? ""} />
        {/* 🆕 **بابُ التوثيق هنا بنصِّ أحمد** (D-775): «الأفضل يكون طلب
            التوثيق من: الإعدادات ← الحساب ← طلب التوثيق» — **وبابٌ
            واحدٌ في الموضع الذي طلبه، لا في فهرسٍ يُمرَّر بالإبهام.** */}
        <SettingsRow
          href="/profile/settings/verify"
          icon="shield"
          title={t.verifyTitle}
          subtitle={t.verifySub}
        />
        {/* 🆕 **الخطّةُ تُقرأ لا تُفترض** (D-780) — والحكمُ من
            `planNameOf` نفسِها التي يقرؤها الفهرسُ والفوترة. */}
        <SettingsRow
          href="/profile/settings/billing"
          icon="card"
          title={t.setBilling}
          value={planNameOf(p, t)}
        />
      </SettingsGroup>

      <PrivacyData locale={locale} only={["delete"]} />
    </SettingsPageLayout>
  );
}
