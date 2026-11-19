import { previewSmartList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { SmartPreviewBody, SmartPreviewResult } from "@/core/contracts/library";

/**
 * 🆕 T450 — `POST /api/v1/lists/smart-preview` — معاينةُ القائمة الذكيّة الحيّة في صفحة «قائمة جديدة» الأصليّة.
 * فوق `previewSmartList` نفسِها التي تقرؤها صفحةُ الويب (D-145)، **ولا وسمَ يُبطَل** — قراءةٌ لا تكتب شيئاً.
 */
export const POST = bodyRoute<SmartPreviewBody, SmartPreviewResult>(
  (b) => previewSmartList(b.rule, b.source === "library" ? "library" : "catalog"),
  () => [],
);
