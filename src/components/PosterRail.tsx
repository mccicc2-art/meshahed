import Link from "next/link";

/**
 * صفّ أفقي قابل للسحب بدل شبكة تلتفّ.
 *
 * لماذا: من يتابع ١٥ عملاً كان قسم «أكمل المشاهدة» عنده كتلة تدفع كل ما
 * تحتها خارج الشاشة. الصفّ يعرض ثلاثة ويخفي الباقي خلف السحب، فتُرى
 * أربعة أقسام في شاشة واحدة بدل قسم ونصف.
 */
export function PosterRail({
  title,
  href,
  seeAllLabel,
  subtitle,
  children,
}: {
  title: string;
  href?: string;
  seeAllLabel?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="text-base font-bold">{title}</h2>
        {href && seeAllLabel && (
          <Link
            href={href}
            className="text-xs text-muted hover:text-accent transition shrink-0"
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
export function RailItem({ children }: { children: React.ReactNode }) {
  return <div className="w-[112px] sm:w-[132px] shrink-0">{children}</div>;
}
