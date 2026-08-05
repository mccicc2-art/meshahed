/**
 * رسالة حالة موحّدة.
 *
 * كان الخطأ يُكتب بأربع طرق: صندوق `red-500/10`، ونصّ `red-300` عارٍ
 * بأربع مسافات مختلفة، و`var(--error)`، وتوستان بلونين مختلفين — وثلثها
 * بلا `role="alert"` فلا يسمعها قارئ الشاشة أصلاً. اللون هنا من التوكن
 * الدلاليّ لا من سلّم Tailwind الأحمر: معنى «خطأ» لا يتبدّل بتبدّل الثيم،
 * ولا يصحّ أن يبقى ثابتاً بالمصادفة.
 */

export type AlertTone = "error" | "success" | "info";

const TONE: Record<AlertTone, { text: string; box: string }> = {
  error: {
    text: "text-[color:var(--error)]",
    box: "bg-[color:var(--error)]/10 border-[color:var(--error)]/35",
  },
  success: {
    text: "text-[color:var(--success)]",
    box: "bg-[color:var(--success)]/10 border-[color:var(--success)]/35",
  },
  info: {
    text: "text-[color:var(--info)]",
    box: "bg-[color:var(--info)]/10 border-[color:var(--info)]/35",
  },
};

export function Alert({
  tone = "error",
  /** سطرٌ عارٍ بلا صندوق — تحت حقلٍ أو زرّ */
  inline = false,
  center = false,
  className = "",
  children,
}: {
  tone?: AlertTone;
  inline?: boolean;
  center?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <p
      role="alert"
      className={`text-sm ${t.text}${center ? " text-center" : ""}${
        inline ? "" : ` rounded-control border px-3.5 py-2.5 ${t.box}`
      }${className ? ` ${className}` : ""}`}
    >
      {children}
    </p>
  );
}
