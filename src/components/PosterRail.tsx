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
  bare = false,
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
  /**
   * 🔴 🆕 **والمحتوى يُرسم كما هو حين لا يكون صفّاً** (D-428، عطلٌ قِيس
   * على الموقع الحيّ بعد D-422): **مجموعةُ المكتبة المفتوحةُ شبكةٌ**،
   * **وشبكةٌ داخل `RailScroll` تنهار** — الحاويةُ صفٌّ أفقيٌّ بعناصرَ
   * `shrink-0`، **فالشبكةُ تدخله بعرضٍ صفريٍّ وتُرسم فارغةً بسهمين.**
   * **والرأسُ هو المشترَك لا الجاري**: العنوانُ والعدّادُ والزرُّ واحدٌ
   * في الحالتين، **والذي يتبدّل ما تحته** — **فمعاملٌ واحدٌ أصدق من
   * ترويسةٍ ثانيةٍ تُنسخ** (القاعدة ٣/D-002).
   */
  bare?: boolean;
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
      {bare ? (
        children
      ) : (
        <RailScroll prevLabel="السابق / Previous" nextLabel="التالي / Next">
          {children}
        </RailScroll>
      )}
    </section>
  );
}

/**
 * عنصر داخل الصفّ — عرض ثابت حتى لا تتمدّد البطاقات.
 *
 * 🔴 🆕 **وثلاثةُ مقاسات لأن المحتوى ثلاثةُ أشكال، لا لأن الذوق ثلاثة**
 * (D-433، طلبُ أحمد: «بطاقة سبايدرمان مقاسها ممتاز، أبغا الكل مثلها»
 * و«في المكتبة كل البطائق أبغاها بالمقاس الجديد»):
 *
 * - `poster` — **٢:٣**، بطاقةُ عملٍ واحدة. **وهو الافتراض.**
 * - `backdrop` — **١٦:٩**، «أكمل المشاهدة». **وهو `wide` القديم بحرفه،
 *   فلا يتحرّك عنده شيء** (D-152).
 * - `list` — **بطاقةُ قائمة**: ثلاثةُ ملصقاتٍ وسطرا نصّ. **وهي التي كبرت.**
 *
 * **ولماذا كبرت — والدليلُ لقطتُه:** **مكتبتُه ترسم قوائمَه في شبكةِ
 * عمودين** فتصير البطاقةُ ٥٥٢px بملصقاتٍ ١٧٦×٢٥٠، **ورفُّ «المحفوظة»
 * تحتها مباشرةً يرسم البطاقةَ نفسَها ٣٢٠px بملصقاتٍ ٩٣×١٤١** — **بطاقةٌ
 * واحدةٌ بمقاسين في شاشةٍ واحدة.** **والحكمُ حكمُه: الكبيرُ هو الصحيح.**
 *
 * ⚠️ **والثمنُ معلَن**: **قوائمُ أقلُّ في عرض الشاشة الواحد** — بطاقتان
 * حيث كانت ثلاثٌ ونصف. **وهو ما طُلب**، **ورفٌّ يعرض أكثرَ ممّا يُقرأ
 * ليس مكسباً.** **والجوّالُ كبر قليلاً وحدَه** (٢٦٠ → ٢٨٠) لأن الشاشةَ
 * هي الحدُّ هناك لا اختيارُنا.
 *
 * ⚠️ **ولا بولياناتٌ تتراكم**: كان `wide` علماً واحداً، **وعلمان يعنيان
 * أربعَ حالاتٍ منها اثنتان مستحيلتان** (D-224) — **فصار المقاسُ اسماً
 * يُقرأ في موضع النداء.**
 */
export type RailSize = "poster" | "backdrop" | "list";

const RAIL_W: Record<RailSize, string> = {
  poster: "w-[118px] sm:w-[138px]",
  backdrop: "w-[260px] sm:w-[320px]",
  list: "w-[280px] sm:w-[420px] lg:w-[520px]",
};

export function RailItem({
  children,
  size = "poster",
}: {
  children: React.ReactNode;
  size?: RailSize;
}) {
  return <div className={`shrink-0 snap-start ${RAIL_W[size]}`}>{children}</div>;
}
