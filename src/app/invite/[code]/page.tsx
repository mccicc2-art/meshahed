import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getT } from "@/lib/locale";
import { limited } from "@/lib/v1";
import { inviterById, ownerOfCode } from "@/lib/referral";
import { appInviteLink, cleanInviteCode, STORE_URL } from "@/core/storeLinks";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { buttonClass } from "@/components/ui/Button";

/**
 * ====== 🆕 صفحةُ الدعوة — `/invite/<code>` (المهمة ٣٧٠، قرارُ أحمد ١٠ نوفمبر «1ب … نفذ أ») ======
 *
 * 🔴 **العلّة**: رابطُ الدعوة (`/join/<code>` · `/p/<code>`) كان يحفظ الكودَ في كوكي المتصفّح ويرمي الزائرَ إلى صفحة الهبوط.
 * ومن على جوّاله ينزّل التطبيقَ من المتجر ويسجّل فيه — **والمتجرُ لا يحمل شيئاً إلى التطبيق، والكوكي باقٍ في المتصفّح**. فلم
 * تُنسب دعوةُ عضوٍ سجّل من التطبيق قطّ.
 *
 * 🔑 **خطوتان على الصفحة**: نزّل التطبيق، ثمّ «افتح الدعوة في التطبيق» — زرٌّ يفتح التطبيقَ بعنوانه الخاصّ حاملاً الكود
 * (`com.loopztv.app://join/<CODE>`، يقرؤه `+native-intent.tsx`)، فيسأل الترحيبُ «هل دعاك أحمد؟» قبل أن تُكتب متابعةٌ واحدة.
 * ⚖️ **لا تخمينَ بعنوان الشبكة**: Apple تمنع بصمةَ الجهاز ولو للنسبة، وiPhone لا يمرّر مصدرَ التثبيت — فمن ذهب إلى المتجر ولم
 * يرجع يجد في الترحيب «هل دعاك أحدٌ؟» بالبحث بالاسم. (أندرويد يقرأ مصدرَ التثبيت مع البناء الأصليّ القادم — `NATIVE-BUILD-LIST`.)
 * - **الوجهُ عامٌّ بقدر الرابط نفسِه**: من فتح الرابطَ يرى صاحبَه، ومن أخفى اسمَه لا يُعرض اسمُه ولا صورتُه.
 * - **«أكمل في المتصفح»** طريقُ الويب القائم: الكوكي كُتب في `/join` و`/p`، والنسبةُ تقع في `/auth/callback` كما كانت.
 * - الأزرارُ بحسب الجهاز من ترويسة الطلب: iPhone يرى App Store، وأندرويد Google Play، والحاسوبُ سطراً يقول افتحه من جوّالك.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Device = "ios" | "android" | "desktop";

function deviceOf(ua: string): Device {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { t } = await getT();
  const code = cleanInviteCode((await params).code);
  const head = await headers();
  /* 🆕 المراجعةُ المستقلّة — حدُّ المعاينة العامّة نفسُه (`/api/v1/referral/{code}`): الصفحةُ تكشف ما تكشفه هي، فبلا حدٍّ يصير
     التخمينُ هنا بلا قيد. من تجاوزه يرى الدعوةَ بلا وجه — الأزرارُ تعمل كما هي */
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const owner = code && !limited(`v1:refpreview:${ip}`, 20, 60_000) ? await ownerOfCode(code) : null;
  const inviter = owner ? await inviterById(owner.userId) : null;
  const device = deviceOf(head.get("user-agent") ?? "");
  const name = inviter?.name ?? null;
  const stores: { key: "ios" | "android"; label: string; href: string }[] = (
    [
      { key: "ios", label: "App Store", href: STORE_URL.ios },
      { key: "android", label: "Google Play", href: STORE_URL.android },
    ] as const
  ).filter((s) => device === "desktop" || s.key === device);
  const phone = device !== "desktop";

  return (
    <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-[400px] flex-col items-center justify-center px-6 py-10 text-center">
      <Avatar src={inviter?.avatar_url ?? null} name={name ?? "Loopz"} size={80} alt="" />
      <h1 className="mt-5 text-[26px] font-extrabold leading-tight">{name ? t.invitePageTitle(name) : t.invitePageTitleAnon}</h1>
      <p className="mt-2 text-14 leading-relaxed text-muted">
        {t.invitePageBody}
        {owner?.source === "friend" ? (
          <>
            {" "}
            <span className="font-bold text-accent">{t.invitePageGift}</span>
          </>
        ) : null}
      </p>

      {/* الخطوتان — عائلةُ بطاقات النقاط في صفحة الهبوط نفسُها (حدٌّ وسطحٌ ورقمٌ في مربّعٍ بلون التمييز) */}
      <ol className="mt-7 w-full space-y-3 text-start">
        <li className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2.5 text-14 font-bold">
            <StepNo n={1} />
            {t.inviteStep1}
          </p>
          <div className={`mt-3 grid gap-2 ${stores.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {stores.map((s) => (
              <a key={s.key} href={s.href} rel="noopener" className={buttonClass({ variant: "surface", full: true })}>
                <Icon name="download" size={16} />
                <span dir="ltr">{s.label}</span>
              </a>
            ))}
          </div>
        </li>
        {phone && code ? (
          <li className="rounded-xl border border-border bg-surface p-4">
            <p className="flex items-center gap-2.5 text-14 font-bold">
              <StepNo n={2} />
              {t.inviteStep2}
            </p>
            <a href={appInviteLink(code)} className={`mt-3 ${buttonClass({ full: true })}`}>
              {t.inviteOpenApp}
            </a>
            <p className="mt-2.5 text-12 leading-relaxed text-muted">{t.inviteStep2Hint}</p>
          </li>
        ) : null}
      </ol>

      {phone ? null : <p className="mt-4 text-12 leading-relaxed text-muted">{t.inviteDesktopHint}</p>}
      {/* 🆕 المراجعةُ المستقلّة — عبر `/join` لا إلى `/login` مباشرةً: من وصل بنسخ رابط `/invite` لم يمرّ بباب الكوكي، و`/join`
          يكتبه ثمّ يحوّل إلى الدخول (`?to=login`) — فالنسبةُ في المتصفّح تقع في `/auth/callback` كما كانت */}
      <Link href={code ? `/join/${code}?to=login` : "/login"} prefetch={false} className="mt-5 text-14 text-muted underline underline-offset-4 hover:text-accent transition">
        {t.inviteContinueWeb}
      </Link>
    </div>
  );
}

function StepNo({ n }: { n: number }) {
  return (
    <span
      className="grid size-[26px] shrink-0 place-items-center rounded-lg text-12 font-bold tabular-nums text-accent"
      style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
      aria-hidden
    >
      {n}
    </span>
  );
}
