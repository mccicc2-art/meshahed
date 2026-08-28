import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getUser,
  getMyReferralCode,
  getMyInviteStats,
  getMyInviteList,
  getMyPartnerState,
  getMyPartnerApplication,
  type InviteStatus,
} from "@/lib/data";
import { applyPartner, cancelPartnerApplication } from "@/lib/actions";
import { getT } from "@/lib/locale";
import { siteUrl } from "@/lib/site";
import { num, type Dict, type Locale } from "@/lib/i18n";
import { timeAgo, formatDate } from "@/lib/when";
import { displayNameOf } from "@/lib/people";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { buttonClass } from "@/components/ui/Button";
import { segmentedTrackFull, segmentedItem } from "@/components/ui/controls";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup, settingsCard } from "@/components/settings/SettingsGroup";
import { InviteLinkCard } from "@/components/settings/InviteLinkCard";

export const dynamic = "force-dynamic";

/**
 * 🆕 **«الدعوات والمكافآت» — النموذجُ النهائيّ بتبويبين** (D-770، نسخ
 * D-768 بحكمَيه: «الاثنان معاً» و«بلا قسم الأموال مؤقتاً»).
 *
 * **تبويبان لصفحةٍ واحدة** (`?tab=partners` — عائلةُ المقسّم نفسُها لا
 * ثالثة): جمهورا البرنامجَين مختلفان — كلُّ عضوٍ يدعو أصدقاءه، وصانعُ
 * المحتوى يتقدّم بطلب — **وخلطُهما في عمودٍ واحد يجعل ٩٠٪ من الزوّار
 * يقرؤون شروطَ عمولةٍ لا تخصّهم.**
 *
 * **تبويبُ الأصدقاء**: تقدّمٌ نحو الشهر (كلُّ ٥ محتسباتٍ شهرٌ — والنقاطُ
 * الخمسُ تُرسم لا تُشرح)، والرابطُ الدائم، وأربعةُ عدّادات، والقواعدُ
 * مكتوبةٌ في وجه الصفحة (روح D-217: لا وعدَ إلا بما يُسلَّم — ومكافأةُ
 * الاشتراك تقول بنصّها «تُفعَّل مع فتح الاشتراكات»).
 *
 * **تبويبُ الشركاء آلةُ حالاتٍ أربع**: لا طلبَ → تعريفٌ ونموذج · قيدُ
 * المراجعة → تاريخٌ وتعديلٌ وسحب · مرفوضٌ → تقديمٌ من جديد · موافَقٌ →
 * لوحةٌ خفيفة: الرابطُ والعدّادان والشروط — **ولا قسمَ أموالٍ ولا زرَّ
 * سحبٍ حتى يُفتح الدفع** (حكمُه بنصّه، وD-217 حرفاً: زرُّ مالٍ لا يعمل
 * فخٌّ لا ميزة).
 */

const BASE = "/profile/settings/invites";

/* ============ أفعالُ النموذج — القشرةُ هنا والحكمُ في actions ============ */

async function submitApplication(formData: FormData) {
  "use server";
  const back = `${BASE}?tab=partners`;
  if (!formData.get("terms")) {
    redirect(`${back}&err=${encodeURIComponent("الموافقة على الشروط مطلوبة / Terms agreement is required")}`);
  }
  try {
    await applyPartner({
      channelUrl: String(formData.get("channel") ?? ""),
      contentType: String(formData.get("content") ?? ""),
      platforms: String(formData.get("platforms") ?? ""),
      followersRange: String(formData.get("followers") ?? ""),
      country: String(formData.get("country") ?? ""),
      contentLanguage: String(formData.get("language") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (e) {
    redirect(`${back}&err=${encodeURIComponent((e as Error).message.slice(0, 120))}`);
  }
  redirect(back);
}

async function withdrawApplication() {
  "use server";
  await cancelPartnerApplication();
  redirect(`${BASE}?tab=partners`);
}

/* ============ قطعُ العرض — دوالُّ ملفٍّ لا مكوّناتٌ متداخلة (درس D-769) ============ */

const STATUS_CHIP: Record<InviteStatus, string> = {
  joined: "bg-surface-2 text-muted",
  in_progress: "bg-accent/15 text-accent",
  qualified: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  subscribed: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  rejected: "bg-[color:var(--error)]/10 text-[color:var(--error)]",
};

function statusLabel(s: InviteStatus, t: Dict): string {
  switch (s) {
    case "qualified": return t.invStQualified;
    case "subscribed": return t.invStSubscribed;
    case "rejected": return t.invStRejected;
    case "in_progress": return t.invStProgress;
    default: return t.invStJoined;
  }
}

/** حقلُ النموذج — سطرُ التسمية فوق الحقل، نسخةٌ واحدةٌ للسبعة */
function Field({
  name, label, value, required = false, dir, textarea = false,
}: {
  name: string; label: string; value: string;
  required?: boolean; dir?: "ltr"; textarea?: boolean;
}) {
  const cls =
    "w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-14 placeholder:text-muted/60";
  return (
    <label className="block p-3.5 pb-0 last:pb-3.5">
      <span className="block mb-1.5 text-12 font-semibold text-muted">{label}</span>
      {textarea ? (
        <textarea name={name} defaultValue={value} rows={3} maxLength={600} className={cls} />
      ) : (
        <input
          name={name}
          defaultValue={value}
          required={required}
          type={dir === "ltr" ? "url" : "text"}
          dir={dir}
          placeholder={dir === "ltr" ? "https://…" : undefined}
          className={cls}
        />
      )}
    </label>
  );
}

/* ============================ الصفحة ============================ */

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; edit?: string; err?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const sp = await searchParams;
  const tab = sp.tab === "partners" ? "partners" : "friends";

  return (
    <SettingsPageLayout title={t.setInvites}>
      {/* تبويبا الصفحة — عائلةُ المقسّم (D-002)، وروابطُ `replace` فلا
          يكدّس التنقّلُ بينهما تاريخاً (D-643) */}
      <nav className={segmentedTrackFull} aria-label={t.setInvites}>
        {(
          [
            ["friends", t.invTabFriends, BASE],
            ["partners", t.invTabPartners, `${BASE}?tab=partners`],
          ] as const
        ).map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            replace
            aria-current={tab === key ? "page" : undefined}
            className={segmentedItem(
              tab === key,
              "flex-1 flex items-center justify-center gap-1.5",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "friends" ? <FriendsTab t={t} locale={locale} /> : (
        <PartnersTab t={t} locale={locale} sp={sp} />
      )}
    </SettingsPageLayout>
  );
}

/* ============================ الأصدقاء ============================ */

async function FriendsTab({ t, locale }: { t: Dict; locale: Locale }) {
  const [code, stats, invites] = await Promise.all([
    getMyReferralCode(),
    getMyInviteStats(),
    getMyInviteList(),
  ]);
  const url = code ? siteUrl(`/join/${code}`) : null;
  const toward = stats.qualified % 5;

  return (
    <>
      {/* التقدّمُ نحو الشهر — خمسُ نقاطٍ تُرسم لا تُشرح */}
      <div className={`${settingsCard} p-3.5`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-14 font-semibold">{t.invProgress}</span>
          <span className="text-12 text-muted">
            {t.invProgressHint(num(toward, locale), num(5, locale))}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full transition-colors ${
                i < toward ? "bg-accent" : "bg-surface-2"
              }`}
            />
          ))}
        </div>
      </div>

      <SettingsGroup label={t.invYourLink}>
        {url ? (
          <InviteLinkCard url={url} locale={locale} />
        ) : (
          /* بلا كودٍ (عطلُ قاعدةٍ عارض): لا بطاقةَ ميتةً — الصفحةُ تبقى
             تشرح البرنامجَ والزيارةُ التاليةُ تولّده */
          <p className="p-3.5 text-12 text-muted">{t.invEmpty}</p>
        )}
      </SettingsGroup>

      {/* الأرقامُ الأربعة — سطرٌ واحدٌ متساوي الأعمدة */}
      <SettingsGroup>
        <div className="grid grid-cols-4 divide-x divide-[color:var(--divider)] rtl:divide-x-reverse text-center">
          {(
            [
              [stats.joined, t.invStatJoined],
              [stats.qualified, t.invStatCounted],
              [stats.subscribed, t.invStatSubscribed],
              [stats.rewardDays, t.invStatDays],
            ] as const
          ).map(([n, label]) => (
            <div key={label} className="py-3.5 px-1">
              <span className="block text-22 font-bold tabular-nums" dir="ltr">
                {num(n, locale)}
              </span>
              <span className="block text-12 text-muted mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </SettingsGroup>

      {/* القواعدُ مكتوبةٌ لا مخمَّنة — ومكافأةُ الاشتراك تقول بنصّها متى تعمل */}
      <SettingsGroup>
        {[
          t.invRule7,
          t.invRuleMonth,
          t.invRuleGift14,
          t.invRuleQualify,
          t.invRuleSubscribe,
          t.invRuleCap,
        ].map((rule) => (
          <p key={rule} className="flex items-center gap-2.5 p-3.5 text-14 leading-relaxed">
            <Icon name="sparkles" size={15} className="shrink-0 text-accent" />
            {rule}
          </p>
        ))}
      </SettingsGroup>

      {/* من دخلوا عن طريقي */}
      {invites.length > 0 && (
        <SettingsGroup label={t.invRecent}>
          <ul className="divide-y divide-[color:var(--divider)]">
            {invites.map((r) => {
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
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_CHIP[r.status]}`}
                  >
                    {statusLabel(r.status, t)}
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

      {/* بابُ الشركاء من تبويب الأصدقاء — صانعُ المحتوى يصل من حيث هو */}
      <Link
        href={`${BASE}?tab=partners`}
        replace
        className={`${settingsCard} flex items-center gap-3 p-3.5 transition hover:bg-surface-2 active:opacity-80`}
      >
        <Icon name="trending" size={20} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-14 font-semibold">{t.prtEntryTitle}</span>
          <span className="block text-12 text-muted mt-0.5">{t.prtEntryBody}</span>
        </span>
        <Icon name="chevron-down" size={16} className="shrink-0 -rotate-90 rtl:rotate-90 text-muted" />
      </Link>
    </>
  );
}

/* ============================ الشركاء ============================ */

async function PartnersTab({
  t, locale, sp,
}: {
  t: Dict;
  locale: Locale;
  sp: { edit?: string; err?: string };
}) {
  const state = await getMyPartnerState();
  const editing = sp.edit === "1" && state.appStatus === "pending";
  const showForm = state.appStatus === null || state.appStatus === "rejected" || editing;
  /* التعبئةُ المسبقة تُقرأ فقط حين يُعرض النموذجُ فوق طلبٍ قائم */
  const app =
    showForm && state.appStatus !== null ? await getMyPartnerApplication() : null;

  const terms = (
    <SettingsGroup label={t.prtTermsTitle}>
      {[t.prtTerm15, t.prtTermDirect, t.prtTermHold, t.prtTermMin, t.prtTermNature].map(
        (line) => (
          <p key={line} className="flex items-center gap-2.5 p-3.5 text-14 leading-relaxed">
            <Icon name="shield" size={15} className="shrink-0 text-accent" />
            {line}
          </p>
        ),
      )}
      {/* الصدقُ في وجه الصفحة: لا مالَ قبل فتح الاشتراكات (حكمُه + D-217) */}
      <p className="flex items-center gap-2.5 p-3.5 text-14 leading-relaxed text-muted">
        <Icon name="clock" size={15} className="shrink-0" />
        {t.prtMoneyLater}
      </p>
    </SettingsGroup>
  );

  /* ———— موافَقٌ عليه: اللوحةُ الخفيفة — رابطٌ وعدّادان وشروط، لا أموال ———— */
  if (state.appStatus === "approved" && state.code) {
    const url = siteUrl(`/p/${state.code}`);
    return (
      <>
        <SettingsGroup label={t.prtYourLink}>
          <InviteLinkCard url={url} locale={locale} />
        </SettingsGroup>
        <SettingsGroup>
          <div className="grid grid-cols-2 divide-x divide-[color:var(--divider)] rtl:divide-x-reverse text-center">
            {(
              [
                [state.clicks, t.prtStatClicks],
                [state.joined, t.prtStatJoined],
              ] as const
            ).map(([n, label]) => (
              <div key={label} className="py-3.5 px-1">
                <span className="block text-22 font-bold tabular-nums" dir="ltr">
                  {num(n, locale)}
                </span>
                <span className="block text-12 text-muted mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        </SettingsGroup>
        {terms}
      </>
    );
  }

  /* ———— قيدُ المراجعة (بلا تعديل): تاريخٌ ووعدُ إبلاغٍ وزرّان ———— */
  if (state.appStatus === "pending" && !editing) {
    return (
      <>
        <div className={`${settingsCard} p-4 text-center`}>
          <Icon name="hourglass" size={26} className="mx-auto text-accent" />
          <h2 className="mt-2 text-15 font-bold">{t.prtUnderReview}</h2>
          <p className="mt-1 text-14 text-muted">{t.prtReviewBody}</p>
          {state.appliedAt && (
            <p className="mt-1 text-12 text-muted">
              {t.prtAppliedAt(formatDate(state.appliedAt, t))}
            </p>
          )}
          <div className="mt-3.5 flex items-center justify-center gap-2">
            <Link
              href={`${BASE}?tab=partners&edit=1`}
              replace
              className={buttonClass({ variant: "surface", size: "sm" })}
            >
              {t.prtEdit}
            </Link>
            <form action={withdrawApplication}>
              <button
                type="submit"
                className={buttonClass({ variant: "surface", size: "sm" })}
              >
                {t.prtCancelApp}
              </button>
            </form>
          </div>
        </div>
        {terms}
      </>
    );
  }

  /* ———— لا طلبَ / مرفوضٌ / تعديلٌ: التعريفُ ثم النموذج ثم الشروط ———— */
  return (
    <>
      {state.appStatus === "rejected" ? (
        <div className={`${settingsCard} p-4 text-center`}>
          <Icon name="info" size={24} className="mx-auto text-muted" />
          <h2 className="mt-2 text-15 font-bold">{t.prtRejectedTitle}</h2>
          <p className="mt-1 text-14 text-muted">{t.prtRejectedBody}</p>
        </div>
      ) : (
        <div className={`${settingsCard} p-4`}>
          <h2 className="text-15 font-bold flex items-center gap-2">
            <Icon name="trending" size={18} className="text-accent" />
            {t.prtIntroTitle}
          </h2>
          <p className="mt-1.5 text-14 text-muted leading-relaxed">{t.prtIntroBody}</p>
        </div>
      )}

      {sp.err && (
        <p className="text-14 text-[color:var(--error)] px-1">⚠ {sp.err}</p>
      )}

      <form action={submitApplication}>
        <SettingsGroup label={t.prtApplyTitle}>
          <div className="pb-3.5">
            <Field name="channel" label={t.prtFieldChannel} value={app?.channelUrl ?? ""} required dir="ltr" />
            <Field name="content" label={t.prtFieldContent} value={app?.contentType ?? ""} required />
            <Field name="platforms" label={t.prtFieldPlatforms} value={app?.platforms ?? ""} required />
            <Field name="followers" label={t.prtFieldFollowers} value={app?.followersRange ?? ""} />
            <Field name="country" label={t.prtFieldCountry} value={app?.country ?? ""} required />
            <Field name="language" label={t.prtFieldLanguage} value={app?.contentLanguage ?? ""} required />
            <Field name="reason" label={t.prtFieldReason} value={app?.reason ?? ""} textarea />
            <label className="flex items-center gap-2.5 px-3.5 pt-3.5 text-14">
              <input type="checkbox" name="terms" required className="size-4 accent-accent" />
              {t.prtTermsAgree}
            </label>
            <div className="px-3.5 pt-3.5">
              <button type="submit" className={buttonClass({ full: true })}>
                {t.prtSubmit}
              </button>
            </div>
          </div>
        </SettingsGroup>
      </form>

      {terms}
    </>
  );
}
