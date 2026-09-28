import type { NextRequest } from "next/server";
import { reportReply, reportNewsReply, reportTalkPost, reportReview } from "@/lib/actions";
import { parseThreadReportBody } from "@/core/threadActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/thread/report` — «إبلاغ» (Phase 11-M · M3): ردٌّ في الخيط (`reportTalkPost` · `reportReply` ·
 * `reportNewsReply`) أو الرأيُ نفسُه (`reportReview` — `ReportButton` في صفحة الرأي). **الحدُّ والتكرارُ في الفعل**
 * (عشرةٌ في الدقيقة · `ignoreDuplicates`)، ولا وسم: البلاغُ لا يغيّر ما يُرسم حتى تحكم الإدارة.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseThreadReportBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    const t = b.target;
    if (b.what === "review" && t.kind === "review") {
      await reportReview({ reviewUserId: t.user_id, tmdbId: t.tmdb_id, mediaType: t.media_type });
    } else if (b.reply_id) {
      if (t.kind === "talk") await reportTalkPost({ postId: b.reply_id });
      else if (t.kind === "review") await reportReply({ replyId: b.reply_id });
      else await reportNewsReply({ replyId: b.reply_id });
    }
    return ok({ done: true as const }, []);
  });
}
