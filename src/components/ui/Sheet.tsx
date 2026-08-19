"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../Icon";
import { segmentedItem, segmentedTrackFull } from "./controls";
import { tap } from "@/lib/haptics";

/**
 * الورقة المنبثقة الموحّدة.
 *
 * كانت في التطبيق أربع أوراقٍ مستقلّة: واحدة تنزل من الأسفل وأخرى تتوسّط،
 * بثلاث خلفيات (`surface`، `elevated/95`، `background`) وحدَّين مختلفين
 * (`border-border` و`border-white/10`)، وواحدة فقط تُغلق بمفتاح Escape،
 * ولا واحدة منها تقفل تمرير الصفحة خلفها أو تحصر التركيز داخلها — فمن
 * يتنقّل بلوحة المفاتيح كان يخرج بـTab إلى صفحةٍ لا يراها.
 *
 * **وموضعٌ واحد لكلّها منذ D-177 — نقضٌ صريح لتقسيم D-018.** كانت
 * `bottom` تنزل من الأسفل و`top` تهبط من الأعلى و`center` تتوسّط، وكلٌّ
 * لسببٍ وجيه. **لكن أحمد رآها كلَّها في يومٍ واحد فقال:** «الاختلاف في
 * التصميم في كل موقع لازم ما يتكرّر — **هذي هوية ولازم تكون موحّدة**…
 * حتى الإشعارات ليه تكون تحت؟ خلّها كلّها انبثاقها ومكانها نفس انبثاق
 * البحث وفلتر المكتبة».
 *
 * **وهو محقّ، والحجّة القديمة تُقال قبل أن تُترك:** الورقة السفلية أقربُ
 * للإبهام، وهذه كلفةٌ حقيقية تُدفع. **لكنّ ثمن الاختلاف أعلى:** المستخدم
 * يتعلّم «أين تظهر النوافذ في هذا التطبيق» مرّةً واحدة، وثلاثةُ مواضع
 * تعني ثلاث عاداتٍ يتعلّمها لشيءٍ واحد. **والاتّساق هوية.**
 *
 * **فبقي `variant` معنًى في القياس لا في الموضع:** ارتفاعٌ أقصى مختلف
 * (الورقة التي يُكتب فيها أقصر لأن لوحة المفاتيح تأكل الشاشة) وعرضٌ أضيق
 * للتأكيد القصير. **و`bare` وحدها خارج هذا** — تأخذ الحجاب وتترك الشكل.
 *
 * **وإطارٌ بلون الهوية على الجميع (طلب أحمد):** «مرّة يطلع بإطار ذهبي
 * ومرّة بدون، وأنا عجبني الإطار — اعتمده في كل شيء منبثق». و`--accent`
 * لا لونٌ ثابت، **فيتبع الثيم** كما طلب («بلون حسب الثيم»): ذهبيٌّ في
 * الداكن، والذهب الغامق في `daylight`.
 *
 * 🆕 ⚖️ **والإطارُ الذهبيُّ سقط — نقضٌ صريحٌ بطلبه** (D-458: «الإطار
 * الذهبي شيله»). **وحجّةُ D-177 كانت جماليّةً لا وظيفيّة** — «عجبني» —
 * **فلا شيءَ يُفقد بسقوطها**: الورقةُ تُميَّز عمّا تحتها **بالحجاب
 * والسطح المرتفع والظلّ**، ثلاثةُ إشاراتٍ قبل الحدّ.
 * **وقاعدةُ الهويّة تكسبها**: «لا توهّج ولا إطارات صفراء كبيرة» بنصّ
 * مواصفة أحمد الأولى — **وإطارُ بكسلين بلون التمييز حول كلِّ منبثقٍ في
 * التطبيق هو أكبرُ إطارٍ أصفرَ فيه.**
 * **والأصفرُ يعود إلى معناه**: حالةٌ مفعَّلةٌ وفعلٌ مهمّ — **لا زخرفةَ
 * حدود** (نفسُ حكم D-437 حين سقطت الألوانُ الخمسة عن الأيقونات).
 *
 * قفل التمرير على `<html>` لا على `<body>`: سفاري iOS يتجاهل الثاني.
 */

export type SheetVariant = "bottom" | "top" | "center" | "bare";

/** الإطار المشترك — حدُّ النظام لا لونُ التمييز (D-458، نقضُ D-177) */
const FRAME =
  "sheet-pop relative flex flex-col rounded-sheet border border-border bg-[color:var(--elevated)] shadow-2xl overflow-hidden";

const PANEL: Record<SheetVariant, string> = {
  /* `svh` لا `vh` (بلاغ أحمد 9 Aug: «قائمة الإشعارات… طالعة فوق»).
     `vh` في متصفّحات الجوال تقيس الشاشة **بلا** شريط العنوان والأدوات،
     و`svh` تقيس الأصغر (بعد ظهور الأشرطة) فلا يخرج شيء. والسقف يُبقي
     تحت الورقة أثراً من الصفحة يقول إنها ورقة لا شاشة. */
  bottom: `${FRAME} w-full sm:max-w-md max-h-[76svh]`,
  /* أقصرُ من أختها عمداً: هذه لِما يُكتب فيه، **ولوحة المفاتيح تأكل نصف
     الشاشة** — فسقفٌ أعلى يعني ورقةً نصفُها خلف اللوحة. */
  top: `${FRAME} w-full sm:max-w-md max-h-[62svh]`,
  /* أضيق: تأكيدٌ من سطرين وزرّان، وعرضٌ كامل يجعله يبدو شاشةً لا سؤالاً */
  center: `${FRAME} w-full max-w-[320px]`,
  bare: "relative",
};

/**
 * موضعٌ واحد للجميع (D-177) — **من الأعلى، حيث تظهر ورقة البحث**.
 *
 * **فجوةٌ فوقها لا التصاقٌ بالحافّة:** في متصفّح الجوال يقع شريط العنوان
 * فوق أعلى نقطةٍ من الصفحة مباشرةً، و`safe-area-inset-top` يساوي صفراً
 * هناك — فيجلس زرّ الإغلاق في شريطٍ يبتلع اللمسة ويبدو الزرّ معطّلاً.
 */
const TOP_WRAP =
  "fixed inset-0 z-50 flex items-start justify-center pt-[calc(env(safe-area-inset-top)+0.75rem)] px-2 sm:px-0 sm:pt-10";

const WRAP: Record<SheetVariant, string> = {
  bottom: TOP_WRAP,
  top: TOP_WRAP,
  /* نفس الموضع، وحشوٌ جانبيٌّ أوسع يُبقي لوح التأكيد الضيّق متنفّساً */
  center: `${TOP_WRAP} px-8 sm:px-0`,
  bare: "fixed inset-0 z-50 flex items-center justify-center px-8",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onClose,
  closeLabel,
  variant = "bottom",
  dismissible = true,
  labelledBy,
  className = "",
  children,
}: {
  open: boolean;
  onClose?: () => void;
  /** وصف زرّ الحجاب لقارئ الشاشة */
  closeLabel: string;
  variant?: SheetVariant;
  /** ورقةٌ لا تُغلق باللمس خارجها ولا بمفتاح Escape — للحظةٍ تنتهي بفعلٍ
      لا بتجاهل (بطاقة الإنجاز تنتظر تقييمك) */
  dismissible?: boolean;
  /** معرّف العنوان داخل الورقة — يربطه قارئ الشاشة بالنافذة */
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);


  // المستدعي يمرّر `onClose` سهماً جديداً في كل رسمة، ولو اعتمد عليه
  // التأثير لأُعيد تركيبه مع كل نقرةٍ داخل الورقة: يُفكّ قفل التمرير
  // ويُعاد، ويُخطف التركيز من الصفّ الذي لمسه المستخدم للتوّ
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    // التركيز ينتقل إلى اللوح فيقرأ قارئ الشاشة النافذة من أوّلها
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (dismissibleRef.current) onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) {
        e.preventDefault();
        panel.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  /* البوّابة تحتاج `document`، وهو غائبٌ على الخادم — وبعض الأوراق تُستدعى
     بـ`open` ثابتةً (`<Sheet open …>`)، فلا نتّكل على أن الفتح لا يقع إلا
     بعد التركيب. والفحص لا يُحدث اختلافاً في الترطيب: البوّابة لا ترسم شيئاً
     في موضعها من الشجرة أصلاً، فالخادم والعميل يتركان الموضع فارغاً كلاهما. */
  if (!open || typeof document === "undefined") return null;

  /**
   * الورقة تُرسم في `document.body` لا في مكانها من الشجرة (D-159).
   *
   * **العطل الذي كشفه هذا:** `position: fixed` لا يقاس على الشاشة إن كان
   * فوقه سلفٌ يحمل `transform` أو `filter` أو **`backdrop-filter`** — عندها
   * يصير ذلك السلف هو الإطار المرجعيّ. وترويسةُ التطبيق `sticky` وعليها
   * `backdrop-blur(8px)`، فارتفاعُها **٦٤ بكسل**.
   *
   * فكلُّ ورقةٍ تُفتح من الترويسة — **الجرس والبحث** — كانت `inset-0`
   * فيها تعني «املأ الأربعة والستّين بكسلاً»، لا الشاشة. ولأن الورقة
   * السفلية `items-end` ولوحُها ٥٠٤ بكسلاً، **خرج الفائض من أعلاها**:
   * قِيس على الإنتاج فكان `top = -440px`. وهذا نصُّ بلاغ أحمد حرفياً،
   * مرّتين: «قائمة الإشعارات طالعة فوق».
   *
   * **ولهذا لم يُجدِ علاجُ ٩ أغسطس:** خفضُ السقف إلى `80svh` وإضافةُ حاوية
   * التمرير عالجا الارتفاع، **والمشكلة لم تكن في الارتفاع بل في الإطار
   * الذي يُقاس عليه**. والحجابُ كان محبوساً معها، فلا تُظلم الصفحة خلفها.
   *
   * والبوّابة تحلّها **لكل ورقةٍ في التطبيق دفعةً واحدة** وتحصّنها من أي
   * `transform` يُضاف فوقها غداً — بدل ملاحقة كل مستدعٍ على حدة.
   * و`body` داخل `<html dir>` فالاتجاه والثيم يُورَثان كما هما.
   *
   * 🔴 **والبثُّ ينقل العقدةَ ولا ينقل الحدث** (D-356، بلاغُ أحمد:
   * «شاشة التقييم تظهر لكن إذا ضغطت عليها يضغط الي خلفها»).
   *
   * `createPortal` تنقل العنصرَ إلى `document.body` **في شجرة الـDOM
   * وحدَها — وأحداثُ React تصعد في شجرة React كما كُتبت.** فورقةٌ
   * مكتوبةٌ داخل `<Link>` (نجمةُ بطاقة القائمة — D-352) **تُرسَم فوق
   * الشاشة وتُصعِّد ضغطاتِها إلى ذلك الرابط**، فيُختار تقييمٌ وتُفتح
   * صفحةُ القائمة في اللمسة نفسِها.
   *
   * **والحدُّ هنا لا عند كلِّ مستدعٍ** (D-148: العلاجُ عند المصدر):
   * **ورقةٌ حاجبةٌ لا تسرّب حدثاً إلى ما تحجبه — تعريفاً**، فلا يحتاج
   * قارئٌ بعد اليوم أن يتذكّر حارساً. **والإغلاقُ لا يتأثّر**: نقرةُ
   * الحجاب تُعالَج قبل أن تصل هنا، **ومستمعُ `Dropdown` على `document`
   * في طور الالتقاط أسبقُ من React أصلاً** (D-293).
   *
   * ⚠️ **والأربعةُ لا `click` وحدَه**: الضغطةُ المطوّلة تقرأ
   * `pointerdown`/`touchstart` (D-277)، **وإيماءةٌ تبدأ داخل ورقةٍ
   * ليست إيماءةً على ما تحتها.**
   */
  return createPortal(
    <div
      className={WRAP[variant]}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {dismissible ? (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
      ) : (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      )}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`${PANEL[variant]}${className ? ` ${className}` : ""} outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** ترويسة الورقة: عنوانٌ وزرّ إغلاق — نفس الارتفاع في كل ورقة */
export function SheetHeader({
  title,
  closeLabel,
  onClose,
  id,
  action,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  id?: string;
  /** بديلُ زرّ الإغلاق حين يكون للورقة فعلٌ ختاميّ («تمّ» في وضع الترتيب).
      ليست ترويسةً ثانية بل الترويسة نفسها وقد استُبدل زرّها: ورقةٌ تنتهي
      بحفظٍ لا يجوز أن يكون مخرجها الوحيد علامة × تُقرأ إلغاءً. */
  action?: React.ReactNode;
  /** سطرٌ تحت العنوان (حالة، عدّاد) */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[color:var(--divider)]">
      <div className="min-w-0">
        <h3 id={id} className="text-base font-bold truncate">
          {title}
        </h3>
        {children}
      </div>
      {action ?? (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
        >
          <Icon name="close" size={16} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

/**
 * 🆕 **شريطُ تبويبَي ورقةِ الأدوات — واحدٌ لثلاث أوراق** (D-397، بلاغُ
 * أحمد: «تفصل التاب مثل الكومينتي والديسكفري»).
 *
 * **كان مكتوباً بيده مرّتين** — في `CommunityTools` و`DiscoverFilterSheet`
 * — **بنفس الأصناف ونفس مفتاحَي `do`/`see` ونفس الاهتزازة**، **والثالثةُ
 * كانت ستكون نسخةً ثالثة** (D-002/D-145). **وورقةُ المكتبة لم تكن
 * تحملُه أصلاً**: أربعةُ أقسامٍ في تمريرةٍ واحدة، **وآخرُها يُقصّ عند
 * حافّة الشاشة** (لقطةُ أحمد: «Artists» نصفُ سطر).
 *
 * **والقسمةُ نفسُها في الثلاث**: «أدوات» ما تفعله الآن · «عرض» ما
 * يبقى بعد أن تغلق الورقة. **ومعنًى واحدٌ في ثلاثة أسطحٍ يُقرأ مرّةً
 * واحدة** (القاعدة ٦).
 */
export function SheetTabs({
  prefix,
  label,
  tab,
  onTab,
  doLabel,
  seeLabel,
}: {
  /** بادئةُ المعرّفات — `comm-tools` · `disc-tools` · `lib-tools` */
  prefix: string;
  label: string;
  tab: "do" | "see";
  onTab: (t: "do" | "see") => void;
  doLabel: string;
  seeLabel: string;
}) {
  return (
    <div className={segmentedTrackFull} role="tablist" aria-label={label}>
      {(["do", "see"] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          id={`${prefix}-tab-${k}`}
          aria-selected={tab === k}
          aria-controls={`${prefix}-panel-${k}`}
          onClick={() => {
            tap(6);
            onTab(k);
          }}
          className={segmentedItem(tab === k, "flex-1")}
        >
          {k === "do" ? doLabel : seeLabel}
        </button>
      ))}
    </div>
  );
}
