import { mySignals } from "@/lib/actions";
import { getIncomingFollowRequests } from "@/lib/data";
import { handle, limited, requireUser, signalsAware } from "@/lib/v1";
import type { Signal } from "@/lib/actions";
import { ok } from "@/core/contracts/result";
import type { SignalsPayload } from "@/core/contracts/messages";

/**
 * `GET /api/v1/me/signals` — أسطرُ الجرس (`mySignals` نفسُها) — **تُطلب حين يُفتح تبويبُها وحدَه** (D-125 باقياً).
 * الجملةُ والوجهةُ يبنيهما التطبيقُ من `core/signals.ts` كما يبنيهما الويب — والمعرّفُ لوجهة «ردّ على رأيك» (D-899).
 */
/**
 * 🆕 T496 — **أنواعُ الجرس الجديدة لنسخةٍ لا تعرفها**: كلُّ نوعٍ إلى أخيه القديم (جملتُه ووجهتُه كما كانت قبل اليوم)، والنوعان
 * اللذان لم يكن لهما أخٌ قط (`talk_like` · `request_accepted`) لا يُرسَلان — سطرٌ لا تعرف النسخةُ جملتَه أسوأُ من غيابه.
 */
const LEGACY: Partial<Record<Signal["kind"], Signal["kind"] | null>> = {
  like_rating: "like_review",
  reply_reply: "reply",
  list_reply_reply: "list_reply",
  talk_like: null,
  request_accepted: null,
  library_grant: null,
};
function legacyRows(rows: Signal[]): Signal[] {
  const out: Signal[] = [];
  for (const r of rows) {
    const to = LEGACY[r.kind];
    if (to === null) continue;
    out.push(to ? { ...r, kind: to } : r);
  }
  return out;
}

export async function GET() {
  return handle<SignalsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:signals:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    /* 🆕 N2-fix — الطلباتُ القائمةُ مع الإشعارات: صفُّ «طلب متابعة» يحمل قبولاً ورفضاً ما دام الطلبُ قائماً */
    const [all, pending, aware] = await Promise.all([mySignals(), getIncomingFollowRequests(), signalsAware()]);
    const rows = aware ? all : legacyRows(all);
    return ok({ me_id: auth.user.id, rows, pending_requests: pending.map((p) => p.id) });
  });
}
