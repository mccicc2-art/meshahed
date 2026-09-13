import { updateUiState } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { UiStateBody } from "@/core/contracts/library";

/**
 * `POST /api/v1/me/prefs/ui-state` — تلميحاتٌ قُرئت (D-954).
 *
 * 🔑 **الفعلُ نفسُه الذي يكتبه `OneTimeHint` في الويب** (`updateUiState`):
 * الاتّحادُ والتطهيرُ والسقفُ في الفعل، **والتطبيقُ يرسل المعرّفَ وحدَه** —
 * فـ«مقروءٌ في أيِّ مكانٍ مقروءٌ في كلِّ مكان» (حكمُ أحمد ١٩ أغسطس، هجرة ١٢١).
 * لا `resetHints` ولا `filters` من هنا: بابٌ واحدٌ ضيّقٌ لما تحتاجه الشاشة.
 */
export const POST = bodyRoute<UiStateBody, { ok: boolean }>(
  (b) => updateUiState({ addHints: Array.isArray(b.addHints) ? b.addHints.map(String).slice(0, 8) : [] }).then((r) => ({ ok: r.ok })),
  () => ["me:library"],
);
