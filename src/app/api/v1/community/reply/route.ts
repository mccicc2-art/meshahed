import type { NextRequest } from "next/server";
import { addReviewReply, addNewsReply } from "@/lib/actions";
import { parseReplyBody } from "@/core/communityActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { postTag, titleTag } from "@/core/contracts/tags";

/**
 * `POST /api/v1/community/reply` — «تعليق» في ذيل البطاقة (Phase 11-M · M2): ردٌّ على **رأيِ إنسان**
 * (`addReviewReply` كـ`RowComment`) أو على **نشرتنا** (`addNewsReply` كـ`NewsComment`) — D-227/D-236.
 *
 * 🔑 **الحدودُ حدودُ الفعل** (١٥ في الدقيقة · ألفُ حرف)، والمعرّفُ يعود (D-241) وإن لم يرسمه التطبيقُ بعد:
 * الردُّ لا يظهر في الخطّ (الخطُّ يعرض الآراءَ لا الردود) — **فالإيصالُ رسالةٌ عابرةٌ وعدّادٌ يزيد**.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseReplyBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    if (b.target === "review") {
      const r = await addReviewReply({ reviewUserId: b.user_id, tmdbId: b.tmdb_id, mediaType: b.media_type, body: b.body });
      return ok({ reply_id: r?.replyId ?? null }, [titleTag(b.media_type, b.tmdb_id)]);
    }
    const r = await addNewsReply({ postKey: b.post_key, body: b.body });
    return ok({ reply_id: r?.replyId ?? null }, [postTag(b.post_key)]);
  });
}
