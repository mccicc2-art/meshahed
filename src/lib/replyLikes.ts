"use server";

import { createClient } from "@/lib/supabase/server";
import { allow } from "@/core/ratelimit";
import { notifyReplyLike } from "@/lib/push";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 🆕 T509 — **إعجابٌ بردٍّ تحت تعليقٍ أو تحت خبرٍ من Loopz، أو سحبُه** (أحمد ٢٢ نوفمبر «١٥ أ»: «المفترض اقدر اسوي اعجاب لردود
 * عالرد مثل رد خالد او عمر»). توأمُ `togglePostLike` بجدولين جديدين (الهجرة ٢٥٩).
 *
 * 🔑 **في ملفٍّ مستقلّ لا في `lib/actions`**: الفعلُ وحدَه بلا ما يشاركه، فلا يُحجز ملفُّ الأفعال الكبيرُ من أجل دالّةٍ واحدة.
 * ⚠️ **ولا حارسَ هنا لِما تحرسه القاعدة**: «لا تُعجب بردّك» و«لا بمخفيّ» و«لا بين محظورين» في سياسة الإدراج
 * (`can_like_*_reply`) — الواجهةُ تخفي الزرّ، والقاعدةُ ترفض الصفّ. 23505 = القلبُ موجودٌ أصلاً (نقرتان): الحالةُ قائمةٌ ولا جرسَ ثانٍ.
 */
export async function toggleReplyLike(scope: "review" | "news", replyId: string, liked: boolean): Promise<void> {
  if ((scope !== "review" && scope !== "news") || typeof replyId !== "string" || !UUID.test(replyId)) {
    throw new Error("تعذّر إتمام العملية، جرّب مرة أخرى / Something went wrong, try again.");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجّل الدخول");
  if (!allow(`${user.id}:act`, 30, 10_000)) throw new Error("طلبات كثيرة متتالية — تمهّل لحظات / Too many requests, slow down.");
  const table = scope === "review" ? "review_reply_likes" : "news_reply_likes";
  const key = { reply_id: replyId, user_id: user.id };
  const { error } = liked ? await supabase.from(table).delete().match(key) : await supabase.from(table).insert(key);
  if (error?.code === "23505") return;
  if (error) {
    console.error("[action]", error);
    throw new Error("تعذّر إتمام العملية، جرّب مرة أخرى / Something went wrong, try again.");
  }
  /* صاحبُ الردّ وموضعُه يُقرآن في الدفع من صفّه (`notifyReplyLike`) — لا يُؤتمن عليهما العميل */
  if (!liked) notifyReplyLike({ scope, replyId, actorId: user.id });
}
