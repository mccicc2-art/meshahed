import "server-only";
import { getConversations, type Conversation, type ConvShareEvent } from "@/lib/data";
import { myMutualFollows } from "@/lib/actions";
import { localizeRows } from "@/lib/localize";
import type { Locale } from "@/core/i18n";
import { PERSON_COLS, type PersonLite } from "@/core/people";
import { createClient } from "@/lib/supabase/server";

/**
 * ====== صندوقُ الوارد — النواةُ الواحدة لصفحة `/messages` ولـ`GET /api/v1/me/messages` (Phase 11-M · M4) ======
 *
 * 🔑 **منقولٌ بحرفه من `InboxPane`** (نهجُ `homeCore` في 11-H): المحادثاتُ من `getConversations`، وأحداثُ المشاركة
 * تُترجم دفعةً واحدة (D-048)، و«ابدأ محادثة» كلُّ متابَعٍ متبادلٍ لا خيطَ معه بعد — اقتراحٌ لا شرط (D-1380: أيُّ شخصٍ
 * يُراسَل من ملفّه). **الصفحةُ والتطبيقُ يقرآن من هنا** فلا نسخةَ ثانيةً تفترق.
 *
 * 🆕 D-1380 — `withId`: خيطٌ يُفتح لشخصٍ لا محادثةَ معه بعد (من ملفّه أو من «ابدأ محادثة»). يعود `peer` بهويّته
 * و`can_message` (البوّابُ `can_message`) ليُرسم الخيطُ فارغاً بخانة كتابة أو بسطر «لا يستقبل رسائل».
 */
export async function buildInbox(
  locale: Locale,
  withId?: string | null,
): Promise<{ conversations: Conversation[]; startable: PersonLite[]; peer: PersonLite | null; canMessage: boolean | null }> {
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
  let peer: PersonLite | null = null;
  let canMsg: boolean | null = null;
  if (withId && /^[0-9a-f-]{36}$/i.test(withId)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.id !== withId) {
      const [{ data: person }, gate] = await Promise.all([
        withConv.has(withId)
          ? Promise.resolve({ data: null })
          : supabase.from("public_profiles").select(PERSON_COLS).eq("id", withId).maybeSingle(),
        supabase.rpc("can_message", { a: user.id, b: withId }),
      ]);
      peer = (person as PersonLite | null) ?? null;
      canMsg = gate.error ? null : gate.data === true;
    }
  }
  return { conversations, startable, peer, canMessage: canMsg };
}
