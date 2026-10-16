import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MsgDeleteBody, MsgDeletePayload } from "@/core/contracts/messages";

/**
 * ====== 🆕 D-1441 — حذفُ الرسائل (الهجرة ٢٠٨) ======
 *
 * أحمد ١٦ أكتوبر: «أحتاج أقدر أحذف محادثة أو رسالة داخل محادثة أنا راسلها» — «١ ب ٢ أ ٣ أ».
 * 🔑 **بجلسة صاحبها** والقاعدةُ هي الحَكَم: «حذف للجميع» دالّةٌ واحدة (`message_unsend`) تفحص المرسِلَ والمهلةَ (ساعتان)،
 * و«حذف عندي» عَلَمُ الإخفاء في الخاص (سياسةُ «أطرافُ الرسالة» في ٢٠٠) وصفٌّ في `dm_group_hidden` للقروب.
 * 🔑 **الصورةُ تُمحى من المخزن** بعد «حذف للجميع» بجلسة صاحبها (سياسةُ «مجلّدُك وحدَك» في ٢٠٢)؛ وفشلُ محوِها لا يُفشل الحذف —
 * الرسالةُ لم تعد تشير إليها، فلا يصل إليها أحد.
 * 🔑 **قبل الهجرة**: «حذف للجميع» يُرفض لكلِّ رسالة (الدالّةُ غائبة)، و«حذف عندي» في الخاص يعمل بالعَلَمين القديمين.
 */
export async function deleteMessages(me: string, b: MsgDeleteBody): Promise<MsgDeletePayload> {
  const supabase = await createClient();
  const done: string[] = [];
  const refused: string[] = [];

  if (b.scope === "all") {
    const images: string[] = [];
    for (const it of b.items) {
      const { data, error } = await supabase.rpc("message_unsend", { p_kind: it.kind, p_id: it.id });
      if (error) {
        refused.push(it.id);
        continue;
      }
      done.push(it.id);
      if (typeof data === "string" && data.startsWith(`${me}/`)) images.push(data);
    }
    if (images.length) await supabase.storage.from("dm-media").remove(images).catch(() => null);
    return { done, refused };
  }

  for (const it of b.items) {
    if (it.kind === "group") {
      /* مكرّرٌ (أخفيتُها قبلُ) نجاحٌ لا رفض */
      const { error } = await supabase.from("dm_group_hidden").insert({ user_id: me, message_id: it.id });
      if (error && error.code !== "23505") refused.push(it.id);
      else done.push(it.id);
      continue;
    }
    const table = it.kind === "dm" ? "direct_messages" : it.kind === "share" ? "title_shares" : "list_shares";
    /* لا أعرف من الطلب أيّ طرفٍ أنا — العَلَمان بشرطيهما، وما لا يطابقني لا يُمسّ.
       ⚠️ بلا `.select()`: الصفُّ بعد إخفائه لا تمرّره سياسةُ القراءة، فإعادتُه تُرفض (نهجُ `hideConversation`) */
    const [a, c] = await Promise.all([
      supabase.from(table).update({ sender_hid: true }).match({ id: it.id, sender_id: me }),
      supabase.from(table).update({ recipient_hid: true }).match({ id: it.id, recipient_id: me }),
    ]);
    if (a.error && c.error) refused.push(it.id);
    else done.push(it.id);
  }
  return { done, refused };
}
