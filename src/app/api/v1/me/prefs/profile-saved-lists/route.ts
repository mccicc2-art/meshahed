import { setProfileSavedLists } from "@/lib/actions";
import { getProfile } from "@/lib/data";
import { isPlus } from "@/core/plan";
import { bodyRoute } from "@/lib/v1body";
import type { ProfileSavedListsBody } from "@/core/contracts/profile";

/**
 * 🆕 Phase 11-N · N3 — `POST /api/v1/me/prefs/profile-saved-lists` — رايةُ قسم «القوائم المحفوظة» في ملفّي
 * (`SavedListsToggle` في الويب، D-594). **قفلُ البلس في الفعل نفسِه** (D-791): `setProfileSavedLists` يصمت لغير المشترك،
 * فيُسأل الملفُّ قبله ويعود `needsPlus` ليعرف التطبيقُ لماذا لم يتغيّر شيء (وصفةُ `me/prefs/home-order`).
 */
export const POST = bodyRoute<ProfileSavedListsBody, { ok: boolean; needsPlus?: true }>(
  async (b) => {
    if (!isPlus(await getProfile())) return { ok: false, needsPlus: true as const };
    await setProfileSavedLists(b.on === true);
    return { ok: true };
  },
  () => [],
);
