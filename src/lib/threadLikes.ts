import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * 🆕 T509 — **قلوبُ ردود التعليق والخبر** (`reply_likes_of`، الهجرة ٢٥٩): العددُ وقلبي لكلِّ ردٍّ في الصفحة بنداءٍ واحد — شكلُ
 * `likes` الذي تأخذه `ThreadReplies` من الغرفة نفسُه، فالويبُ والتطبيقُ (`threadCore`) يقرآن من هنا.
 * غيابُ الدالّة (الكودُ قبل الهجرة) أو فشلُها ⇒ `ok: false` فيُخفى القلب — لا قلبَ يُرسم ثمّ يرفضه الخادم.
 */
export async function getReplyLikes(
  scope: "review" | "news",
  ids: string[],
): Promise<{ ok: boolean; counts: Record<string, number>; mine: string[] }> {
  const counts: Record<string, number> = {};
  const mine: string[] = [];
  if (!ids.length) return { ok: true, counts, mine };
  const sb = await createClient();
  const { data, error } = await sb.rpc("reply_likes_of", { p_scope: scope, p_ids: ids.slice(0, 300) });
  if (error) return { ok: false, counts, mine };
  for (const r of (data ?? []) as { reply_id: string; likes: number; liked: boolean }[]) {
    counts[r.reply_id] = r.likes;
    if (r.liked) mine.push(r.reply_id);
  }
  return { ok: true, counts, mine };
}
