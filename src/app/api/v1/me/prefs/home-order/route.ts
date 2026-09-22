import { saveHomeSectionOrder } from "@/lib/actions";
import { getProfile } from "@/lib/data";
import { isPlus } from "@/core/plan";
import { bodyRoute } from "@/lib/v1body";
import type { HomeOrderBody } from "@/core/contracts/home";

/**
 * `POST /api/v1/me/prefs/home-order` — ترتيبُ أقسام الرئيسية وإخفاؤها
 * (`HomeSectionsOrder`، D-595). **قفلُ البلس في الفعل نفسِه** (D-791):
 * `saveHomeSectionOrder` يصمت لغير المشترك، فيُسأل الملفُّ (مخبّأٌ في
 * الطلب) قبله ويعود `needsPlus` ليعرف التطبيقُ لماذا لم يتغيّر شيء
 * (وصفةُ `me/prefs/tabs`).
 */
export const POST = bodyRoute<HomeOrderBody, { ok: boolean; needsPlus?: true }>(
  async (b) => {
    const order = Array.isArray(b.order) ? b.order.filter((s) => typeof s === "string").slice(0, 32) : [];
    const plus = isPlus(await getProfile());
    if (!plus) return { ok: false, needsPlus: true };
    await saveHomeSectionOrder(order);
    return { ok: true };
  },
  () => ["home"],
);
