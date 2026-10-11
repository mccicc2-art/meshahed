import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getMyPartnerState, getMyPartnerApplication, getProfile } from "@/lib/data";
import { isPlus } from "@/core/plan";
import type { MyPartnerPayload } from "@/core/contracts/profile";

/**
 * `GET /api/v1/me/partner` — **حالُ الشريك** (🆕 D-1361 · Phase 11-V · V-C · C7 · الدفعة ١، قرارُ أحمد ١١ أكتوبر: «الشركاء
 * الآن» ثمّ «نفذ»). تبويبُ «Loopz Partners» كان صفحةَ ويبٍ خلف «اعرف أكثر» في شاشة الدعوات الأصليّة.
 * **القراءاتُ قراءاتُ التبويب نفسُها** (`PartnersTab`): `my_partner_state` · شرطا التقديم من ملفّي (`x_verified_at` · `isPlus` —
 * **للرسم وحدَه**، الحارسُ في جسم `apply_partner`، D-855) · وحقولُ الطلب حين يوجد طلبٌ لم يوافَق عليه (تعبئةُ النموذج).
 * ⚖️ **لا أرباحَ ولا بياناتِ تحويلٍ ولا كودَ شريكٍ هنا**: لوحةُ الموافَق عليه الدفعةُ الثانية، ومسارٌ لا يحمل ما لا يُرسم.
 */
export async function GET() {
  return handle<MyPartnerPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:partner:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    const [state, me] = await Promise.all([getMyPartnerState(), getProfile().catch(() => null)]);
    const application = state.appStatus === "pending" || state.appStatus === "rejected" ? await getMyPartnerApplication() : null;
    return ok({
      status: state.appStatus,
      applied_at: state.appliedAt,
      requirements: { x: !!me?.x_verified_at, plus: isPlus(me) },
      application,
    });
  });
}
