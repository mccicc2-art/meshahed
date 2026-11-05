import { getProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { goldUntilOf } from "@/lib/billing";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { isGold, isPlus } from "@/core/plan";
import type { BillingSyncPayload, RcEnvironment, SubStatus, SubTier } from "@/core/billing";

export const dynamic = "force-dynamic";

/**
 * 🆕 `POST /api/v1/me/billing/sync` — **خطّتي كما يراها الخادم** بعد شراءٍ أو استرجاع (المرحلة ١).
 * يقرأ ولا يكتب: الكتابةُ للويبهوك وحده (مفتاحُ الخدمة)، والتطبيقُ يعيد السؤالَ بمهلةٍ حتى يصل الحدث.
 * ⚖️ بجلسة العضو: صفوفُ اشتراكه تُقرأ بسياسة «صاحبه وحده» (هجرة ١٥٩).
 */
export async function POST() {
  return handle<BillingSyncPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:billing-sync:${auth.user.id}`, 20, 60_000);
    if (lim) return lim;
    const supabase = await createClient();
    const [p, goldUntil, subs] = await Promise.all([
      getProfile(),
      goldUntilOf(supabase, auth.user.id),
      supabase
        .from("subscriptions")
        .select("status, plan, current_period_end, cancel_at_period_end, environment, updated_at")
        .eq("user_id", auth.user.id)
        .eq("provider", "revenuecat")
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);
    const bearer = { ...(p ?? {}), gold_until: goldUntil };
    const s = ((subs.data ?? []) as { status: SubStatus; plan: SubTier; current_period_end: string | null; cancel_at_period_end: boolean; environment: RcEnvironment | null }[])[0];
    return ok({
      plus: isPlus(bearer),
      gold: isGold(bearer),
      plus_until: p?.plus_until ?? null,
      gold_until: goldUntil,
      store: s ? { status: s.status, plan: s.plan, current_period_end: s.current_period_end, cancel_at_period_end: !!s.cancel_at_period_end, environment: s.environment ?? "production" } : null,
    });
  });
}
