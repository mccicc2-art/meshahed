import { redirect } from "next/navigation";
import {
  getUser,
  getProfile,
  getConversations,
  getUnreadShares,
  getUnreadSignals,
  getLastSeenOf,
} from "@/lib/data";
import { myMutualFollows, mySignals } from "@/lib/actions";
import type { PersonLite, ConvShareEvent } from "@/lib/data";
import { localizeRows } from "@/lib/localize";
import { getT } from "@/lib/locale";
import { Inbox } from "@/components/Inbox";
import { NotificationList } from "@/components/NotificationList";
import { MarkSignalsSeen } from "@/components/MarkSignalsSeen";
import { PageTabs, type PageTab } from "@/components/ui/PageTabs";
import { OneTimeHint } from "@/components/OneTimeHint";

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

  /* 🆕 D-767 (طلب أحمد: «الصف اللي فوقه ما نحتاجه — نكتفي بزر الرجوع»):
     داخل خيطٍ مفتوحٍ لا تبويباتِ ولا تلميح — الترويسةُ للمحادثة وحدَها،
     وزرُّ الرجوع يعيد إلى القائمة بتبويباتها. والحكمُ عند لوح الرسائل لا
     هنا: هو من يعرف إن كان `?with=` خيطاً قائماً فعلاً — رابطٌ لخيطٍ
     زال يسقط إلى القائمة فتعود التبويباتُ معها. */
  const header = (
    <>
      <OneTimeHint id="messages-intro" text={t.hintMessages} closeLabel={t.closeLabel} />
      <PageTabs
        items={tabs}
        active={alerts ? "alerts" : "inbox"}
        ariaLabel={t.communityTabInbox}
        asNav
      />
    </>
  );

  return (
    <div className="space-y-4">
      {alerts ? (
        <>
          {header}
          <AlertsPane locale={locale} />
        </>
      ) : (
        <InboxPane locale={locale} withParam={withParam ?? null} header={header} />
      )}
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

/** لوحُ الرسائل — منقولٌ بحرفه من الصفحة السابقة.
 *  🆕 D-767: يحمل ترويسةَ الصفحة (التلميح + التبويبات) ليُسقطها حين يكون
 *  `?with=` خيطاً قائماً فعلاً — القرارُ حيث المعرفة، لا في الصفحة العمياء */
async function InboxPane({
  locale,
  withParam,
  header,
}: {
  locale: Awaited<ReturnType<typeof getT>>["locale"];
  withParam: string | null;
  header: React.ReactNode;
}) {
  /* 🆕 D-765: آخرُ ظهورِ صاحبِ الخيط المفتوح — مع المحادثات في موجةٍ
     واحدة (لا نداءَ إلا وخيطٌ مفتوحٌ فعلاً)، ويتجدّد مع استطلاع الخيط */
  const [convRows, lastSeen] = await Promise.all([
    getConversations(),
    withParam ? getLastSeenOf(withParam) : Promise.resolve(null),
  ]);
  let conversations = convRows;
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

  /* داخل خيطٍ مفتوحٍ تسقط الترويسة — «نكتفي بزر الرجوع» (D-767) */
  const threadOpen = !!withParam && conversations.some((c) => c.personId === withParam);

  return (
    <>
      {!threadOpen && header}
      <Inbox
        conversations={conversations}
        startable={startable}
        openWith={withParam}
        locale={locale}
        lastSeen={lastSeen}
      />
    </>
  );
}
