import { getProfile } from "@/lib/data";
import { updateUiState } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { handle, requireUser } from "@/lib/v1";
import { getT } from "@/lib/locale";
import { ok } from "@/core/contracts/result";
import { sanitizeWidgetStore, widgetPlanState } from "@/core/widgetFeedV2";
import type { WidgetPrefsBody, WidgetPrefsPayload, WidgetPrefsResult } from "@/core/contracts/widget";

/**
 * 🆕 **ودجت لوبز — الإعدادُ والتخطيطات** (خطّةُ v2، W40 · W41).
 * `GET` — ما يرسمه التطبيقُ في شاشة «ودجت لوبز»: الإعدادُ، والتخطيطات (الآيفون)، وحالةُ الاشتراك.
 * `POST {widget}` — **الكاتبُ نفسُه** `updateUiState` (وصفةُ خلفيّة المحادثات): التطهيرُ وحارسُ البلس هناك،
 * **و`needsPlus` يعود صريحاً** ليفتح التطبيقُ بابَ البلس بدل صمت.
 */
export async function GET() {
  return handle<WidgetPrefsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const [{ t }, profile] = await Promise.all([getT(), getProfile()]);
    const store = sanitizeWidgetStore((profile?.ui_state as { widget?: unknown } | null | undefined)?.widget, t.widgetLayoutDefault);
    return ok({ ...store, ...widgetPlanState(profile) });
  });
}

export const POST = bodyRoute<WidgetPrefsBody, WidgetPrefsResult>(
  (b) => updateUiState({ widget: b.widget }),
  () => ["user:me:profile"],
);
