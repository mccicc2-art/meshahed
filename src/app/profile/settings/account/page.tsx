import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SignOutRow } from "@/components/settings/SignOutRow";
import { PrivacyData } from "@/components/PrivacyData";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { GoogleMark } from "@/components/GoogleButton";
import { PlanWordmark } from "@/components/plus/PlanWordmark";
import { buttonClass } from "@/components/ui/Button";
import { hasGoldBadge, isPlus, planNameOf } from "@/core/plan";

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
 *
 * 🆕 T416 — **مجموعاتُ التطبيق الأربع** (تصميم أ، أحمد ١٨ نوفمبر) تحت رأسٍ بصورتك واسمك: «معلومات الحساب» · «طرق تسجيل
 * الدخول» · «توثيق الحساب» · «إدارة الحساب». سؤالُه «وين يعدل الصورة؟» جوابُه الرأس: الصورةُ وزرُّ «تعديل الملف» بابان إلى
 * صفحة الهويّة نفسِها — لا حقلَ ثانٍ للصورة هنا (D-462: الهويّةُ لها كاتبٌ واحد).
 * ⚖️ **وبلا «إضافة طريقة دخول»**: الويبُ يُدخل بـGoogle وحدَه فمن هنا عنده Google أصلاً، وApple يُربط من التطبيق على
 * iPhone (القرار ٣). فالمجموعةُ تقول ما هو مرتبط و«إدارة» تفتح صفحةَ المزوّد — فكُّ الربط يُدار هناك كما في التطبيق.
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const p = await getProfile();
  const username = p?.username ?? "";
  const name = p?.nickname || username || user.email || "";

  /* المزوّداتُ من GoTrue نفسِها (`app_metadata.providers`) — لا تُفترض */
  const meta = (user.app_metadata ?? {}) as { providers?: unknown; provider?: unknown };
  const providers = Array.isArray(meta.providers)
    ? meta.providers.filter((x): x is string => typeof x === "string")
    : typeof meta.provider === "string"
      ? [meta.provider]
      : [];
  const hasGoogle = providers.includes("google");
  const hasApple = providers.includes("apple");
  /* «تم التحقق» لأنّ الدخولَ بمزوّدٍ وحدَه: هو من تحقّق من البريد — حكمُ شاشة التطبيق نفسُه */
  const verified = hasGoogle || hasApple;
  const tier = hasGoldBadge(p) ? "gold" : isPlus(p) ? "plus" : null;

  const linked = (href: string) => (
    <span className="shrink-0 flex items-center gap-2.5">
      <span className="hidden sm:inline-flex items-center gap-1 text-12 font-bold text-[color:var(--success)]">
        <Icon name="check-line" size={13} strokeWidth={2.4} />
        {t.linkGoogleLinked}
      </span>
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "surface", size: "sm" })}>
        {t.appManage}
      </a>
    </span>
  );

  return (
    <SettingsPageLayout title={t.appAccountSignIn}>
      {/* رأسُ الهويّة — الصورةُ والزرُّ كلاهما إلى «تعديل الملف» */}
      <section className="rounded-2xl border border-border bg-surface bg-[radial-gradient(90%_120%_at_100%_0%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_60%)] p-4 sm:p-5 flex items-center gap-4">
        <Link href="/profile/edit" aria-label={t.setEditAvatar} className="relative shrink-0">
          <Avatar
            src={p?.avatar_url ?? null}
            name={name}
            size={84}
            alt={t.avatarAlt}
            posY={p?.avatar_pos ?? null}
            boxClass="w-16 h-16 sm:w-[84px] sm:h-[84px] text-2xl"
            className="ring-[3px] ring-accent"
          />
          <span className="absolute -bottom-0.5 -end-1 grid place-items-center w-7 h-7 rounded-full bg-accent text-[color:var(--on-accent)] ring-[3px] ring-[color:var(--surface)]">
            <Icon name="image" size={13} />
          </span>
        </Link>
        <span className="min-w-0 flex-1">
          <b className="block text-[19px] sm:text-[21px] font-extrabold leading-tight truncate">{name}</b>
          {username && (
            <span className="block text-14 text-muted truncate">
              <bdi dir="ltr">@{username}</bdi>
            </span>
          )}
          {tier && (
            <span className="block mt-1.5 text-14">
              <PlanWordmark tier={tier} />
            </span>
          )}
        </span>
        <Link href="/profile/edit" className={buttonClass({ variant: "surface", size: "md", className: "shrink-0" })}>
          <Icon name="edit" size={16} />
          <span className="hidden sm:inline">{t.setEditProfile}</span>
        </Link>
      </section>

      {/* 🆕 R270 — **الحسابُ على الحاسوب** (أحمد ١٩ نوفمبر): «معلومات الحساب» و«طرق تسجيل الدخول» جنباً إلى جنب في لوحة
          الإعدادات العريضة — المجموعتان نفسُهما، والشبكةُ وحدها جديدة. وتحت ١٢٨٠ تحت بعضهما كما كانتا. */}
      <div className="space-y-4 desk:grid desk:grid-cols-2 desk:items-start desk:gap-4 desk:space-y-0">
      <SettingsGroup label={t.appAccountInfo}>
        <SettingsRow
          href="/profile/edit"
          icon="edit"
          title={t.setNameHandle}
          value={username ? `@${username}` : undefined}
        />
        <SettingsRow
          icon="mail"
          title={t.emailSection}
          subtitle={user.email ?? ""}
          trailing={
            verified ? (
              <span className="shrink-0 inline-flex items-center gap-1.5 text-12 text-muted">
                <span className="grid place-items-center w-[18px] h-[18px] rounded-full bg-accent text-[color:var(--on-accent)]">
                  <Icon name="check-line" size={11} strokeWidth={2.6} />
                </span>
                {t.appEmailVerified}
              </span>
            ) : undefined
          }
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

      {(hasGoogle || hasApple) && (
        <SettingsGroup label={t.appSignInMethods}>
          {hasGoogle && (
            <SettingsRow
              leading={<GoogleMark size={20} />}
              title={t.appGoogleAccount}
              trailing={linked("https://myaccount.google.com/connections")}
            />
          )}
          {hasApple && (
            <SettingsRow
              icon="person-check"
              title={t.appAppleAccount}
              trailing={linked("https://account.apple.com/account/manage")}
            />
          )}
        </SettingsGroup>
      )}
      </div>

      {/* 🆕 **بابُ التوثيق هنا بنصِّ أحمد** (D-775): «الأفضل يكون طلب
          التوثيق من: الإعدادات ← الحساب ← طلب التوثيق» — **وبابٌ
          واحدٌ في الموضع الذي طلبه، لا في فهرسٍ يُمرَّر بالإبهام.** */}
      <SettingsGroup label={t.appVerifyGroup}>
        <SettingsRow
          href="/profile/settings/verify"
          icon="shield"
          title={t.verifyTitle}
          subtitle={t.appVerifySub}
        />
      </SettingsGroup>

      <PrivacyData
        locale={locale}
        only={["delete"]}
        dangerLabel={t.appManageAccount}
        dangerLead={<SignOutRow label={t.appSignOut} />}
      />
    </SettingsPageLayout>
  );
}
