import { updateUiState } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { RATE_CARD_SNOOZE_MS } from "@/core/rateQueue";

/** `POST /api/v1/me/rate-queue/hide-card` — 🆕 T530 ✕ على بطاقة «بانتظار تقييمك» في الرئيسيّة: تغيب أسبوعاً في كلِّ أجهزته */
export const POST = bodyRoute<Record<string, never>, { ok: boolean }>(
  async () => {
    const r = await updateUiState({ rateCard: new Date(Date.now() + RATE_CARD_SNOOZE_MS).toISOString() });
    if (!r.ok) throw new Error("ui_state");
    return { ok: true };
  },
  () => ["me:rate-queue"],
);
