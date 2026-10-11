import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { cancelPartnerApplication } from "@/lib/actions";

/**
 * `POST /api/v1/me/partner/withdraw` — **سحبُ طلبٍ قيد المراجعة** (🆕 D-1361 · V-C · C7 · الدفعة ١).
 * الفعلُ فعلُ الويب نفسُه (`cancelPartnerApplication`): الحذفُ في جسم الدالّة محصورٌ بصفّي و`pending` وحدَها — الموافَقُ عليه لا
 * يُسحب من هنا مهما أُرسل. بلا جسم: لا شيءَ يُختار.
 */
export async function POST() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    await cancelPartnerApplication();
    return ok({ done: true }, []);
  });
}
