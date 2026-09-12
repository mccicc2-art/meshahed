import { createSmartList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { SmartListBody } from "@/core/contracts/library";

/**
 * `POST /api/v1/lists/smart` — قائمةٌ ذكيّةٌ من مفردات المكتبة (D-948؛ `LibrarySmartForm` أصليّاً).
 * المصدرُ `library` ثابتٌ هنا: الشاشةُ الأصليّة تبني شرطَها من مكتبتك لا من الكتالوج (D-876).
 * الحارسُ (بلس) والتعقيمُ (`sanitizeRule`) في الفعل نفسِه.
 */
export const POST = bodyRoute<SmartListBody, { id: string | null; needsPlus?: true }>(
  (b) => createSmartList(String(b.name ?? ""), b.rule, "library"),
  () => ["me:lists", "me:library"],
);
