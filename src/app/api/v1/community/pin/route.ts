import type { NextRequest } from "next/server";
import { toggleRoomPin, setGlobalRoomPin } from "@/lib/actions";
import { parseRoomPinBody } from "@/core/communityActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/community/pin` — دبّوسُ غرفة «الأعمال» (Phase 11-M · M2): `{tmdb_id, media_type, on, global?}`.
 * شخصيٌّ (`toggleRoomPin`، D-301) أو للجميع (`setGlobalRoomPin`، D-314 — **والحارسُ في دالّة القاعدة**: غيرُ
 * الإدارة يُردّ `forbidden` مهما أرسل). **ولا وسم**: الترتيبُ في الفتحة التالية لا تحت الإصبع (D-008).
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parseRoomPinBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    const input = { tmdbId: b.tmdb_id, mediaType: b.media_type, on: b.on };
    if (b.global) await setGlobalRoomPin(input);
    else await toggleRoomPin(input);
    return ok({ done: true as const }, []);
  });
}
