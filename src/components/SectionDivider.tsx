import type { CSSProperties } from "react";

/**
 * فاصل قسمٍ مسمّى — خيطان متساويان حول كلمةٍ في المنتصف.
 *
 * وُلد في المكتبة (فواصل الحالات) ثم احتاجته اكتشف لإيقاع الأقسام
 * (تقييم 9 Aug م١)، فانتزع مكوّناً مشتركاً: قاعدة النظام أن النمط
 * الواحد عائلةٌ واحدة — نسخةٌ ثانية من الفاصل خطأ لا تنويع.
 */
export function SectionDivider({
  label,
  className = "",
  style,
}: {
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`} role="separator" style={style}>
      <span className="flex-1 h-px bg-[color:var(--divider)]" aria-hidden />
      <span className="shrink-0 text-[11px] font-bold text-muted">{label}</span>
      <span className="flex-1 h-px bg-[color:var(--divider)]" aria-hidden />
    </div>
  );
}
