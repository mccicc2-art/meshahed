import type { NextRequest } from "next/server";
import { getLastSeenOf } from "@/lib/data";
import { fail, handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { LastSeenPayload } from "@/core/contracts/messages";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `GET /api/v1/me/messages/seen?with=<id>` — سطرُ الحضور في ترويسة الخيط (D-765): `last_seen_of` محروسةٌ بـ`are_mutual`،
 * وغيابُها `null` صامتة — ترويسةٌ بلا سطرِ ظهورٍ لا شاشةُ خطأ. يتجدّد مع استطلاع الخيط.
 */
export async function GET(req: NextRequest) {
  return handle<LastSeenPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const peer = req.nextUrl.searchParams.get("with") ?? "";
    if (!UUID.test(peer)) return fail("invalid_input", { field: "with" });
    const lim = limited(`v1:messages:seen:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    return ok({ last_seen: await getLastSeenOf(peer) });
  });
}
