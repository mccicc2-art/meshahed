import type { ReactNode } from "react";

/**
 * مجموعةُ إعداداتٍ — **عنوانٌ صغيرٌ خارج البطاقة وصفوفٌ داخلها** (D-462).
 *
 * **والعنوانُ خارجها لا داخلها**: عنوانٌ داخل البطاقة يصير **صفّاً أوّلَ
 * لا يُضغط** بين صفوفٍ تُضغط كلُّها — **وقائمةٌ فيها صفٌّ ميّتٌ تُجرَّب
 * قبل أن تُفهم.**
 *
 * **والفواصلُ بين الصفوف لا حولها**: `divide-y` يرسم الخيطَ بين كلِّ
 * صفّين — **ولا يرسمه فوق الأوّل ولا تحت الأخير** حيث حدُّ البطاقة
 * موجودٌ أصلاً، **وخطّان متلاصقان يُقرآن خطأً في الرسم.**
 */
export function SettingsGroup({
  label,
  children,
  className = "",
}: {
  /** عنوانُ المجموعة — يغيب فلا يُحجَز له مكان (D-044) */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {label && (
        <h2 className="px-1 mb-2 text-12 font-semibold uppercase tracking-wide text-muted">
          {label}
        </h2>
      )}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-[color:var(--divider)]">
        {children}
      </div>
    </section>
  );
}
