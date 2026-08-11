import { redirect } from "next/navigation";
import { getUser, getConversations } from "@/lib/data";
import { myMutualFollows } from "@/lib/actions";
import type { PersonLite, ConvShareEvent } from "@/lib/data";
import { localizeRows } from "@/lib/localize";
import { getT } from "@/lib/locale";
import { Inbox } from "@/components/Inbox";

export const dynamic = "force-dynamic";

/**
 * الرسائل الخاصّة — صفحةٌ مستقلّة (**D-187**، قرار أحمد).
 *
 * **انتقلت من تبويبٍ في `/people` إلى هنا، وبابُها الظرفُ في الترويسة.**
 * السببُ في `MessagesLink`: الرسالة تُفتح حين تصل لا حين تتصفّح، وشارتُها
 * كانت تزاحم معنى شارة المجتمع.
 *
 * **ولا شيء في المنطق تغيّر — نُقل كما هو:** نفس `getConversations`، ونفس
 * ترجمة أحداث المشاركة دفعةً واحدة (D-048)، ونفس قاعدة «لا محادثة من
 * فراغ» (D-051) التي تجعل `startable` **المتابَعين المتبادلين وحدهم**.
 * **نقلٌ لا إعادةُ كتابة** — وإلا صارت نسختان تفترقان.
 *
 * والرابط `‎/messages?with=<id>` يفتح خيطاً بعينه، كما كان
 * `‎/people?tab=inbox&with=<id>` — والروابطُ القديمة تُحوَّل من `‎/people`.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { with: withParam } = await searchParams;

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
    <div className="space-y-5">
      {/* عنوانٌ مرئيّ هنا بخلاف `/people`: الصفحة وصلتَها من أيقونةٍ لا من
          تبويبٍ مكتوب، فلا شيء آخر يقول أين أنت */}
      <h1 className="text-xl font-extrabold">{t.communityTabInbox}</h1>
      <Inbox
        conversations={conversations}
        startable={startable}
        openWith={withParam ?? null}
        locale={locale}
      />
    </div>
  );
}
