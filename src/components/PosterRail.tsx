import Link from "next/link";
import { Icon, type IconName } from "./Icon";

/**
 * صفّ أفقي قابل للسحب بدل شبكة تلتفّ.
 *
 * لماذا: من يتابع ١٥ عملاً كان قسم «أكمل المشاهدة» عنده كتلة تدفع كل ما
 * تحتها خارج الشاشة. الصفّ يعرض ثلاثة ويخفي الباقي خلف السحب، فتُرى
 * أربعة أقسام في شاشة واحدة بدل قسم ونصف.
 */
export function PosterRail({
  title,
  icon,
  iconColor,
  href,
  seeAllLabel,
  subtitle,
  children,
}: {
  title: string;
  icon?: IconName;
  /** لون أيقونة العنوان — ثابت لا يتبع الثيم، فالقسم يُعرف بلونه */
  iconColor?: string;
  href?: string;
  seeAllLabel?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="flex items-center gap-2.5 text-[19px] font-bold">
          {icon && (
            <Icon
              name={icon}
              size={22}
              strokeWidth={1.9}
              style={iconColor ? { color: iconColor } : undefined}
              className={iconColor ? "" : "text-muted"}
            />
          )}
          {title}
        </h2>
        {href && seeAllLabel && (
          <Link
            href={href}
            className="text-[13px] text-muted hover:text-accent transition shrink-0"
          >
            {seeAllLabel}
          </Link>
        )}
      </div>
      {subtitle && <p className="text-xs text-muted mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}

      {/* الهوامش السالبة تجعل الصفّ يلامس حافة الشاشة فيبدو أنه يكمل خلفها */}
      <div className="-mx-4 px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 w-max pb-1">{children}</div>
      </div>
    </section>
  );
}

/** عنصر داخل الصفّ — عرض ثابت حتى لا تتمدّد البطاقات */
export function RailItem({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`shrink-0 ${wide ? "w-[268px] sm:w-[320px]" : "w-[118px] sm:w-[138px]"}`}>{children}</div>;
}
