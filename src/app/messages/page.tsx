import { redirect } from "next/navigation";
import { getUser, getUnreadShares, getUnreadSignals, getLastSeenOf, getIncomingFollowRequests } from "@/lib/data";
import { mySignals, getChatBgState } from "@/lib/actions";
import { buildInbox } from "@/lib/messagesCore";
import { getGroups } from "@/lib/groupsCore";
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
  searchParams: Promise<{ with?: string; tab?: string; start?: string; group?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { with: withParam, tab, start, group: groupParam } = await searchParams;
  /* **الخيطُ المطلوبُ يفرض تبويبَه**: رابطُ `?with=` يصل من إشعارٍ أو
     مشاركة — **وفتحُه على تبويب الإشعارات يُخفي ما جاء الزائرُ لأجله.** */
  const alerts = tab === "alerts" && !withParam && !groupParam;

  const [unreadMessages, unreadSignals] = await Promise.all([
    getUnreadShares(),
    getUnreadSignals(),
  ]);

  const tabs: PageTab[] = [
    {
      key: "inbox",
      label: t.communityTabInbox,
      icon: "chat",
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
          <AlertsPane locale={locale} myId={user.id} />
        </>
      ) : (
        <InboxPane
          locale={locale}
          myId={user.id}
          withParam={withParam ?? null}
          startParam={start ?? null}
          groupParam={groupParam ?? null}
          header={header}
        />
      )}
    </div>
  );
}

/** لوحُ الإشعارات — **يُجلب حين يُفتح تبويبُه وحدَه** (نمطُ D-125 باقياً) */
async function AlertsPane({
  locale,
  myId,
}: {
  locale: Awaited<ReturnType<typeof getT>>["locale"];
  /** معرّفُ القارئ من الصفحة — **لا نداءَ ملفٍّ لأجل اسمٍ لم يعد يُستعمل** (D-899) */
  myId: string;
}) {
  /* 🆕 11-N دَين — الطلباتُ القائمةُ مع الإشعارات في موجةٍ واحدة (كما يقرؤها `GET /api/v1/me/signals`) */
  const [rows, requests] = await Promise.all([mySignals(), getIncomingFollowRequests()]);
  return (
    <>
      {/* الختمُ بعد العرض — والشارةُ تسقط بالإنعاش الذي يليه */}
      <MarkSignalsSeen enabled={rows.some((r) => r.isNew)} />
      <NotificationList rows={rows} myId={myId} locale={locale} pending={requests.map((p) => p.id)} />
    </>
  );
}

/** لوحُ الرسائل — منقولٌ بحرفه من الصفحة السابقة.
 *  🆕 D-767: يحمل ترويسةَ الصفحة (التلميح + التبويبات) ليُسقطها حين يكون
 *  `?with=` خيطاً قائماً فعلاً — القرارُ حيث المعرفة، لا في الصفحة العمياء */
async function InboxPane({
  locale,
  myId,
  withParam,
  startParam,
  groupParam,
  header,
}: {
  locale: Awaited<ReturnType<typeof getT>>["locale"];
  myId: string;
  withParam: string | null;
  /** 🆕 T397 — `?group=<id>`: القروبُ المفتوح */
  groupParam: string | null;
  /** 🆕 11-M · M4 — `?start=<id>` يفتح ورقةَ «ابدأ محادثة» لذلك الشخص: بابُ التطبيق قبل M5 (يبقى لنسخةٍ لم يصلها التحديث) */
  startParam: string | null;
  header: React.ReactNode;
}) {
  /* 🆕 D-765: آخرُ ظهورِ صاحبِ الخيط المفتوح — مع المحادثات في موجةٍ
     واحدة (لا نداءَ إلا وخيطٌ مفتوحٌ فعلاً)، ويتجدّد مع استطلاع الخيط */
  /* 🆕 11-M · M4 — المحادثاتُ و«ابدأ محادثة» من النواة الواحدة (`lib/messagesCore.ts`) التي يقرؤها التطبيقُ أيضاً */
  /* 🆕 D-1382 — الخلفيّةُ تُقرأ مع الخيط المفتوح وحدَه (قراءةُ الملفّ مخبّأةٌ في الطلب — `getProfile`) */
  /* 🆕 T397 — والقروباتُ في الموجة نفسِها (`getGroups` — ما يقرؤه `GET /api/v1/me/messages` للتطبيق حرفاً) */
  const [{ conversations, startable, peer, canMessage }, lastSeen, bgState, { groups, canCreate }] = await Promise.all([
    buildInbox(locale, withParam),
    withParam ? getLastSeenOf(withParam) : Promise.resolve(null),
    withParam || groupParam ? getChatBgState().catch(() => null) : Promise.resolve(null),
    getGroups(),
  ]);

  /* داخل خيطٍ مفتوحٍ تسقط الترويسة — «نكتفي بزر الرجوع» (D-767) */
  /* 🆕 D-1380 — وخيطٌ لم يبدأ بعد (`peer`) خيطٌ مفتوحٌ أيضاً: يُرسم فارغاً بخانة كتابة */
  /* 🆕 T397 — الترويسةُ صارت في لوح القائمة داخل `Inbox`: على الجوال تسقط معه حين يُفتح خيطٌ (D-767 كما هو)، وعلى
     الحاسوب تبقى فوق القائمة بجانب الخيط */
  return (
    <>
      <Inbox
        header={header}
        groups={groups}
        canCreateGroup={canCreate}
        openGroup={groupParam}
        meId={myId}
        conversations={conversations}
        startable={startable}
        openWith={withParam}
        openStart={startParam}
        locale={locale}
        lastSeen={lastSeen}
        peer={peer}
        canMessage={canMessage}
        chatBg={bgState?.shown}
      />
    </>
  );
}
