import Link from "next/link";
import { Icon, type IconName } from "./Icon";
import { RailScroll } from "./RailScroll";

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
  onTitle,
  seeAllLabel,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  icon?: IconName;
  /** لون أيقونة العنوان — ثابت لا يتبع الثيم، فالقسم يُعرف بلونه */
  iconColor?: string;
  href?: string;
  /**
   * 🆕 **والعنوانُ زرٌّ حين تكون الوجهةُ في مكانها** (D-422، مكتبةُ
   * الرفوف): **العنوانُ بابٌ منذ أن طلبه أحمد** («أقدر أضغط على
   * الاسم») — **والبابُ رابطٌ حين تكون الوجهةُ صفحةً، وزرٌّ حين تكون
   * الوجهةُ فتحَ الصفِّ نفسِه.** **ولا يجتمعان**: `href` أوّلاً.
   */
  onTitle?: () => void;
  seeAllLabel?: string;
  subtitle?: string;
  /** عنصرٌ في طرف العنوان (زرّ إجراء) — بديلٌ عن رابط «الكل» في هذا الصفّ */
  action?: React.ReactNode;
  /**
   * صفوفُ الصفحات الأخرى تُباعدها حاويتُها (`space-y-*`)، **وأقسامُ لوحة
   * الأعضاء تحمل هامشَها بنفسها** (`mt-7` في `BoardSection`) — فمن سكن
   * اللوحةَ مرّر هامشَها من هنا. **والغيابُ هو السلوكُ القائم** فلا
   * يتحرّك قارئٌ آخر (D-152).
   */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="flex items-center gap-2.5 text-[19px] font-bold">
          {icon && (
            <Icon
              name={icon}
              size={22}
              style={iconColor ? { color: iconColor } : undefined}
              className={iconColor ? "" : "text-muted"}
            />
          )}
          {/* العنوان نفسه بابٌ حين توجد وجهة (طلب أحمد: «أقدر أضغط على الاسم») */}
          {href ? (
            <Link href={href} className="hover:text-accent transition">
              {title}
            </Link>
          ) : onTitle ? (
            <button type="button" onClick={onTitle} className="hover:text-accent transition">
              {title}
            </button>
          ) : (
            title
          )}
        </h2>
        {action
          ? action
          : href && seeAllLabel && (
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

      {/* الهوامش السالبة تجعل الصفّ يلامس حافة الشاشة فيبدو أنه يكمل خلفها.
          overscroll-x-contain: التمرير الزائد على iOS كان يفعّل «رجوع»
          المتصفح خطأً؛ وsnap يجعل التوقّف على حدود البطاقات.

          و`scroll-px-4` ليست زينة: نقطةُ الالتقاط تُحاذي البطاقة بحافّة
          مجال التمرير لا بحافّة المحتوى، فيبتلع المتصفّح الحشوة الجانبية
          ويبدأ هذا الصفّ من حافّة الشاشة بينما عنوانه وبقيّةُ الصفوف
          (التي لا التقاط فيها) على الهامش — خطّان مختلفان في الشاشة
          الواحدة. تعليم الحشوة للالتقاط يعيد الجميع إلى خطٍّ واحد. */}
      {/* أسهم سطح المكتب داخل RailScroll — التعليق التاريخي عن الهوامش
          والالتقاط انتقل معه إلى المكوّن نفسه */}
      <RailScroll prevLabel="السابق / Previous" nextLabel="التالي / Next">
        {children}
      </RailScroll>
    </section>
  );
}

/** عنصر داخل الصفّ — عرض ثابت حتى لا تتمدّد البطاقات */
export function RailItem({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className={`shrink-0 snap-start ${wide ? "w-[260px] sm:w-[320px]" : "w-[118px] sm:w-[138px]"}`}
    >
      {children}
    </div>
  );
}
