import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyGroupMessage } from "@/lib/push";
import { fail, handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { isGroupId, mentionsIn, parseGroupSendBody } from "@/core/contracts/groups";

/**
 * 🆕 `POST /api/v1/me/groups/<id>` — رسالةٌ في القروب: نصٌّ أو GIF أو صورةٌ (من `/api/v1/me/messages/image`) بتعليقٍ
 * اختياريّ، وردٌّ على رسالة. **الكتابةُ بجلسة المرسِل** فسياسةُ القاعدة (عضوٌ · باسمك · رسالةٌ عاديّة) هي الحَكَم،
 * والاقتباسُ من القروب نفسِه (المشغِّل). ثمّ الدفعُ لمن لم يكتم.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const { id } = await ctx.params;
    if (!isGroupId(id)) return fail("invalid_input");
    const slow = limited(`v1:group-send:${auth.user.id}`, 40, 60_000);
    if (slow) return slow;
    const b = parseGroupSendBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    if (b.image_path && !b.image_path.startsWith(`${auth.user.id}/`)) return fail("invalid_input");
    const supabase = await createClient();
    const { error } = await supabase.from("dm_group_messages").insert({
      group_id: id,
      sender_id: auth.user.id,
      body: b.body,
      ...(b.gif_id ? { gif_id: b.gif_id } : {}),
      ...(b.image_path ? { image_path: b.image_path } : {}),
      ...(b.reply_to ? { reply_to: b.reply_to } : {}),
      /* 🆕 D-1435 — بطاقةُ عمل (الهجرة ٢٠٧) */
      ...(b.title ? { tmdb_id: b.title.tmdb_id, media_type: b.title.media_type, title: b.title.title, poster_path: b.title.poster_path } : {}),
    });
    if (error) {
      /* عملٌ قبل تشغيل الهجرة ٢٠٧: العمودُ غائب — رفضٌ يُقرأ لا «تعذّر» عامّ */
      if (error.code === "42703" || error.code === "PGRST204") return fail("invalid_input");
      /* لستَ عضواً (خرجتَ أو حُذفت) ⇢ رسالةٌ تُقرأ */
      if (error.code === "42501") return fail("forbidden", { message_key: "apiGroupNotMember" });
      if (error.code === "23514" || error.code === "23503") return fail("invalid_input");
      throw new Error(`group send: ${error.message}`);
    }
    /* 🆕 D-1436 — من ذُكر بـ@ يصله «ذكرك» ولو كتم القروب؛ الأسماءُ تُطابَق بالأعضاء في `notifyGroupMessage` */
    notifyGroupMessage({
      groupId: id,
      actorId: auth.user.id,
      text: b.body,
      media: b.gif_id ? "gif" : b.image_path ? "image" : null,
      sharedTitle: b.title?.title ?? null,
      mentions: mentionsIn(b.body),
    });
    return ok({ done: true as const }, ["me:messages"]);
  });
}
