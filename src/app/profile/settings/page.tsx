import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SignOutRow } from "@/components/settings/SignOutRow";

/**
 * الإعدادات — **فهرسٌ لا لوحة** (D-462، مواصفةُ أحمد).
 *
 * **وكانت تبويباتٍ أفقيّةً تُسحب فوق لوحٍ واحد**: سبعةُ أقسامٍ في صفٍّ
 * ضيّق — **ثلاثةٌ منها تُرى والباقي خلف الحافّة** — **ولوحٌ يتبدّل تحتها
 * بلا أن يتبدّل الرابط**، فلا يُشارَك قسمٌ ولا يعود إليه زرُّ الرجوع.
 *
 * **والآن صفحةٌ لكلِّ قسم**: الرابطُ يقول أين أنت، **وزرُّ الرجوع يعني
 * الرجوع**، **والفهرسُ يُقرأ كلُّه في شاشةٍ واحدة** بدل أن يُسحب.
 *
 * ⚠️ **ولا شيءَ سقط**: كلُّ ما كان في التبويبات انتقل إلى صفحته —
 * **والأقسامُ ثلاثٌ لأن الأسئلة ثلاثة**: كيف يبدو التطبيقُ لك · من يراك ·
 * وأين بياناتُك.
 */
export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { t } = await getT();
  const profile = await getProfile();
  const username = profile?.username ?? "";
  const displayName = profile?.nickname || username || (user.email ?? "").split("@")[0];

  return (
    <SettingsPageLayout
      title={t.settingsNavHeading}
      fallbackHref="/"
      action={
        /* البحثُ في الإعدادات — **بابُه صفحةُ البحث العامّة حتى يُبنى
           بحثٌ خاصٌّ بها**: **رمزٌ لا يفعل شيئاً أسوأ من رمزٍ غائب**
           (D-138)، ولا يُدَّعى بحثٌ لم يُكتب. */
        <Link
          href="/search"
          aria-label={t.setSearchAria}
          className="grid place-items-center w-11 h-11 -me-2 rounded-full text-foreground hover:text-accent active:scale-95 transition"
        >
          <Icon name="search" size={20} />
        </Link>
      }
    >
      {/* ===== بطاقةُ الحساب ===== */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-3 p-3.5">
          <Avatar
            src={profile?.avatar_url ?? null}
            name={displayName}
            size={52}
            alt=""
            posY={profile?.avatar_pos ?? 50}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold truncate" dir="auto">
              {displayName}
            </span>
            {username && (
              <span className="block text-[12px] font-medium text-muted truncate" dir="ltr">
                @{username}
              </span>
            )}
          </span>
          {/* **زرُّ التعديل وسهمُ الملفّ بابان لغرفتين لا لغرفةٍ واحدة**:
              هذا يفتح التحرير، والسهمُ يفتح ما يراه الناس. */}
          <Link
            href="/profile/edit"
            className="shrink-0 rounded-2xl border border-border px-3.5 h-9 inline-flex items-center text-[12px] font-semibold hover:border-accent/50 active:scale-95 transition"
          >
            {t.setEditProfile}
          </Link>
          {username && (
            <Link
              href={`/u/${username}`}
              aria-label={t.setOpenProfile}
              className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-accent active:scale-95 transition"
            >
              <Icon name="chevron-down" size={18} className="-rotate-90 rtl:rotate-90" />
            </Link>
          )}
        </div>
      </div>

      {/* ===== بطاقةُ الخطّة =====
          ⚠️ **«مجّاني» ليست قيمةً ثابتة بل حالةَ الحساب الحقيقيّة**:
          **لا جدولَ اشتراكاتٍ في القاعدة بعد**، فكلُّ حسابٍ مجّانيٌّ
          فعلاً — **والاسمُ يصير من البيانات يومَ توجد** (مسجَّلٌ في
          `DECISIONS_NEEDED`). */}
      <div className="rounded-2xl border border-border bg-surface p-3.5 flex items-center gap-3">
        <span className="shrink-0 grid place-items-center w-10 h-10 rounded-2xl bg-surface-2">
          <Icon name="sparkle-star" size={22} style={{ color: "var(--accent)" }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold truncate">{t.setPlanFree}</span>
          <span className="block text-[12px] font-medium text-muted truncate">
            {t.setPlanFreeSub}
          </span>
        </span>
        <Link
          href="/features"
          className="shrink-0 rounded-2xl border border-accent text-accent px-3.5 h-9 inline-flex items-center text-[12px] font-semibold hover:bg-accent/10 active:scale-95 transition"
        >
          {t.setViewPlans}
        </Link>
      </div>

      <SettingsGroup label={t.setGroupPersonalize}>
        <SettingsRow
          href="/profile/settings/home"
          icon="home"
          title={t.setHomeProfile}
          subtitle={t.setHomeProfileSub}
        />
        <SettingsRow
          href="/profile/settings/appearance"
          icon="palette"
          title={t.setAppearance}
          subtitle={t.setAppearanceSub}
        />
        <SettingsRow
          href="/profile/settings/content"
          icon="film"
          title={t.setContent}
          subtitle={t.setContentSub}
        />
      </SettingsGroup>

      <SettingsGroup label={t.setGroupAccount}>
        <SettingsRow
          href="/profile/settings/account"
          icon="person-check"
          title={t.setAccount}
          subtitle={t.setAccountSub}
        />
        <SettingsRow
          href="/profile/settings/privacy"
          icon="shield"
          title={t.setPrivacy}
          subtitle={t.setPrivacySub}
        />
        <SettingsRow
          href="/profile/settings/notifications"
          icon="bell"
          title={t.setNotifications}
          subtitle={t.setNotificationsSub}
        />
      </SettingsGroup>

      <SettingsGroup label={t.setGroupData}>
        <SettingsRow
          href="/profile/settings/import"
          icon="download"
          title={t.setImport}
          subtitle={t.setImportSub}
        />
        <SettingsRow href="/profile/settings/billing" icon="card" title={t.setBilling} />
        <SettingsRow href="/profile/settings/help" icon="comment" title={t.setHelp} />
        <SettingsRow href="/profile/settings/about" icon="info" title={t.setAbout} />
      </SettingsGroup>

      {/* **الخروجُ في صفٍّ وحدَه** — **وحذفُ الحساب ليس بجواره**: فعلٌ
          يومئٌ وفعلٌ لا رجعةَ فيه لا يجلسان متلاصقين (مواصفةُ أحمد).
          والحذفُ داخل «الحساب» في منطقة خطرٍ معلَّمة. */}
      <SettingsGroup>
        <SignOutRow label={t.signOut} />
      </SettingsGroup>
    </SettingsPageLayout>
  );
}
