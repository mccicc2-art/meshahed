import { mySignals } from "@/lib/actions";
import { getIncomingFollowRequests } from "@/lib/data";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { SignalsPayload } from "@/core/contracts/messages";

/**
 * `GET /api/v1/me/signals` — أسطرُ الجرس (`mySignals` نفسُها) — **تُطلب حين يُفتح تبويبُها وحدَه** (D-125 باقياً).
 * الجملةُ والوجهةُ يبنيهما التطبيقُ من `core/signals.ts` كما يبنيهما الويب — والمعرّفُ لوجهة «ردّ على رأيك» (D-899).
 */
export async function GET() {
  return handle<SignalsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:signals:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    /* 🆕 N2-fix — الطلباتُ القائمةُ مع الإشعارات: صفُّ «طلب متابعة» يحمل قبولاً ورفضاً ما دام الطلبُ قائماً */
    const [rows, pending] = await Promise.all([mySignals(), getIncomingFollowRequests()]);
    return ok({ me_id: auth.user.id, rows, pending_requests: pending.map((p) => p.id) });
  });
}
