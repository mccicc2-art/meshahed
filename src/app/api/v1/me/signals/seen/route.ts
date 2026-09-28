import { markSignalsSeen } from "@/lib/actions";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/me/signals/seen` — ختمُ «رأيتُها» **عند العرض لا عند المغادرة** (`MarkSignalsSeen`، D-463/D-125).
 * **بلا وسم**: التطبيقُ يُسقط الشارةَ في كاشه (الرئيسيّة والصندوق) — والجلبُ التالي يؤكّدها من الخادم.
 */
export async function POST() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    await markSignalsSeen();
    return ok({ done: true as const });
  });
}
