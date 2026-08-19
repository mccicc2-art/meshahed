import Link from "next/link";
import { Icon, type IconName } from "../Icon";

/**
 * صفُّ إعدادٍ — **رمزٌ واسمٌ ووصفٌ وقيمةٌ وسهم** (D-462).
 *
 * **ارتفاعُه ٥٦–٦٤ بكسلاً** بحدِّ مواصفة أحمد: `min-h-14` بلا وصفٍ،
 * ويتّسع إلى ٦٤ بوصفه — **وهو فوق حدِّ هدف اللمس (٤٤) في الحالتين.**
 *
 * **والوصفُ سطرٌ يقول ماذا ستجد** لا زينة: **قائمةٌ من أحدَ عشرَ اسماً
 * مجرَّداً تُفتح أقسامُها واحداً واحداً حتى يُعرف مكانُ الشيء** —
 * **والسطرُ الثاني يوفّر تلك الرحلة.**
 *
 * ⚠️ **والسهمُ مُدارٌ** (`rtl:rotate`) فلا يشير في العربية إلى الخارج،
 * **ويغيب حين لا وجهة** — **سهمٌ فوق صفٍّ لا يفتح شيئاً يَعِد ببابٍ لا
 * يوجد** (D-030).
 */
export function SettingsRow({
  href,
  onClick,
  icon,
  title,
  subtitle,
  value,
  danger = false,
  trailing,
}: {
  href?: string;
  onClick?: () => void;
  icon?: IconName;
  title: string;
  subtitle?: string;
  /** القيمةُ الحاليّة في الطرف — «عامّ» · «العربية» */
  value?: string;
  /** أحمرُ هادئ — الخروجُ وحذفُ الحساب */
  danger?: boolean;
  /** بديلُ السهم — مفتاحٌ أو زرُّ نسخ */
  trailing?: React.ReactNode;
}) {
  const body = (
    <>
      {icon && (
        <Icon
          name={icon}
          size={20}
          className={`shrink-0 ${danger ? "text-[color:var(--error)]" : "text-muted"}`}
        />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[15px] font-semibold leading-tight truncate ${
            danger ? "text-[color:var(--error)]" : ""
          }`}
          dir="auto"
        >
          {title}
        </span>
        {subtitle && (
          <span className="block text-[12px] font-medium text-muted leading-tight truncate mt-0.5" dir="auto">
            {subtitle}
          </span>
        )}
      </span>
      {value && (
        <span className="shrink-0 text-[14px] text-muted truncate max-w-[40%]" dir="auto">
          {value}
        </span>
      )}
      {trailing ?? (
        (href || onClick) && (
          <Icon
            name="chevron-down"
            size={18}
            className="shrink-0 text-muted -rotate-90 rtl:rotate-90"
          />
        )
      )}
    </>
  );

  const cls =
    "w-full flex items-center gap-3 min-h-14 px-4 py-3 text-start transition hover:bg-surface-2 active:opacity-80";

  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
