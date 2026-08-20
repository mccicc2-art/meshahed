import Link from "next/link";
import { Icon, type IconName } from "../Icon";
import { segmentedItem } from "./controls";
import { TabUnderline } from "./TabUnderline";

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
  swipe = false,
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
   * 🆕 **الشريطُ يمشي مع سحب الصفحة** (D-276) — **اختياريٌّ لا افتراضيّ**:
   * لا يُشترى إلا لصفٍّ صفحاتُه تنزلق فعلاً (`TabPager`). **وأداةٌ تعد
   * بحركةٍ لا تقع أسوأُ من أداةٍ ساكنة** (D-217).
   * **ويُخفى الشريطُ الزائف عن المختار هنا وحدَه** فلا شريطان.
   */
  swipe?: boolean;
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
    /* **`flex-1 basis-auto` ولا انكماش — بدل `basis-0` المتساوي.**
       كان كلُّ تبويبٍ رُبعَ الصفّ بالضبط مهما طال اسمه، فاسمٌ لا يسع
       رُبعاً **يُقصّ** — وهو بلاغ أحمد بلقطة: «اسم الكومينتي فوق ما هو
       ظاهر» (Comm…). والقصُّ أسوأ ما يقع لتبويب: **بابٌ لا يُقرأ اسمه
       ليس باباً**، وتصغيرُ الخطّ ممنوع (`02`).
       الآن: العرضُ يبدأ من عرض النصّ ثم **ينمو** ليملأ الصفّ — فأربعةُ
       أسماءٍ قصيرة تتوزّع بالتساوي كما كانت تماماً — **ولا ينكمش**
       (`shrink-0`)، فإن طال مجموعُها مرّر الصفُّ نفسه أفقياً بدل أن
       يبتلع الحروف. وهو ما تفعله كلُّ التطبيقات على الجوال. */
    const cls = segmentedItem(
      on,
      "flex-1 shrink-0 flex items-center justify-center gap-1.5 px-3 pt-2 pb-3 text-14 whitespace-nowrap",
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
        <span>{tb.label}</span>
        {typeof tb.count === "number" && (
          <span
            className={`shrink-0 tabular-nums text-12 transition-colors ${
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
            className="shrink-0 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold tabular-nums"
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
    /* **`-mt-6` يبتلع حشو الصفحة فوقه (D-177، طلب أحمد بلقطتين):** الحاوية
       `main` تحمل `py-6`، فكان بين ترويسة التطبيق وصفّ التبويبات أربعةٌ
       وعشرون بكسلاً فارغة **في كل صفحةٍ ذات تبويبات**. والفراغُ فوق رأسٍ
       لاصقٍ لا يفعل شيئاً: لا يفصل شيئاً عن شيء (فوقه ترويسةٌ صمّاء)،
       ويسرق من الشاشة الأولى سطراً كاملاً على الجوال.
       **والهامش السالب هنا لا حذفُ `py-6` من `main`:** ذاك يمسّ كلَّ صفحةٍ
       في التطبيق بما فيها ما لا تبويبات لها، وهذا يمسّ من استعمل المكوّن
       وحده. و`pt-1` باقيةٌ — أربعةُ بكسلات تمنع لصقَ الحروف بالترويسة. */
    <div
      className={`chrome-sub sticky top-[var(--sticky-top)] z-20 -mt-6 -mx-4 px-4 pt-1 bg-[color:var(--background)]${className ? ` ${className}` : ""}`}
    >
      <div className="-mx-4 px-4 flex items-stretch gap-2 border-b border-[color:var(--divider)]">
        {/* صمّامُ الأمان: يُمرَّر أفقياً حين لا يسع الصفُّ أسماءه — وبلا
            شريط تمرير مرئيّ (نفس وصفة `chipRow` و`RailScroll`، فلا عائلةَ
            تمريرٍ ثانية). ولا `-mx-4 px-4` هنا: الأبُ يحملها أصلاً */}
        {(() => {
          /* **المحدِّثُ الموضعيّ يُخفي الشريطَ الزائف** ويُبقي `segmentedItem`
             كما هو لبقيّة التطبيق — **لا عائلةَ ثانية** (D-002/D-276). */
          const strip = `relative min-w-0 flex-1 flex items-stretch overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden${
            swipe ? " [&_[aria-current=page]]:after:hidden" : ""
          }`;
          const at = swipe ? items.findIndex((x) => x.key === active) : -1;
          const body = (
            <>
              {inner}
              {at >= 0 && <TabUnderline index={at} />}
            </>
          );
          return asNav ? (
            <nav aria-label={ariaLabel} className={strip}>
              {body}
            </nav>
          ) : (
            <div role="tablist" aria-label={ariaLabel} className={strip}>
              {body}
            </div>
          );
        })()}
        {action}
      </div>
      {/* ما تحت الخطّ يبقى داخل الرأس اللاصق ويمرّر معه — والحشو
          السفليّ هنا لا على الحاوية، وإلا فصل الخطَّ عن التبويبات */}
      {extra ? <div className="pt-3 pb-2">{extra}</div> : <div className="pb-2" />}
    </div>
  );
}
