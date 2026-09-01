import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { AccountBadges } from "@/components/AccountIdentity";
import { planNameOf } from "@/lib/plan";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup, settingsCardRows } from "@/components/settings/SettingsGroup";
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
 * ================= 🆕 ثلاثةٌ سقطت من الفهرس (D-555) =================
 *
 * **١) زرُّ البحث في الترويسة.** **كان يفتح البحثَ العامّ** — **رمزُ
 * عدسةٍ في ترويسةِ الإعدادات يَعِد ببحثٍ في الإعدادات ويُخرجك منها إلى
 * الأفلام.** **ووعدٌ يُخلَف أسوأُ من غيابٍ صريح** (D-030/D-138).
 * **ووعدُه لا يُنقذه أن البحثَ العامَّ نافع**: البابُ الذي يقول شيئاً
 * ويفعل غيرَه يُفقد الثقةَ في بقيّة الأبواب.
 *
 * **٢) بطاقةُ «Loopz مجّاني».** **لا جدولَ اشتراكاتٍ في القاعدة** —
 * **فالبطاقةُ تعرض حالةً لا مصدرَ لها وزرَّها يفتح صفحةَ المميزات**،
 * **وبطاقةٌ كاملةٌ لرابطٍ واحدٍ إلى صفحةٍ تعريفيّة** تحتلّ أثمنَ موضعٍ
 * في الفهرس (تحت الحساب مباشرة).
 *
 * **٣) صفُّ «الاشتراك والفوترة».** **بابُه لوحُ «لم يُبنَ بعد» نفسُه**
 * — **وهو والبطاقةُ يقولان الشيءَ ذاته مرّتين** (القاعدة ٦).
 *
 * **٤) صفُّ «الإشعارات».** **بابُه لوحُ «لم يُبنَ بعد» أيضاً.** **ولم
 * يُترك صفّاً معطّلاً بشارة «قريباً»** — **وهو الخيارُ الثاني في
 * المواصفة** — **لأن `SettingsGroup` نفسَها تقول لِمَ**: «قائمةٌ فيها
 * صفٌّ ميّتٌ تُجرَّب قبل أن تُفهم». **والجرسُ في كلِّ صفحةٍ يبقى مصدرَ
 * ما وصل**، فلا شيءَ يُفقد.
 *
 * ⚠️ **ولا مسارَ حُذف**: `/billing` و`/notifications` قائمتان بشيفرتهما
 * — **والذي سقط أبوابُها من الفهرس** (شرطُ المواصفة بنصّه). **يومَ
 * تُبنى القناةُ أو جدولُ الاشتراكات يعود السطر.**
 *
 * **وبطاقةُ الحساب صارت صفّين لا صفّاً فيه أزرار** (المواصفة: «بطاقة
 * حساب واحدة»): **كان فيها زرٌّ بحدٍّ وانحناءٍ داخلَ بطاقةٍ بحدٍّ
 * وانحناء** — **إطارٌ داخل إطار**، وهو ما تشكوه المواصفةُ بالاسم.
 * **والآن: صفٌّ يفتح ملفَّك كما يراه الناس، وصفٌّ يفتح تحريرَه** —
 * **بابان لغرفتين، كلٌّ بصفّه.**
 */
export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { t } = await getT();
  const profile = await getProfile();
  const username = profile?.username ?? "";
  const displayName = profile?.nickname || username || (user.email ?? "").split("@")[0];

  return (
    <SettingsPageLayout title={t.settingsNavHeading} fallbackHref="/">
      {/* ===== بطاقةُ الحساب ===== */}
      <div className={settingsCardRows}>
        {/* 🆕 **وشارتُك تُرى في بطاقتك أنت أوّلاً** (D-773ب): من دفع أو
            وُثّق يرى ذلك حيث يفتح إعداداته.

            🔴 ⚖️ 🆕 **والصفُّ صار باباً واحداً** (D-849، بلاغُ أحمد
            بلقطة: «هنا السهم ما هو شغّال»).

            **وكان بابَين — للوجه وللاسم — والباقي ميّت**: **السهمُ
            والمعرّفُ وكلُّ الفراغ بينهما لا يُضغط**، **والتظليلُ يعمّ
            الصفَّ كلَّه عند المرور** — **فصفٌّ يضيء كلُّه ويحمل سهماً
            ويستجيب في موضعين ضيّقين** (D-217: شكلُ بابٍ على ما ليس
            باباً وعدٌ كاذب · D-030).

            🔑 **وحجّةُ الانقسام سقطت بالقياس لا بالرأي**: **«رابطٌ داخل
            رابطٍ ترميزٌ باطل» صحيحةٌ حين تختلف الوجهتان** — 📏 **والوجهتان
            هنا نصٌّ واحد** (`/u/${username}`) — **فلم يكن هناك رابطان
            يتداخلان أصلاً، بل رابطٌ واحدٌ كُتب مرّتين وتُرك ثلثا الصفِّ
            بلا واحد.** **والشاراتُ أسطرٌ لا روابط** (فُحصت: `PlanPill`
            و`VerifiedBadge` عناصرُ `span` خالصة) — **فلا تداخلَ.**

            ⚖️ **وهذا نقضٌ محصورٌ لتطبيق D-281 هنا وحدَه**: **عُرفُها
            «بابان لوجهتين» باقٍ حيث تختلف الوجهتان** — **والذي سقط
            بابان لوجهةٍ واحدة.**

            🔑 **والوصفةُ وصفةُ `SettingsRow` حرفاً** — **ولا صنفَ صفٍّ
            ثانٍ يُخترع** (القاعدة ٣): **هو صفُّ فهرسٍ كبقيّته، وكلُّ
            الفرق أنّ رمزَه وجهُك.** */}
        <Link
          href={username ? `/u/${username}` : "/profile"}
          className="w-full flex items-center gap-3 p-3.5 text-start transition hover:bg-surface-2 active:opacity-80"
        >
          <Avatar
            src={profile?.avatar_url ?? null}
            name={displayName}
            size={52}
            alt=""
            posY={profile?.avatar_pos ?? 50}
            className="shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center min-w-0" style={{ gap: 4 }}>
              <span className="block min-w-0 truncate text-15 font-bold" dir="auto">
                {displayName}
              </span>
              <AccountBadges profile={profile} t={t} />
            </span>
            {username && (
              <span className="block text-12 font-medium text-muted truncate" dir="ltr">
                @{username}
              </span>
            )}
          </span>
          <Icon
            name="chevron-down"
            size={18}
            className="shrink-0 text-muted -rotate-90 rtl:rotate-90"
          />
        </Link>
      </div>

      <SettingsGroup label={t.setGroupAccount}>
        <SettingsRow href="/profile/edit" icon="edit" title={t.setEditProfile} />
        <SettingsRow href="/profile/settings/account" icon="person-check" title={t.setAccount} />
        {/* 🆕 **والمقبضُ يقول ما خلفَه** (D-780): **كان `setPlanFree`
            نصّاً ثابتاً — فمشتركٌ يرى `PLUS` في بطاقته وسطراً تحتها
            يقول «Loopz مجّاني».** والحكمُ من `planNameOf` وحدَها. */}
        <SettingsRow
          href="/profile/settings/billing"
          icon="card"
          title={t.setBilling}
          value={planNameOf(profile, t)}
        />
        {/* 🆕 D-768: دعوةُ الأصدقاء — في مجموعة الحساب بجوار الاشتراك:
            مكافأتُها اشتراكٌ، فبابُها حيث يُسأل عنه */}
        <SettingsRow href="/profile/settings/invites" icon="share" title={t.setInvites} />
      </SettingsGroup>

      <SettingsGroup label={t.setGroupPersonalize}>
        <SettingsRow
          href="/profile/settings/home"
          icon="home"
          title={t.setHomeProfile}
        />
        <SettingsRow
          href="/profile/settings/appearance"
          icon="palette"
          title={t.setAppearance}
        />
        <SettingsRow
          href="/profile/settings/content"
          icon="film"
          title={t.setContent}
        />
      </SettingsGroup>

      <SettingsGroup label={t.setGroupData}>
        <SettingsRow
          href="/profile/settings/privacy"
          icon="shield"
          title={t.setPrivacy}
        />
        <SettingsRow href="/profile/settings/notifications" icon="bell" title={t.setNotifications} />
        <SettingsRow
          href="/profile/settings/import"
          icon="download"
          title={t.setImport}
        />
      </SettingsGroup>

      <SettingsGroup label={t.setGroupSupport}>
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
