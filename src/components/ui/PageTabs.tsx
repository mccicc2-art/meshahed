import Link from "next/link";
import { Icon, type IconName } from "../Icon";
import { segmentedItem } from "./controls";

export interface PageTab {
  key: string;
  label: string;
  /** رقمٌ باهت بجانب الاسم — جردٌ لا إشارة (١٥ فيلماً) */
  count?: number;
  /** شارةٌ ملوّنة — إشارةٌ تطلب فعلاً (٣ رسائل غير مقروءة)، تختفي عند الصفر */
  badge?: number;
  badgeLabel?: string;
  /** أيقونةٌ تظهر من `sm:` فصاعداً — تُحذف على الضيّق كي لا يُقصّ النصّ */
  icon?: IconName;
  href?: string;
  onClick?: () => void;
}

/**
 * رأسُ التبويبات اللاصق — **مكوّنٌ واحد لكل صفحات التطبيق**.
 *
 * قبل هذا كان كل صفحةٍ تبني رأسها بيدها: `/people` و`/library` و`/news`
 * ثلاث نسخٍ من الفكرة نفسها بثلاثة حشواتٍ مختلفة. والنتيجة رآها أحمد
 * قبل أن يراها أحد (٩ Aug، بأربع لقطات): **صفُّ التبويبات يقفز رأسياً
 * بين الصفحات** — واحدٌ أنزل، وآخر أرفع — و**خطّان رماديان** في بعضها
 * بدل خطٍّ واحد.
 *
 * الخطّان لم يكونا سهواً بل نتيجةً حتميّة: `segmentedTrackFull` يحمل
 * `border-b`، والحاوية اللاصقة تحمل `border-b` أخرى — فيُرسم خطٌّ تحت
 * التبويبات وخطٌّ تحت الرأس كلّه. هنا **المسار عارٍ والحاوية وحدها تحمل
 * الخطّ**: خطٌّ واحد يعني نهاية الرأس، وشريط التمييز الأصفر وحده يعني
 * التبويب المفتوح.
 *
 * والحشو ثابتٌ في مكانٍ واحد (`pt-1` ثم البند ثم `pb-2`)، فأي صفحةٍ
 * تستعمله تبدأ تبويباتها عند البكسل نفسه. تغييرُ الإيقاع بعد اليوم
 * تغييرٌ في ملفٍّ واحد لا في ثلاثة يُنسى أحدها.
 *
 * `px-2` لا `px-4` في البند: أربعة تبويباتٍ عربية على ٣٦٠px لا تحتمل
 * ستّة عشر بكسلاً على كل جانب — وتصغير الخطّ ممنوع (`02`).
 */
export function PageTabs({
  items,
  active,
  ariaLabel,
  action,
  extra,
  asNav = false,
  className = "",
}: {
  items: PageTab[];
  active: string;
  ariaLabel: string;
  /** أداةٌ في طرف صفّ التبويبات نفسه (زرّ الفلاتر في اكتشف) */
  action?: React.ReactNode;
  /** صفٌّ تحت التبويبات داخل الرأس اللاصق (البحث والفرز في المكتبة) */
  extra?: React.ReactNode;
  /** روابط لا أزرار: `nav` + `aria-current` بدل `tablist` + `aria-selected` */
  asNav?: boolean;
  /**
   * أصنافٌ تُضاف إلى الجذر **اللاصق** نفسه.
   *
   * **لماذا لا يلفّه المستدعي بحاويةٍ بدلاً من ذلك:** `position: sticky`
   * يتحرّك داخل **حدود أبيه** لا داخل الصفحة. فحاويةٌ تلفّ الرأس وحده
   * تكون بارتفاعه، فلا يبقى للّاصق مسافةٌ يقطعها ويمرّ مع الصفحة كأنه
   * ليس لاصقاً. وقع هذا فعلاً في اكتشف (بلاغ أحمد ٩ Aug: «عمود التبويبات
   * ظاهر مثل قبل»): حاويةُ `transition-opacity` كانت أباه القصير.
   */
  className?: string;
}) {
  const inner = items.map((tb) => {
    const on = tb.key === active;
    const cls = segmentedItem(
      on,
      "flex-1 basis-0 min-w-0 flex items-center justify-center gap-1.5 px-2 pt-2 pb-3 text-[13px]",
      false,
    );
    const body = (
      <>
        {tb.icon && (
          <Icon
            name={tb.icon}
            size={16}
            className={`shrink-0 hidden sm:block transition-colors ${on ? "text-accent" : ""}`}
          />
        )}
        <span className="truncate">{tb.label}</span>
        {typeof tb.count === "number" && (
          <span
            className={`shrink-0 tabular-nums text-[12px] transition-colors ${
              on ? "text-accent" : "text-muted/70"
            }`}
            dir="ltr"
          >
            {tb.count}
          </span>
        )}
        {typeof tb.badge === "number" && tb.badge > 0 && (
          <span
            aria-label={tb.badgeLabel}
            className="shrink-0 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-[11px] font-bold tabular-nums"
            dir="ltr"
          >
            {tb.badge}
          </span>
        )}
      </>
    );

    return tb.href ? (
      <Link key={tb.key} href={tb.href} aria-current={on ? "page" : undefined} className={cls}>
        {body}
      </Link>
    ) : (
      <button
        key={tb.key}
        type="button"
        role={asNav ? undefined : "tab"}
        aria-selected={asNav ? undefined : on}
        onClick={tb.onClick}
        className={cls}
      >
        {body}
      </button>
    );
  });

  return (
    /* الخلفية صمّاء لا شفافة: الملصقات وصور الأعمال تمرّ خلف الرأس.
       والهوامش السالبة تمدّ الخلفية والخطّ إلى حافّتَي الشاشة.

       **الحدّ على صفّ التبويبات لا على الرأس كلّه** (بلاغ أحمد 9 Aug:
       «لا تحط خط ثاني»): شريطُ التمييز الأصفر يجلس عند `-bottom-px` من
       البند، فإن كان الحدّ أسفل الرأس بعد صفّ البحث طفا الأصفر فوقه
       بفجوةٍ وقُرئ خطّاً ثانياً. وضعُه هنا يجعل الأصفر **جزءاً من الخطّ
       الرمادي نفسه**. والصفّ يمتدّ إلى حافّتَي الشاشة بهامشٍ سالب
       ثانٍ كي يبقى الخطّ بعرض الشاشة كما كان. */
    <div
      className={`sticky top-[var(--sticky-top)] z-20 -mx-4 px-4 pt-1 bg-[color:var(--background)]${className ? ` ${className}` : ""}`}
    >
      <div className="-mx-4 px-4 flex items-stretch gap-2 border-b border-[color:var(--divider)]">
        {asNav ? (
          <nav aria-label={ariaLabel} className="min-w-0 flex-1 flex items-stretch">
            {inner}
          </nav>
        ) : (
          <div role="tablist" aria-label={ariaLabel} className="min-w-0 flex-1 flex items-stretch">
            {inner}
          </div>
        )}
        {action}
      </div>
      {/* ما تحت الخطّ يبقى داخل الرأس اللاصق ويمرّر معه — والحشو
          السفليّ هنا لا على الحاوية، وإلا فصل الخطَّ عن التبويبات */}
      {extra ? <div className="pt-3 pb-2">{extra}</div> : <div className="pb-2" />}
    </div>
  );
}
