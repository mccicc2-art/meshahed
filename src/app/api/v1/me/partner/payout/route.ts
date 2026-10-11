import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { requestPayout } from "@/lib/actions";

/**
 * `POST /api/v1/me/partner/payout` — **طلبُ تحويل** (🆕 D-1362 · V-C · C7 · الدفعة ٢).
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`requestPayout` — D-901) **وكلُّ بوّابةٍ في جسم `request_payout`**: شريكٌ قائم · بياناتٌ مكتملة ·
 * ≥ ١٠٠ · ≤ الرصيد · لا طلبَ معلَّقاً آخر (وفهرسٌ فريد). هذا الملفُّ لا يحكم في مالٍ — ينقل المبلغَ ويسمّي الرفضَ بمفتاحه.
 */
const REASONS: [string, "forbidden" | "invalid_input" | "conflict", "apiPayoutNotPartner" | "apiPayoutDetails" | "apiPayoutMin" | "apiPayoutBalance" | "apiPayoutPending"][] = [
  ["Not a partner", "forbidden", "apiPayoutNotPartner"],
  ["Complete your payout details", "conflict", "apiPayoutDetails"],
  ["Minimum is SAR 100", "invalid_input", "apiPayoutMin"],
  ["Insufficient balance", "conflict", "apiPayoutBalance"],
  ["already have a pending request", "conflict", "apiPayoutPending"],
];

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: { amount?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    const amount = typeof body?.amount === "number" ? body.amount : NaN;
    if (!Number.isFinite(amount)) return fail("invalid_input", { field: "amount", message_key: "apiPayoutMin" });
    try {
      await requestPayout(amount);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const hit = REASONS.find(([needle]) => msg.includes(needle));
      if (hit) return fail(hit[1], { message_key: hit[2] });
      throw e;
    }
    return ok({ done: true }, []);
  });
}
