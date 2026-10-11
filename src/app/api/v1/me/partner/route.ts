import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import {
  getMyPartnerState,
  getMyPartnerApplication,
  getMyPartnerDetails,
  getMyPartnerBalance,
  getMyPayoutRequests,
  getProfile,
} from "@/lib/data";
import { isPlus } from "@/core/plan";
import { siteUrl } from "@/lib/site";
import type { MyPartnerPayload, PartnerDashboard } from "@/core/contracts/profile";

/**
 * `GET /api/v1/me/partner` — **حالُ الشريك** (🆕 D-1361 · Phase 11-V · V-C · C7 · الدفعة ١، قرارُ أحمد ١١ أكتوبر: «الشركاء
 * الآن» ثمّ «نفذ»). تبويبُ «Loopz Partners» كان صفحةَ ويبٍ خلف «اعرف أكثر» في شاشة الدعوات الأصليّة.
 * **القراءاتُ قراءاتُ التبويب نفسُها** (`PartnersTab`): `my_partner_state` · شرطا التقديم من ملفّي (`x_verified_at` · `isPlus` —
 * **للرسم وحدَه**، الحارسُ في جسم `apply_partner`، D-855) · وحقولُ الطلب حين يوجد طلبٌ لم يوافَق عليه (تعبئةُ النموذج).
 *
 * 🆕 D-1362 (الدفعة ٢) — **ولوحةُ الموافَق عليه** (`dashboard`): الرابطُ والعدّادان والرصيدُ وطلباتُ التحويل وبياناتُ التحويل —
 * قراءاتُ لوحة الويب نفسُها (`getMyPartnerDetails` · `partner_balance` · `my_payout_requests`)، **وكلُّها لصاحبها وحدَه بحكم RLS
 * والدوالّ** لا بحكم هذا الملفّ (لا معرّفَ في الطلب). 🗑️ D-1364 — **ولا شيءَ عن وثيقة الهويّة**: لم تعد تُطلب (قرارُ أحمد «1 أ»).
 */
export async function GET() {
  return handle<MyPartnerPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:partner:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    const [state, me] = await Promise.all([getMyPartnerState(), getProfile().catch(() => null)]);
    const application = state.appStatus === "pending" || state.appStatus === "rejected" ? await getMyPartnerApplication() : null;
    let dashboard: PartnerDashboard | null = null;
    if (state.appStatus === "approved" && state.code) {
      const [details, available, payouts] = await Promise.all([
        getMyPartnerDetails(),
        getMyPartnerBalance(auth.user.id),
        getMyPayoutRequests(),
      ]);
      dashboard = {
        url: siteUrl(`/p/${state.code}`),
        clicks: state.clicks,
        joined: state.joined,
        available,
        pending: payouts.filter((r) => r.status === "pending" || r.status === "approved").reduce((sum, r) => sum + r.amount, 0),
        has_pending_payout: payouts.some((r) => r.status === "pending"),
        payouts: payouts.map((r) => ({ id: r.id, amount: r.amount, status: r.status, requested_at: r.requestedAt, note: r.note })),
        details: {
          iban: details?.iban ?? "",
          bank_name: details?.bank_name ?? "",
          account_name: details?.account_name ?? "",
          phone: details?.phone ?? "",
        },
      };
    }
    return ok({
      status: state.appStatus,
      applied_at: state.appliedAt,
      requirements: { x: !!me?.x_verified_at, plus: isPlus(me) },
      application,
      dashboard,
    });
  });
}
