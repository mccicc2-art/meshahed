import { redirect } from "next/navigation";
import {
  getUser,
  getProfile,
  getConversations,
  getUnreadShares,
  getUnreadSignals,
} from "@/lib/data";
import { myMutualFollows, mySignals } from "@/lib/actions";
import type { PersonLite, ConvShareEvent } from "@/lib/data";
import { localizeRows } from "@/lib/localize";
import { getT } from "@/lib/locale";
import { Inbox } from "@/components/Inbox";
import { NotificationList } from "@/components/NotificationList";
import { MarkSignalsSeen } from "@/components/MarkSignalsSeen";
import { PageTabs, type PageTab } from "@/components/ui/PageTabs";

export const dynamic = "force-dynamic";

/**
 * البريد — **الرسائلُ والإشعاراتُ سطحٌ واحدٌ بتبويبين** (D-463، طلبُ
 * أحمد: «الإشعارات ضيّفها مع الرسائل تبويباً ثانياً، وأيقونتهم واحدة
 * فوق، وألغِ الشاشة المنبثقة»).
 *
 * **ونقضٌ يُسجَّل بالاسم**: D-187 فصلت الظرفَ عن الجرس **لأن شارةً
 * واحدةً كانت تعني ثلاثة أشياء**. **والتبويبان يحفظان ذلك المعنى
 * ويُلغيان الأيقونةَ الثانية**: **لكلِّ نوعٍ شارتُه على تبويبه**، فما
 * زال «٣» تقول أيَّ ثلاثة — **والفرقُ أن البابَ صار واحداً بعد أن كان
 * بابين متجاورين في شريطٍ ضيّق.**
 *
 * ⚠️ **والعنوانُ المكتوب سقط عمداً**: كان سطراً يقول «الرسائل» **لأن
 * الصفحةَ تُدخل من أيقونةٍ صامتة ولا شيء آخر يقول أين أنت** — **والآن
 * التبويبُ المضيءُ يقولها**، **وعنوانان بالكلمة نفسِها فوق بعضهما
 * حشوٌ** (D-044).
 *
 * **ولا شيء في منطق الرسائل تغيّر — نُقل كما هو:** نفس `getConversations`،
 * ونفس ترجمة أحداث المشاركة دفعةً واحدة (D-048)، ونفس قاعدة «لا محادثة
 * من فراغ» (D-051). والرابط `‎/messages?with=<id>` يفتح خيطاً بعينه.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string; tab?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { with: withParam, tab } = await searchParams;
  /* **الخيطُ المطلوبُ يفرض تبويبَه**: رابطُ `?with=` يصل من إشعارٍ أو
     مشاركة — **وفتحُه على تبويب الإشعارات يُخفي ما جاء الزائرُ لأجله.** */
  const alerts = tab === "alerts" && !withParam;

  const [unreadMessages, unreadSignals] = await Promise.all([
    getUnreadShares(),
    getUnreadSignals(),
  ]);

  const tabs: PageTab[] = [
    {
      key: "inbox",
      label: t.communityTabInbox,
      icon: "mail",
      href: "/messages",
      badge: unreadMessages,
      badgeLabel: t.messagesUnreadAria(unreadMessages),
    },
    {
      key: "alerts",
      label: t.notifTitle,
      icon: "bell",
      href: "/messages?tab=alerts",
      badge: unreadSignals,
      badgeLabel: t.notifUnreadAria(unreadSignals),
    },
  ];

  return (
    <div className="space-y-4">
      <PageTabs
        items={tabs}
        active={alerts ? "alerts" : "inbox"}
        ariaLabel={t.communityTabInbox}
        asNav
      />
      {alerts ? <AlertsPane locale={locale} /> : <InboxPane locale={locale} withParam={withParam ?? null} />}
    </div>
  );
}

/** لوحُ الإشعارات — **يُجلب حين يُفتح تبويبُه وحدَه** (نمطُ D-125 باقياً) */
async function AlertsPane({ locale }: { locale: Awaited<ReturnType<typeof getT>>["locale"] }) {
  const [rows, profile] = await Promise.all([mySignals(), getProfile()]);
  return (
    <>
      {/* الختمُ بعد العرض — والشارةُ تسقط بالإنعاش الذي يليه */}
      <MarkSignalsSeen enabled={rows.some((r) => r.isNew)} />
      <NotificationList rows={rows} myUsername={profile?.username ?? null} locale={locale} />
    </>
  );
}

/** لوحُ الرسائل — منقولٌ بحرفه من الصفحة السابقة */
async function InboxPane({
  locale,
  withParam,
}: {
  locale: Awaited<ReturnType<typeof getT>>["locale"];
  withParam: string | null;
}) {
  let conversations = await getConversations();
  if (conversations.length) {
    const shareEvents = conversations.flatMap((c) =>
      c.events.filter((e): e is ConvShareEvent => e.kind === "share"),
    );
    const localized = await localizeRows(shareEvents, locale);
    const byId = new Map(localized.map((s) => [s.id, s]));
    conversations = conversations.map((c) => ({
      ...c,
      events: c.events.map((e) => (e.kind === "share" ? byId.get(e.id) ?? e : e)),
    }));
  }

  const withConv = new Set(conversations.map((c) => c.personId));
  const startable: PersonLite[] = (await myMutualFollows()).filter(
    (p: PersonLite) => !withConv.has(p.id),
  );

  return (
    <Inbox
      conversations={conversations}
      startable={startable}
      openWith={withParam}
      locale={locale}
    />
  );
}
