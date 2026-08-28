import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, getMyReferralCode, getMyReferrals } from "@/lib/data";
import { getT } from "@/lib/locale";
import { siteUrl } from "@/lib/site";
import { num } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf } from "@/lib/people";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { InviteLinkCard } from "@/components/settings/InviteLinkCard";

export const dynamic = "force-dynamic";

/**
 * 🆕 **دعوةُ الأصدقاء** (D-768، حكمُ أحمد بنصّه: «كل عضو له رابط مشاركة
 * ويبان عنده كم واحد دخل عن طريقه ومنهم»).
 *
 * الرابطُ دائمٌ (`/join/<code>` — الكودُ يُولَّد كسولاً مرّةً في العمر)،
 * والعدّاداتُ ثلاثةٌ: من انضمّوا، من احتُسبوا (تابعوا ٣ أعمال)، وأشهرُ
 * Loopz+ المكسوبة (كلُّ ٥ محتسبين شهرٌ — حكمُه). والقائمةُ وجوهٌ
 * حقيقيّة: صورةٌ واسمٌ وحالُ الاحتساب — **ومن أخفى اسمه «مستخدم»**
 * كبقيّة الشاشات، فالخصوصيّةُ لا تنكسر في صفحةِ عدّاد.
 *
 * **والقواعدُ الثلاثُ مكتوبةٌ في وجه الصفحة** — برنامجُ مكافآتٍ غامضٌ
 * يُقرأ فخّاً (D-217 روحاً: لا وعدَ إلا بما يُسلَّم).
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();

  const [code, referrals] = await Promise.all([getMyReferralCode(), getMyReferrals()]);
  const counted = referrals.filter((r) => r.counted).length;
  const months = Math.floor(counted / 5);
  const url = code ? siteUrl(`/join/${code}`) : null;

  return (
    <SettingsPageLayout title={t.setInvites}>
      <SettingsGroup label={t.invYourLink}>
        {url ? (
          <InviteLinkCard url={url} locale={locale} />
        ) : (
          /* بلا كودٍ (عطلُ قاعدةٍ عارض): لا بطاقةَ ميتةً — الصفحةُ تبقى
             تشرح البرنامجَ والزيارةُ التاليةُ تولّده */
          <p className="p-3.5 text-12 text-muted">{t.invEmpty}</p>
        )}
      </SettingsGroup>

      {/* الأرقامُ الثلاثة — سطرٌ واحدٌ متساوي الأعمدة */}
      <SettingsGroup>
        <div className="grid grid-cols-3 divide-x divide-[color:var(--divider)] rtl:divide-x-reverse text-center">
          {(
            [
              [referrals.length, t.invStatJoined],
              [counted, t.invStatCounted],
              [months, t.invStatMonths],
            ] as const
          ).map(([n, label]) => (
            <div key={label} className="py-3.5">
              <span className="block text-22 font-bold tabular-nums" dir="ltr">
                {num(n, locale)}
              </span>
              <span className="block text-12 text-muted mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </SettingsGroup>

      {/* القواعدُ الثلاث — مكتوبةٌ لا مخمَّنة */}
      <SettingsGroup>
        {[t.invRuleReward, t.invRuleCounted, t.invRuleGift].map((rule) => (
          <p key={rule} className="flex items-center gap-2.5 p-3.5 text-14 leading-relaxed">
            <Icon name="sparkles" size={15} className="shrink-0 text-accent" />
            {rule}
          </p>
        ))}
      </SettingsGroup>

      {/* من دخلوا عن طريقي */}
      {referrals.length > 0 && (
        <SettingsGroup>
          <ul className="divide-y divide-[color:var(--divider)]">
            {referrals.map((r) => {
              const name = displayNameOf(r.person, t.anonymousUser);
              const username = r.person?.hide_name ? null : r.person?.username ?? null;
              const inner = (
                <>
                  <Avatar
                    src={r.person?.hide_name ? null : r.person?.avatar_url ?? null}
                    name={name}
                    size={40}
                    alt=""
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{name}</span>
                    <span className="block text-12 text-muted truncate">
                      {timeAgo(r.joinedAt, t)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      r.counted
                        ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                        : "bg-surface-2 text-muted"
                    }`}
                  >
                    {r.counted ? t.invCounted : t.invPending}
                  </span>
                </>
              );
              const rowClass = "flex items-center gap-3 p-3.5";
              return (
                <li key={r.id}>
                  {username ? (
                    <Link
                      href={`/u/${username}`}
                      className={`${rowClass} transition hover:bg-surface-2 active:opacity-80`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <span className={rowClass}>{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </SettingsGroup>
      )}
    </SettingsPageLayout>
  );
}
