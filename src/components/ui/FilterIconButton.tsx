"use client";

import { Icon } from "../Icon";
import { tap } from "@/lib/haptics";

/**
 * زرُّ الأدوات في صفّ التبويبات — **رمزٌ بلا كلمة** (D-177، طلب أحمد).
 *
 * **الطلب:** «أريدهم جميعاً فيهم خيار الفلتر لكن بدون الكلمة، فقط الرمز…
 * بحيث أستفيد من المساحات وتنسيق الشكل».
 *
 * **ولماذا هو صحيحٌ لا تصغيرَ حجم:** الكلمة كانت تشغل عرضاً في صفٍّ يتنافس
 * فيه أربعةُ تبويباتٍ عربية على ٣٦٠ بكسلاً — وهي **لا تضيف معنًى**: رمز
 * المزالج (`sliders`) مفهومٌ في كل تطبيق. **والمعنى لا يسقط** لأنه باقٍ في
 * `aria-label` لقارئ الشاشة، وفي عنوان الورقة التي يفتحها.
 *
 * **ومكوّنٌ واحد لا وصفةُ أصناف** (بخلاف `sheetMenuItem` في D-145): هنا
 * ليس شكلاً فحسب — بل أيقونةٌ وتسميةٌ ونقطةُ حالةٍ ولمسةٌ اهتزازية، وأربع
 * صفحاتٍ تنسخها أربع مرّات هي بالضبط ما تمنعه القاعدة.
 *
 * **ونقطةُ الحالة لا عدّاد:** العدّاد الذي كان في اكتشف مات مع الكلمة —
 * الرقم على زرٍّ بعرض ٣٦ بكسلاً يزاحم الأيقونة. ونقطةٌ صغيرة تقول «هناك
 * شيءٌ مفعَّل» وهو كلُّ ما يحتاجه من ينظر، **والتفصيل في الرقائق تحته**.
 */
export function FilterIconButton({
  onClick,
  label,
  active = false,
  expanded,
  className = "",
}: {
  onClick: () => void;
  /** ما يقوله قارئ الشاشة — الزرّ بلا نصٍّ مرئيّ، فهذه تسميتُه الوحيدة */
  label: string;
  /** هل خلفه شيءٌ مفعَّل؟ — يضيء الحدّ ويرسم نقطة */
  active?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tap(8);
        onClick();
      }}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      /* `self-center` لا تمدّدٌ رأسيّ: صفُّ التبويبات `items-stretch`
         ليمتدّ شريطُ التمييز الأصفر إلى الخطّ، والزرُّ ليس تبويباً.
         و`mb-1` يرفعه عن الخطّ قليلاً فلا يلامسه. */
      className={`relative shrink-0 self-center mb-1 grid place-items-center h-9 w-9 rounded-full border transition ${
        active
          ? "border-accent text-accent bg-accent/10"
          : "border-border text-muted hover:text-foreground hover:border-accent/50"
      }${className ? ` ${className}` : ""}`}
    >
      <Icon name="sliders" size={16} strokeWidth={1.9} />
      {active && (
        <span
          aria-hidden
          className="absolute top-1 end-1 h-1.5 w-1.5 rounded-full bg-accent"
        />
      )}
    </button>
  );
}
