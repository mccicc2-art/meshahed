import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getPickerItems } from "@/lib/listPicker";
import type { PickerPayload } from "@/core/contracts/library";

/**
 * 🆕 T450 — `GET /api/v1/lists/picker` — أعمالُ مكتبتك لاختيار «قائمة جديدة» الأصليّ (الخطوةُ الأولى)، بالقارئ نفسِه
 * الذي ترسم به صفحةُ الويب (`getPickerItems`). **بلا TMDB** — جداولُنا وحدَها.
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:lists:picker:${auth.user.id}`, 20, 60_000);
    if (lim) return lim;
    const payload: PickerPayload = { items: await getPickerItems(await getLocale()) };
    return ok(payload);
  });
}
