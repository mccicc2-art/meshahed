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
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup, settingsCard, settingsCardRows } from "@/components/settings/SettingsGroup";
import { InviteLinkCard } from "@/components/settings/InviteLinkCard";

export const dynamic = "force-dynamic";

/**
 * 🆕 **«الدعوات والمكافآت» — على نموذجَي أحمد بالضبط** (D-770b، حكمُه
 * بلقطتين: «صممها مثل هذي بالضبط» — وهما نسخُ شكلِ D-770 الأول).
 *
 * **تبويبان حبّتان** (عائلةُ الرقاقة ممدودةً — لا عائلةَ ثالثة)، وتبويبُ
 * الأصدقاء: بطاقةُ «N من ٥» بخمس درجات، الرابطُ بزرَّي نسخٍ ومشاركة،
 * أربعةُ عدّادات، آخرُ الدعوات بحالة فارغةٍ مرسومة، و«كيف تعمل
 * المكافآت» ثلاثةَ أسطر كما في نموذجه — **وتفصيلُ الاحتساب والسقفِ
 * خلف «الشروط والأهلية»** (details أهليّ — فلا وعدَ مدفونٌ ولا صفحةَ
 * مزدحمة: D-217 بلا كسر نموذجه).
 *
 * **وتبويبُ الشركاء آلةُ الحالات الأربع نفسُها** (D-770)، وجهُ ما قبل
 * التقديم صار نموذجَه: بطاقةُ Share stories + شريطُ ١٥٪/٣/١٠٠ +
 * «كيف يعمل» + «من يمكنه التقديم؟» — **وApply يفتح النموذجَ**
 * (`?apply=1`) كما نصَّ. **ولا قسمَ أموالٍ حتى يُفتح الدفع** (حكمُه).
 */

const BASE = "/profile/settings/invites";

/* ============ أفعالُ النموذج — القشرةُ هنا والحكمُ في actions ============ */

async function submitApplication(formData: FormData) {
  "use server";
  const back = `${BASE}?tab=partners`;
  if (!formData.get("terms")) {
    redirect(`${back}&apply=1&err=${encodeURIComponent("الموافقة على الشروط مطلوبة / Terms agreement is required")}`);
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
    redirect(`${back}&apply=1&err=${encodeURIComponent((e as Error).message.slice(0, 120))}`);
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

/** عنوانُ قسمٍ بنمط النموذج — نصٌّ عريضٌ خارج البطاقة لا تسميةُ مجموعة */
function SectionTitle({ children, end }: { children: React.ReactNode; end?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-1 -mb-1">
      <h2 className="text-15 font-bold">{children}</h2>
      {end}
    </div>
  );
}

/** «الشروط» خلف سطرٍ مسطَّرٍ يتوسّط الصفحة — كما في النموذج، والمتنُ حاضرٌ بلمسة */
function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details>
      <summary className="block w-fit mx-auto text-14 text-muted underline underline-offset-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="mt-3 text-start">{children}</div>
    </details>
  );
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
  searchParams: Promise<{ tab?: string; edit?: string; apply?: string; all?: string; err?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const sp = await searchParams;
  const tab = sp.tab === "partners" ? "partners" : "friends";

  return (
    <SettingsPageLayout title={t.setInvites}>
      {/* تبويبان حبّتان — عائلةُ الرقاقة ممدودةً على عرض الصفّ (نموذجه) */}
      <nav className="grid grid-cols-2 gap-2" aria-label={t.setInvites}>
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
            className={`rounded-full py-2.5 text-center text-14 font-bold transition ${
              tab === key
                ? "bg-accent text-[color:var(--on-accent)]"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "friends" ? (
        <FriendsTab t={t} locale={locale} all={sp.all === "1"} />
      ) : (
        <PartnersTab t={t} locale={locale} sp={sp} />
      )}
    </SettingsPageLayout>
  );
}

/* ============================ الأصدقاء ============================ */

async function FriendsTab({ t, locale, all }: { t: Dict; locale: Locale; all: boolean }) {
  const [code, stats, invites] = await Promise.all([
    getMyReferralCode(),
    getMyInviteStats(),
    getMyInviteList(),
  ]);
  const url = code ? siteUrl(`/join/${code}`) : null;
  const toward = stats.qualified % 5;
  const shown = all ? invites : invites.slice(0, 6);

  return (
    <>
      {/* «N من ٥» — الدرجاتُ الخمس تُرسم لا تُشرح (نموذجه حرفاً) */}
      <div className={`${settingsCard} p-4`}>
        <p className="text-12 font-semibold uppercase tracking-wide text-muted">
          {t.invNextReward}
        </p>
        <p className="mt-1 flex items-baseline gap-1.5 text-3xl font-extrabold">
          <span className="tabular-nums">{num(toward, locale)}</span>
          <span className="text-accent text-22">{t.invOf}</span>
          <span className="tabular-nums">{num(5, locale)}</span>
        </p>
        <p className="text-14 text-muted">{t.invQualified}</p>
        <div className="mt-3.5 flex items-center" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="contents">
              {i > 0 && <span className="h-px flex-1 bg-[color:var(--divider)] mx-1" />}
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full border text-12 font-bold tabular-nums ${
                  i < toward
                    ? "border-accent bg-accent text-[color:var(--on-accent)]"
                    : "border-border text-muted"
                }`}
              >
                {num(i + 1, locale)}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-3.5 text-14">
          {t.invStepHintPre}{" "}
          <span className="font-bold text-accent">{t.invStepHintReward}</span>
        </p>
      </div>

      {/* الرابطُ — تسميةٌ صغيرةٌ فوقه كنموذجه، والبطاقةُ تحمل زرَّيها */}
      <section>
        <h2 className="px-1 mb-1.5 text-12 font-semibold uppercase tracking-wide text-muted">
          {t.invYourLink}
        </h2>
        {url ? (
          <InviteLinkCard url={url} locale={locale} />
        ) : (
          /* بلا كودٍ (عطلُ قاعدةٍ عارض): لا بطاقةَ ميتةً — الزيارةُ التاليةُ تولّده */
          <p className={`${settingsCard} p-3.5 text-12 text-muted`}>{t.invEmpty}</p>
        )}
      </section>

      {/* الأرقامُ الأربعة — انضمّوا · احتُسبوا · اشتركوا · مكافآتك */}
      <div className={`${settingsCard} grid grid-cols-4 divide-x divide-[color:var(--divider)] rtl:divide-x-reverse text-center`}>
        {(
          [
            [num(stats.joined, locale), t.invStatJoined, ""],
            [num(stats.qualified, locale), t.invStatCounted, ""],
            [num(stats.subscribed, locale), t.invStatSubscribed, ""],
            [num(stats.rewardDays, locale), t.invStatRewards, t.invDayUnit],
          ] as const
        ).map(([n, label, unit]) => (
          <div key={label} className="py-3.5 px-1">
            <span className="block text-22 font-bold tabular-nums" dir="ltr">
              {n}
              {unit && <span className="ms-0.5 text-12 font-bold text-muted">{unit}</span>}
            </span>
            <span className="block text-12 text-muted mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* آخرُ الدعوات — وحالةٌ فارغةٌ مرسومةٌ كنموذجه */}
      <section className="space-y-3">
        <SectionTitle
          end={
            invites.length > shown.length ? (
              <Link href={`${BASE}?all=1`} replace className="text-14 font-semibold text-accent">
                {t.invViewAll}
              </Link>
            ) : undefined
          }
        >
          {t.invRecent}
        </SectionTitle>
        {invites.length === 0 ? (
          <div className={`${settingsCard} p-6 text-center`}>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-surface-2">
              <Icon name="people" size={24} className="text-accent" />
            </span>
            <p className="mt-3 text-15 font-bold">{t.invEmptyTitle}</p>
            <p className="mt-1 text-14 text-muted">{t.invEmptyBody}</p>
          </div>
        ) : (
          <ul className={settingsCardRows}>
            {shown.map((r) => {
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
        )}
      </section>

      {/* كيف تعمل المكافآت — ثلاثةُ أسطر نموذجه، والتفصيلُ خلف «الشروط» */}
      <section className="space-y-3">
        <SectionTitle>{t.invHowTitle}</SectionTitle>
        <div className={settingsCardRows}>
          {(
            [
              ["calendar", t.invHow14],
              ["people", t.invHow7],
              ["star", t.invHowSub],
            ] as const
          ).map(([icon, line]) => (
            <p key={line} className="flex items-center gap-3 p-3.5 text-14 leading-relaxed">
              <Icon name={icon} size={18} className="shrink-0 text-accent" />
              {line}
            </p>
          ))}
        </div>
      </section>

      <Disclosure label={t.invTermsLink}>
        <p className={`${settingsCard} p-3.5 text-14 leading-relaxed text-muted`}>
          {t.invFinePrint}
        </p>
      </Disclosure>

      {/* بابُ الشركاء من تبويب الأصدقاء — «اعرف أكثر» كنموذجه */}
      <div className={`${settingsCard} flex items-center gap-3 p-3.5`}>
        <Icon name="people" size={22} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-14 font-bold">{t.prtEntryTitle}</span>
          <span className="block text-12 text-muted mt-0.5">{t.prtEntryBody}</span>
        </span>
        <Link
          href={`${BASE}?tab=partners`}
          replace
          className="shrink-0 rounded-full border border-accent px-3.5 py-1.5 text-12 font-bold text-accent transition hover:bg-accent/10"
        >
          {t.prtLearnMore}
        </Link>
      </div>
    </>
  );
}

/* ============================ الشركاء ============================ */

function TermsCard({ t }: { t: Dict }) {
  return (
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
}

async function PartnersTab({
  t, locale, sp,
}: {
  t: Dict;
  locale: Locale;
  sp: { edit?: string; apply?: string; err?: string };
}) {
  const state = await getMyPartnerState();
  const editing = sp.edit === "1" && state.appStatus === "pending";
  const applying = sp.apply === "1" && state.appStatus === null;
  const showForm = applying || state.appStatus === "rejected" || editing;
  /* التعبئةُ المسبقة تُقرأ فقط حين يُعرض النموذجُ فوق طلبٍ قائم */
  const app =
    showForm && state.appStatus !== null ? await getMyPartnerApplication() : null;

  /* ———— موافَقٌ عليه: لوحةُ الشريك — على نموذجه الثالث بالضبط (D-770c) ————
     حكمُه الجديد «حتى هذي الصفحة الداخلية صممها مثل كذا» نقضٌ معلَنٌ
     لحكمِ «بلا قسم الأموال مؤقتاً»: قسمُ الأموال يُرسم — **والأرقامُ
     صفرٌ بالواقع لا بالزينة** (لا عمولةَ تُستحق قبل فتح الدفع)،
     وزرّا السحب وإكمال الإعداد **معطَّلان بسطرٍ يقول متى يعملان**
     (D-217: زرٌّ يبدو حيّاً ويموت تحت الإصبع فخٌّ لا ميزة).
     قارئُ العمولات الحقيقيُّ يُبنى في جولة فتح الاشتراكات. */
  if (state.appStatus === "approved" && state.code) {
    const url = siteUrl(`/p/${state.code}`);
    const available = 0;
    const pending = 0;
    /* «اشتركوا» صفرٌ حقيقيٌّ لا ثابتٌ مزيَّف: `subscribed_at` لا يكتبه
       شيءٌ قبل قناة الاشتراك — يوم تفتح يصير قراءةً حيّة */
    const paid = 0;
    const conv = state.clicks > 0 ? Math.round((state.joined / state.clicks) * 100) : 0;
    const money = (n: number) =>
      locale === "ar" ? `${num(n, locale)}٫٠٠` : `${n}.00`;
    const outlineBtn =
      "rounded-xl border border-accent font-bold text-accent transition disabled:opacity-50 disabled:cursor-not-allowed";
    return (
      <>
        {/* الأرباحُ المتاحة — كنموذجه: المبلغُ بلون الهوية والسحبُ في الطرف */}
        <div className={`${settingsCard} p-4`}>
          <p className="text-12 font-semibold uppercase tracking-wide text-muted">
            {t.prtEarnLabel}
          </p>
          <p className="mt-1 flex items-baseline gap-2 text-3xl font-extrabold">
            <span>{t.prtCurrency}</span>
            <span className="text-accent tabular-nums">{money(available)}</span>
          </p>
          <p className="mt-0.5 text-14 text-muted tabular-nums">
            {t.prtCurrency} {money(pending)} {t.prtPendingSuffix}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-12 text-muted">{t.prtMinPayout}</span>
            {/* معطَّلٌ بصدق: الرصيدُ دون الحدّ الأدنى — والسحبُ كلُّه مع فتح الدفع */}
            <button type="button" disabled className={`${outlineBtn} px-5 py-2 text-14`}>
              {t.prtWithdraw}
            </button>
          </div>
        </div>

        <section>
          <h2 className="px-1 mb-1.5 text-12 font-semibold uppercase tracking-wide text-muted">
            {t.prtYourLink}
          </h2>
          <InviteLinkCard url={url} locale={locale} />
        </section>

        {/* الأرقامُ الأربعة — نقرات · انضمّوا · اشتركوا · التحويل */}
        <div className={`${settingsCard} grid grid-cols-4 divide-x divide-[color:var(--divider)] rtl:divide-x-reverse text-center`}>
          {(
            [
              [num(state.clicks, locale), t.prtStatClicks, ""],
              [num(state.joined, locale), t.prtStatJoined, ""],
              [num(paid, locale), t.prtStatPaid, ""],
              [num(conv, locale), t.prtStatConv, "%"],
            ] as const
          ).map(([n, label, unit]) => (
            <div key={label} className="py-3.5 px-1">
              <span className="block text-22 font-bold tabular-nums" dir="ltr">
                {n}
                {unit && <span className="ms-0.5 text-12 font-bold text-muted">{unit}</span>}
              </span>
              <span className="block text-12 text-muted mt-0.5">{label}</span>
            </div>
          ))}
        </div>

        {/* عمولتك — ١٥٪ وثلاثُ رقائقِ شروطٍ مصغّرة كنموذجه */}
        <div className={`${settingsCard} p-4`}>
          <h2 className="text-15 font-bold">{t.prtCommTitle}</h2>
          <p className="mt-1 text-3xl font-extrabold text-accent">{t.prtVal15}</p>
          <p className="mt-1 text-14 text-muted">{t.prtCommBody}</p>
          <div className="mt-3.5 flex items-center divide-x divide-[color:var(--divider)] rtl:divide-x-reverse">
            {(
              [
                ["people", t.prtChipDirect],
                ["calendar", t.prtChipHold],
                ["chart", t.prtChipNet],
              ] as const
            ).map(([icon, label]) => (
              <span key={label} className="flex flex-1 items-center justify-center gap-1.5 px-1 text-12 whitespace-nowrap">
                <Icon name={icon} size={15} className="shrink-0 text-muted" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* حركةُ الأرباح — فارغةٌ بحقٍّ حتى يفتح الدفع؛ المرشِّحُ يُضاف مع أول صفّ */}
        <section className="space-y-3">
          <SectionTitle>{t.prtActivityTitle}</SectionTitle>
          <div className={`${settingsCard} p-6 text-center`}>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-surface-2">
              <Icon name="card" size={24} className="text-accent" />
            </span>
            <p className="mt-3 text-15 font-bold">{t.prtNoEarnTitle}</p>
            <p className="mt-1 text-14 text-muted">{t.prtNoEarnBody}</p>
          </div>
        </section>

        {/* بياناتُ التحويل — «غير محدّدة/مطلوب» حقيقتان، والإعدادُ يفتح مع الدفع */}
        <div className={`${settingsCard} p-4`}>
          <h2 className="text-15 font-bold">{t.prtPayoutTitle}</h2>
          <dl className="mt-1 divide-y divide-[color:var(--divider)]">
            <div className="flex items-center justify-between gap-3 py-3 text-14">
              <dt>{t.prtPayoutMethod}</dt>
              <dd className="text-muted">{t.prtNotSet}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3 text-14">
              <dt>{t.prtVerification}</dt>
              <dd className="text-muted">{t.prtRequired}</dd>
            </div>
          </dl>
          <button type="button" disabled className={`${outlineBtn} w-full py-3 text-15 mt-1`}>
            {t.prtCompleteSetup}
          </button>
          <p className="mt-1.5 text-center text-12 text-muted">{t.prtSetupLater}</p>
        </div>

        <Disclosure label={t.prtTermsLink}>
          <TermsCard t={t} />
        </Disclosure>
      </>
    );
  }

  /* ———— قيدُ المراجعة (بلا تعديل): تاريخٌ ووعدُ إبلاغٍ وزرّان ———— */
  if (state.appStatus === "pending" && !editing) {
    return (
      <>
        <div className={`${settingsCard} p-5 text-center`}>
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
        <Disclosure label={t.prtTermsLink}>
          <TermsCard t={t} />
        </Disclosure>
      </>
    );
  }

  /* ———— النموذج: تقديمٌ جديد / تعديلٌ / إعادةُ تقديمٍ بعد رفض ———— */
  if (showForm) {
    return (
      <>
        {state.appStatus === "rejected" && (
          <div className={`${settingsCard} p-4 text-center`}>
            <Icon name="info" size={24} className="mx-auto text-muted" />
            <h2 className="mt-2 text-15 font-bold">{t.prtRejectedTitle}</h2>
            <p className="mt-1 text-14 text-muted">{t.prtRejectedBody}</p>
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

        <TermsCard t={t} />
      </>
    );
  }

  /* ———— ما قبل التقديم — وجهُ نموذجه حرفاً ———— */
  return (
    <>
      <div className={`${settingsCard} p-6 text-center`}>
        <Icon name="people" size={40} className="mx-auto text-accent" strokeWidth={1.4} />
        <h2 className="mt-3 text-24 font-extrabold leading-tight">
          {t.prtHeroTitle1}
          <br />
          {t.prtHeroTitle2}
        </h2>
        <p className="mt-2 text-14 text-muted leading-relaxed">{t.prtHeroBody}</p>
        <Link
          href={`${BASE}?tab=partners&apply=1`}
          replace
          className={buttonClass({ size: "lg", full: true, className: "mt-4" })}
        >
          {t.prtApplyJoin}
        </Link>
      </div>

      {/* ١٥٪ · ٣ · ١٠٠ ريال — القيمُ بلون الهوية كنموذجه */}
      <div className={`${settingsCard} grid grid-cols-3 divide-x divide-[color:var(--divider)] rtl:divide-x-reverse text-center`}>
        {(
          [
            [t.prtVal15, t.prtStatCommission],
            [t.prtVal3, t.prtStatPayments],
            [t.prtValMin, t.prtStatMin],
          ] as const
        ).map(([v, label]) => (
          <div key={label} className="py-3.5 px-1">
            <span className="block text-22 font-extrabold tabular-nums text-accent">{v}</span>
            <span className="block text-12 text-muted mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <SectionTitle>{t.prtHowTitle}</SectionTitle>
        <div className={settingsCardRows}>
          {(
            [
              [1, t.prtStep1, t.prtStep1Sub],
              [2, t.prtStep2, t.prtStep2Sub],
              [3, t.prtStep3, t.prtStep3Sub],
            ] as const
          ).map(([n, title, sub]) => (
            <p key={title} className="flex items-center gap-3 p-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-14 font-bold text-accent tabular-nums">
                {num(n, locale)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-14 font-bold">{title}</span>
                <span className="block text-12 text-muted mt-0.5">{sub}</span>
              </span>
              <Icon
                name="chevron-down"
                size={16}
                className="shrink-0 -rotate-90 rtl:rotate-90 text-muted"
              />
            </p>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>{t.prtWhoTitle}</SectionTitle>
        <div className={settingsCardRows}>
          <p className="p-3.5 text-14 font-bold">{t.prtWhoHead}</p>
          {[t.prtWho1, t.prtWho2, t.prtWho3].map((line) => (
            <p key={line} className="flex items-center gap-2.5 p-3.5 text-14">
              <span className="grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-accent">
                <Icon name="check" size={11} className="text-accent" strokeWidth={2.2} />
              </span>
              {line}
            </p>
          ))}
        </div>
      </section>

      <Link
        href={`${BASE}?tab=partners&apply=1`}
        replace
        className={buttonClass({ size: "lg", full: true })}
      >
        {t.prtApplyJoin}
      </Link>

      <Disclosure label={t.prtTermsLink}>
        <TermsCard t={t} />
      </Disclosure>

      <p className="text-center text-12 text-muted">{t.prtReviewNote}</p>
    </>
  );
}
