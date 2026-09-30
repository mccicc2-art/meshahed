import { Icon } from "./Icon";

/**
 * 🆕 D-1207 — **سطرُ الشهر الصامت** (أحمد ٣٠ سبتمبر، التصوّرُ «أ»): حين لا يتفاعل أحدٌ في نافذة «الأكثر تفاعلاً» يرجع الترتيبُ إلى
 * الأحدث — **ويُقال ذلك** بسطرٍ خافتٍ بأيقونة معلومات، فلا يبدو الزرُّ معطّلاً. يختفي بأوّل إعجابٍ أو ردّ. نظيرُه في «النقاشات»
 * (`TalkFilters`) وفي التطبيق.
 */
export function QuietHint({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-12 text-muted pt-1 pb-3">
      <Icon name="info" size={14} />
      <span>{text}</span>
    </p>
  );
}
