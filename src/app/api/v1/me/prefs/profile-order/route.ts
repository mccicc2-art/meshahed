import { saveProfileSectionOrder } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { ProfileSectionOrderBody } from "@/core/contracts/profile";

/**
 * 🆕 Phase 11-N · N3 — `POST /api/v1/me/prefs/profile-order` — ترتيبُ صفوف قسمٍ في ملفّي (مقبضُ `SectionReorderButton` في الويب، D-581).
 * غلافٌ رقيقٌ فوق `saveProfileSectionOrder`: القسمُ المجهولُ يُرفض فيه، والمفاتيحُ تُنقّى بمرشِّح القراءة نفسِه
 * (`sanitizeProfilePrefs`) — **كاتبٌ واحدٌ للسطحين**. لا وسمَ يُبطَل: الشاشةُ ترتّب كاشَها فوراً ثمّ تعيد جلبَ الملفّ.
 */
export const POST = bodyRoute<ProfileSectionOrderBody, { done: true }>(
  async (b) => {
    const keys = Array.isArray(b.keys) ? b.keys.filter((k): k is string => typeof k === "string").slice(0, 500) : [];
    await saveProfileSectionOrder(String(b.section ?? ""), keys);
    return { done: true as const };
  },
  () => [],
);
