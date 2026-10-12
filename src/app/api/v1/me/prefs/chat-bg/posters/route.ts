import type { NextRequest } from "next/server";
import { getChatBgPosters } from "@/lib/actions";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { ChatBgPostersPayload } from "@/core/contracts/settings";

/**
 * 🆕 D-1384 — `GET /api/v1/me/prefs/chat-bg/posters?type=tv|movie&id=<tmdb>` — ملصقاتُ عملٍ واحد لمنتقي خلفيّة المحادثات:
 * الفعلُ نفسُه الذي يناديه الويب (`getChatBgPosters`) — النظيفُ أوّلاً ثمّ ما عليه العنوان، وملصقُ صاحبِه إن اختاره.
 */
export async function GET(req: NextRequest) {
  return handle<ChatBgPostersPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type");
    const id = Number(sp.get("id"));
    if ((type !== "tv" && type !== "movie") || !Number.isSafeInteger(id) || id <= 0) return fail("invalid_input");
    return ok(await getChatBgPosters(type, id));
  });
}
