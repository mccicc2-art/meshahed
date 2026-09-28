import type { NextRequest } from "next/server";
import { sendShare } from "@/lib/actions";
import { fail, handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseMsgShareBody } from "@/core/contracts/messages";

/**
 * `POST /api/v1/me/messages/share` — «أرسِله لـ…» وورقةُ «ابدأ محادثة» في التطبيق (Phase 11-M · M5): عملٌ إلى صديق
 * (`sendShare` نفسُه — القاعدةُ تشترط المتابعةَ المتبادلة، والحدُّ ٢٠ في الدقيقة، ولا إرسالَ إلى نفسك). الصندوقُ يُبطَل عند المرسِل
 * فتظهر المحادثةُ (أو المشاركةُ في خيطها) حين يُفتح.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseMsgShareBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    await sendShare({ recipientId: b.recipient_id, tmdbId: b.tmdb_id, mediaType: b.media_type, title: b.title, posterPath: b.poster_path, note: b.note });
    return ok({ done: true as const }, ["me:messages"]);
  });
}
