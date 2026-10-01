import { useLayoutEffect } from "react";
import { tabCommit } from "./perfMarks";

/**
 * 🆕 D-1231 — **مسبارُ الالتزام**: لا يرسم شيئاً. تأثيرُه بلا تبعيّات يجري في مرحلة التخطيط عند كلِّ التزامٍ يرسمه — **وعند
 * كشف الشجرة بعد التجميد** (React يعيد تركيبَ تأثيرات التخطيط للمكشوف). وإخوةُ الأب تُعالَج بترتيبها: الأوّلُ قبل الشاشة
 * يعلّم بدءَ المرحلة، والأخيرُ بعدها يعلّم نهايتَها. `tabCommit` لا يكتب إلّا داخل نافذة تبديلٍ إلى هذه الشاشة، ومرّةً.
 */
export function CommitProbe({ edge, screen }: { edge: "cs" | "ce"; screen: string }) {
  useLayoutEffect(() => {
    tabCommit(edge, screen);
  });
  return null;
}
