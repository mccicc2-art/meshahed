import type { ButtonHTMLAttributes } from "react";

/**
 * الزرّ الموحّد.
 *
 * كان نصّ صنف الزرّ الرئيسي منسوخاً في أكثر من عشرين موضعاً بفروقٍ صامتة:
 * `py-2.5` هنا و`py-2` هناك، `font-semibold` و`font-bold`، `disabled:opacity-50`
 * و`-60`، وثلاثة ألوان لرتبةٍ واحدة (accent، accent-2، أبيض). الفرق لم يكن
 * قراراً في أيّ من هذه المواضع — كان أثر النسخ. هنا رتبةٌ واحدة لكل معنى.
 *
 * `buttonClass` منفصلة عن المكوّن لأن نصف الأزرار في التطبيق روابط
 * (`<Link>`)، ورابطٌ يرث شكل الزرّ أصدق من زرٍّ يتظاهر بأنه رابط.
 */

export type ButtonVariant = "primary" | "inverse" | "surface" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-15",
};

const VARIANTS: Record<ButtonVariant, string> = {
  /** الفعل الأول في الشاشة */
  primary: "bg-accent text-[color:var(--on-accent)] hover:brightness-110",
  /** فعلٌ أول على خلفيةٍ صورية (الغلاف، صفحة الدخول): سطحٌ معاكس للصفحة */
  inverse:
    "bg-[color:var(--surface-inverse)] text-[color:var(--on-surface-inverse)] shadow-[0_10px_28px_rgba(0,0,0,0.28)] hover:brightness-95",
  /** فعلٌ ثانوي بحدّ */
  surface: "bg-surface-2 border border-border text-foreground hover:border-accent",
  /** فعلٌ خفيف بلا سطح */
  ghost: "text-muted hover:text-foreground",
  /** فعلٌ متلف — الحذف وحده */
  danger: "bg-[color:var(--error)] text-white hover:brightness-110",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** يملأ عرض حاويته */
  full?: boolean;
  className?: string;
} = {}) {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}${full ? " w-full" : ""}${
    className ? ` ${className}` : ""
  }`;
}

export function Button({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, full, className })}
      {...props}
    />
  );
}
