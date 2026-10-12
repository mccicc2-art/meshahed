// «من يقدر يراسلني» — D-1380 (الهجرة ٢٠٠)

/**
 * 🆕 D-1380 — **ثلاثُ درجاتٍ لا مفتاحٌ واحد** (أحمد ١٢ أكتوبر: «ضيف في الخصوصية زر إغلاق الخاص»، ثمّ اعتمد الثلاث):
 * مفتاحٌ بحالتين يُجبر من يريد تقليلَ الإزعاج على قطع أصدقائه معه؛ «المتبادلون» هو سلوكُ ما قبل اليوم.
 * القفلُ يمنع **بدء** محادثةٍ فقط — القائمةُ تستمرّ (البوّابُ `can_message` في القاعدة).
 * يقرؤه الويبُ والتطبيقُ والخادم — مصدرٌ واحدٌ للأسماء والطول.
 */
export const DM_POLICIES = ["everyone", "mutual", "none"] as const;
export type DmPolicy = (typeof DM_POLICIES)[number];
export const DEFAULT_DM_POLICY: DmPolicy = "everyone";

export function sanitizeDmPolicy(raw: unknown): DmPolicy {
  return typeof raw === "string" && (DM_POLICIES as readonly string[]).includes(raw) ? (raw as DmPolicy) : DEFAULT_DM_POLICY;
}

/** أقصى طول الرسالة النصّيّة — رقمُ العقد نفسُه (`MSG_TEXT_MAX`) لا نسخةٌ ثانية */
export { MSG_TEXT_MAX as DM_MAX } from "./contracts/messages.ts";
