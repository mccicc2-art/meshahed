"use client";

import { useEffect, useRef } from "react";
import { Icon } from "../Icon";

/**
 * الورقة المنبثقة الموحّدة.
 *
 * كانت في التطبيق أربع أوراقٍ مستقلّة: واحدة تنزل من الأسفل وأخرى تتوسّط،
 * بثلاث خلفيات (`surface`، `elevated/95`، `background`) وحدَّين مختلفين
 * (`border-border` و`border-white/10`)، وواحدة فقط تُغلق بمفتاح Escape،
 * ولا واحدة منها تقفل تمرير الصفحة خلفها أو تحصر التركيز داخلها — فمن
 * يتنقّل بلوحة المفاتيح كان يخرج بـTab إلى صفحةٍ لا يراها.
 *
 * أربعة أنواع لا أربعة تطبيقات: `bottom` لقوائم الأفعال (تلامس الإبهام على
 * الجوال وتتوسّط على الشاشة الواسعة)، و`top` لِما يُكتب فيه، و`center`
 * لتأكيدٍ قصير، و`bare` لمن يرسم لوحه بنفسه (بطاقة الاحتفال بحلقتها
 * المتدرّجة) فيأخذ الحجاب وإمكانية الوصول ويترك الشكل.
 *
 * قفل التمرير على `<html>` لا على `<body>`: سفاري iOS يتجاهل الثاني.
 */

export type SheetVariant = "bottom" | "top" | "center" | "bare";

const PANEL: Record<SheetVariant, string> = {
  bottom:
    "sheet-pop relative w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-sheet sm:rounded-sheet border border-border bg-[color:var(--elevated)] shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]",
  /* الورقة العلوية — لِما يُكتب فيه لا لِما يُضغط.
     لوحة المفاتيح تأكل نصف الشاشة السفلي، فورقةٌ ملتصقة بالأسفل تُدفَع
     فوقها وتختفي نتائجها خلفها؛ وأعلى الشاشة يبقى ظاهراً دائماً فالحقل
     ونتائجه فوق الإبهام لا تحته. و`svh` لا `vh`: الوحدة الصغيرة تقيس
     الشاشة بعد ظهور شريط المتصفّح ولوحة المفاتيح في iOS. */
  top: "sheet-pop relative w-full sm:max-w-md max-h-[62svh] flex flex-col rounded-sheet border border-border bg-[color:var(--elevated)] shadow-2xl overflow-hidden",
  center:
    "sheet-pop relative w-full max-w-[320px] rounded-sheet border border-border bg-[color:var(--elevated)] shadow-2xl overflow-hidden",
  bare: "relative",
};

const WRAP: Record<SheetVariant, string> = {
  bottom: "fixed inset-0 z-50 flex items-end sm:items-center justify-center",
  /* فجوةٌ فوق الورقة العلوية لا التصاقٌ بالحافّة: في متصفّح الجوال يقع
     شريط العنوان فوق أعلى نقطة من الصفحة مباشرةً، و`safe-area-inset-top`
     يساوي صفراً هناك — فيجلس زرّ الإغلاق في شريطٍ يبتلع اللمسة، ويبدو
     الزرّ معطّلاً. الفجوة تُنزل الورقة إلى حيث تصل الإصبع. */
  top: "fixed inset-0 z-50 flex items-start justify-center pt-[calc(env(safe-area-inset-top)+0.75rem)] px-2 sm:px-0 sm:pt-10",
  center: "fixed inset-0 z-50 flex items-center justify-center px-8",
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

  if (!open) return null;

  return (
    <div className={WRAP[variant]}>
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
    </div>
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
