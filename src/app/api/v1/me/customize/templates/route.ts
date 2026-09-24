import { updateUiState } from "@/lib/actions";
import { sanitizePrefTemplates } from "@/core/prefTemplates";
import { bodyRoute } from "@/lib/v1body";
import type { TemplatesBody } from "@/core/contracts/settings";

/**
 * 🆕 D-1112 — قوالبُ التخصيص («احفظ هذا التنسيق» — D-822) للتطبيق: القائمةُ كاملةً كما يرسلها
 * `PrefTemplatesRow` في الويب إلى `updateUiState({ tpl })` — **والحارسُ (بلس) والدمجُ هناك** لا هنا.
 */
export const POST = bodyRoute<TemplatesBody, { ok: boolean; needsPlus?: true }>(
  (b) => updateUiState({ tpl: sanitizePrefTemplates(b.tpl) }),
  () => [],
);
