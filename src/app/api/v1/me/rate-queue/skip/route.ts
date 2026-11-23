import { updateUiState } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { rateKey } from "@/core/rateQueue";

/**
 * `POST /api/v1/me/rate-queue/skip` — 🆕 T530 «تخطَّ»: العملُ يخرج من «بانتظار تقييمك» ومن عددها، في كلِّ أجهزته
 * (`ui_state.rateSkip`، الكاتبُ الوحيد `updateUiState`). تقييمُه من صفحته يبقى مفتوحاً كما هو.
 */
export const POST = bodyRoute<{ kind?: unknown; id?: unknown }, { ok: boolean }>(
  async (b) => {
    const kind = b.kind === "tv" || b.kind === "movie" ? b.kind : null;
    const id = Number(b.id);
    if (!kind || !Number.isInteger(id) || id <= 0) throw new Error("invalid_input");
    const r = await updateUiState({ addRateSkip: rateKey(kind, id) });
    /* فشلُ الحفظ خطأٌ لا «نجاحٌ بلا حفظ» (مراجعةُ الوكيل، البند ٩): التطبيقُ يعيد العملَ إلى القائمة ويقول ذلك */
    if (!r.ok) throw new Error("ui_state");
    return { ok: true };
  },
  () => ["me:rate-queue"],
);
