import type { NextRequest } from "next/server";
import { getChatBgState, setChatBg } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { ChatBgBody, ChatBgPayload, ChatBgResult } from "@/core/contracts/settings";

/**
 * 🆕 D-1382 — خلفيّةُ المحادثات للتطبيق.
 * `GET` — الخلفيّةُ المحفوظةُ وما يُرسم فعلاً؛ و`?choices=1` يضيف المفضّلاتِ ذواتِ الخلفيّة (المنتقي وحدَه يطلبها).
 * `POST {bg}` — الكاتبُ نفسُه الذي يناديه الويب (`setChatBg` ⇐ `updateUiState`): التطهيرُ وحارسُ البلس هناك،
 * **و`needsPlus` يعود صريحاً** ليفتح التطبيقُ بابَ البلس بدل صمت (وصفةُ `settings/theme`).
 */
export async function GET(req: NextRequest) {
  return handle<ChatBgPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    return ok(await getChatBgState(req.nextUrl.searchParams.get("choices") === "1"));
  });
}

export const POST = bodyRoute<ChatBgBody, ChatBgResult>(
  (b) => setChatBg(b.bg),
  () => ["user:me:profile"],
);
