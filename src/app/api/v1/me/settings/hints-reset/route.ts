import { updateUiState } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { HintsResetBody } from "@/core/contracts/settings";

/**
 * `POST /api/v1/me/settings/hints-reset` — «أعد عرض التلميحات» (`HelpTourRows`):
 * يفرّغ `ui_state.hints` في الحساب؛ التطبيقُ يقرأ التلميحاتِ من `me:library`
 * فإبطالُه يعيدها، والويبُ يمحو مفاتيحَ `loopz-hint:*` في متصفّحه عند فتح صفحته.
 */
export const POST = bodyRoute<HintsResetBody, { ok: boolean }>(
  () => updateUiState({ resetHints: true }).then((r) => ({ ok: r.ok })),
  () => ["me:library"],
);
