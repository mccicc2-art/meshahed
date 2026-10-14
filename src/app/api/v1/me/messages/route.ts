import type { NextRequest } from "next/server";
import { getUnreadShares, getUnreadSignals } from "@/lib/data";
import { getT } from "@/lib/locale";
import { buildInbox } from "@/lib/messagesCore";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { replyEventOut, type MessagesPayload } from "@/core/contracts/messages";

/**
 * `GET /api/v1/me/messages` — صندوقُ الوارد للتطبيق (Phase 11-M · M4): ما تقرؤه `/messages` حرفاً (`lib/messagesCore.ts`)
 * مع شارتَي التبويبين. **يُطلب ثانيةً عند كلِّ إشارة Realtime وكلَّ ٢٠ ثانية** (D-069) — فالحدُّ ستّون في الدقيقة:
 * دفقةُ رسائلَ في محادثةٍ حيّة لا تُحبس، وحلقةٌ هاربةٌ في التطبيق لا تُغرق القاعدة.
 */
export async function GET(req: NextRequest) {
  return handle<MessagesPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:messages:${auth.user.id}`, 60, 60_000);
    if (lim) return lim;
    const { locale } = await getT();
    const withId = req.nextUrl.searchParams.get("with");
    const [{ conversations, startable, peer, canMessage }, messages, signals] = await Promise.all([
      buildInbox(locale, withId),
      getUnreadShares(),
      getUnreadSignals(),
    ]);
    return ok({
      me_id: auth.user.id,
      conversations: conversations.map((c) => ({
        person_id: c.personId,
        person: c.person,
        /* الأحداثُ بحقولها المنشورة وحدَها — `title_secondary` وما أضافته الترجمةُ لا يعبر */
        events: c.events.map((e) =>
          e.kind === "share"
            ? { kind: "share" as const, id: e.id, mine: e.mine, tmdb_id: e.tmdb_id, media_type: e.media_type, title: e.title, poster_path: e.poster_path, note: e.note, created_at: e.created_at }
            : e.kind === "list"
              ? { kind: "list" as const, id: e.id, mine: e.mine, list_id: e.list_id, list_name: e.list_name, item_count: e.item_count, note: e.note, created_at: e.created_at }
              : /* 🆕 D-1400 — والـGIF والصورةُ معه (D-1387)؛ قبلها كانا يسقطان هنا فتفرغ فقاعتُهما في التطبيق */
                replyEventOut(e),
        ),
        last_at: c.lastAt,
        unread: c.unread,
        latest_share_id: c.latestShareId,
      })),
      startable,
      unread: { messages, signals },
      /* 🆕 D-1380 — خيطٌ لم يبدأ بعد (`?with=`): هويّتُه وحكمُ البوّاب */
      peer,
      can_message: canMessage,
    });
  });
}
