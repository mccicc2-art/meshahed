import { bodyRoute } from "@/lib/v1body";
import { updateSmartListRule } from "@/lib/actions";
import { listTag } from "@/core/contracts/tags";
import type { SmartRuleBody } from "@/core/contracts/library";

/**
 * `POST /api/v1/lists/smart-rule` — تعديلُ شرطِ قائمةٍ ذكيّةٍ قائمة (Phase 11-G · G5؛ يُقفل بابَ
 * `/library?edit=<id>` الويبيَّ في التطبيق). **المصدرُ لا يُرسَل**: `updateSmartListRule` يقرأ `rule_source`
 * من الصفّ ويعقّم بمفرداته — فلا يستطيع عميلٌ قلبَ قائمةِ مكتبةٍ إلى كتالوج. بلس والملكيّةُ في الفعل نفسِه.
 */
export const POST = bodyRoute<SmartRuleBody, { ok: boolean; needsPlus?: true }>(
  (b) => updateSmartListRule(String(b.listId ?? ""), b.rule),
  (b) => [listTag(String(b.listId ?? "")), "me:lists", "me:library"],
);
