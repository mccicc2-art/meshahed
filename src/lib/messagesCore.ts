import "server-only";
import { getConversations, type Conversation, type ConvShareEvent } from "@/lib/data";
import { myMutualFollows } from "@/lib/actions";
import { localizeRows } from "@/lib/localize";
import type { Locale } from "@/core/i18n";
import type { PersonLite } from "@/core/people";

/**
 * ====== صندوقُ الوارد — النواةُ الواحدة لصفحة `/messages` ولـ`GET /api/v1/me/messages` (Phase 11-M · M4) ======
 *
 * 🔑 **منقولٌ بحرفه من `InboxPane`** (نهجُ `homeCore` في 11-H): المحادثاتُ من `getConversations`، وأحداثُ المشاركة
 * تُترجم دفعةً واحدة (D-048)، و«ابدأ محادثة» كلُّ متابَعٍ متبادلٍ لا خيطَ معه بعد (D-051). **الصفحةُ والتطبيقُ يقرآن
 * من هنا** — فلا نسخةَ ثانيةً تفترق يوماً في قاعدة «لا محادثة من فراغ».
 */
export async function buildInbox(locale: Locale): Promise<{ conversations: Conversation[]; startable: PersonLite[] }> {
  let conversations = await getConversations();
  if (conversations.length) {
    const shareEvents = conversations.flatMap((c) => c.events.filter((e): e is ConvShareEvent => e.kind === "share"));
    const localized = await localizeRows(shareEvents, locale);
    const byId = new Map(localized.map((s) => [s.id, s]));
    conversations = conversations.map((c) => ({
      ...c,
      events: c.events.map((e) => (e.kind === "share" ? byId.get(e.id) ?? e : e)),
    }));
  }
  const withConv = new Set(conversations.map((c) => c.personId));
  const startable = (await myMutualFollows()).filter((p: PersonLite) => !withConv.has(p.id));
  return { conversations, startable };
}
