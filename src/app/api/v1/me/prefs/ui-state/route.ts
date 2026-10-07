import { updateUiState } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { UiStateBody } from "@/core/contracts/library";

/**
 * `POST /api/v1/me/prefs/ui-state` — تلميحاتٌ قُرئت (D-954)، **و🆕 تقدّمُ الجولة** (D-1318).
 *
 * 🔑 **الفعلُ نفسُه الذي يكتبه `OneTimeHint` و`TourGuide` في الويب** (`updateUiState`):
 * الاتّحادُ والتطهيرُ والسقفُ في الفعل، **والتطبيقُ يرسل المعرّفَ أو الحالةَ وحدَها** —
 * فـ«مقروءٌ في أيِّ مكانٍ مقروءٌ في كلِّ مكان» (حكمُ أحمد ١٩ أغسطس، هجرة ١٢١).
 *
 * 🆕 **و`tour` يدخل من هنا** لأنّ الجولةَ صارت تُرسم في التطبيق (T1) وحالتُها حالةُ الحساب نفسُها:
 * من بدأها في الهاتف لا تُعرَض عليه في المتصفّح. **الشكلُ يطهّره الفعل** (`sanitizeTourState`)،
 * **وإصدارٌ أقدمُ لا يكتب فوق أحدث** (`tourWrite`). ⚠️ **والغائبُ لا يُمرَّر**: `tour: undefined`
 * يُبقي المخزَّن، وطلبُ تلميحٍ وحدَه لا يمسّ الجولة.
 *
 * لا `resetHints` ولا `filters` من هنا: بابٌ واحدٌ ضيّقٌ لما تحتاجه الشاشة.
 */
export const POST = bodyRoute<UiStateBody, { ok: boolean }>(
  (b) =>
    updateUiState({
      ...(Array.isArray(b.addHints) ? { addHints: b.addHints.map(String).slice(0, 8) } : {}),
      ...(b.tour && typeof b.tour === "object" ? { tour: b.tour } : {}),
    }).then((r) => ({ ok: r.ok })),
  () => ["me:library"],
);
