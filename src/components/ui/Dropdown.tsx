"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * **قائمةٌ منسدلة مربوطةٌ بمقبضها** (D-226، طلبُ أحمد: «مثل تويتر — قائمةٌ
 * منسدلةٌ ناعمة فيها أنيميشن سريع»).
 *
 * **وهي استخراجٌ لا اختراع:** `LangFlagMenu` تكتب هذا الشكلَ بيدها منذ
 * D-162 — نفسُ البطاقة المرتفعة، ونفسُ ماسك النقر المبوَّب إلى `body`،
 * ونفسُ حجّة `z-index`. **والنسخةُ الثانية كانت ستصير عائلةً ثانية**، فما
 * كان مكتوباً هناك نُقل هنا، **ونسخةُ الأصل حُذفت في الدفعة نفسها**
 * (D-159/D-166: العلاج عند المصدر، وتُحذف نسخُه معه).
 *
 * ================= ثلاثةُ قراراتٍ منقولةٌ بحجّتها =================
 *
 * **١ · ماسكُ النقر في `body` لا هنا.** المقبضُ قد يعيش داخل ترويسةٍ عليها
 * `backdrop-blur`، **وهي إطارٌ مرجعيّ لكل `fixed` تحتها**: `inset-0` كانت
 * تعني «غطِّ الترويسة» لا «غطِّ الشاشة»، فالنقرُ أسفلها لا يُغلق شيئاً.
 *
 * **٢ · و`z-20` للماسك لا `z-40`.** القائمةُ تبقى `absolute` تحت مقبضها،
 * **وترويسةٌ بـ`z-30` تُنشئ سياقَ تكديسٍ خاصّاً بها** — فماسكٌ بـ`z-40` في
 * `body` كان يُرسم **فوق** القائمة ويبتلع النقر على صفوفها. تحت الثلاثين
 * يبقى خلف الترويسة ويغطّي كلَّ ما عداها. **و`catcherZ` يُترك مفتوحاً**
 * لسطحٍ يكتشف غير ذلك، وافتراضُه ما ثبت.
 *
 * **٣ · `Escape` يُغلق، والتركيز يعود إلى المقبض.** قائمةٌ لا تُغلق
 * بالمفتاح مصيدةٌ لمن لا يستعمل فأرة (قاعدةُ الوصول الملزِمة).
 *
 * ⚠️ **وما ليست هي:** ليست بديلاً عن `Sheet`. **الورقةُ لقرارٍ يستحقّ أن
 * يوقف الصفحة** (بلاغ · حظر · اختيار صورة)، **والمنسدلةُ لخيارٍ سريعٍ
 * ملتصقٍ بمقبضه**. اثنتان لأن المعنيين اثنان، لا لأن الشكلين اثنان.
 */
export function Dropdown({
  open,
  onClose,
  labelledBy,
  align = "end",
  catcherZ = "z-20",
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** معرّفُ العنصر الذي يسمّي القائمة — المقبضُ عادةً */
  labelledBy?: string;
  /** جهةُ المحاذاة تحت المقبض: النهاية افتراضاً (تنقلب في RTL من نفسها) */
  align?: "start" | "end";
  catcherZ?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <button
            aria-hidden
            tabIndex={-1}
            onClick={onClose}
            className={`fixed inset-0 ${catcherZ} cursor-default`}
          />,
          document.body,
        )}
      <div
        ref={panel}
        role="menu"
        aria-labelledby={labelledBy}
        /* `end-0`/`start-0` منطقيّتان فتنقلبان في RTL بلا شرط (D-216)،
           و`--menu-origin` يجعل الحركة تخرج من المقبض لا من الوسط */
        style={{ ["--menu-origin" as string]: align === "end" ? "100% 0" : "0 0" }}
        className={`absolute ${align === "end" ? "end-0" : "start-0"} top-full mt-1.5 z-50 min-w-52 rounded-2xl border border-border bg-[color:var(--elevated)]/95 backdrop-blur-xl shadow-2xl overflow-hidden py-1 menu-pop ${className}`}
      >
        {children}
      </div>
    </>
  );
}

/**
 * صفٌّ داخل المنسدلة — **وصفةٌ لا مكوّن** (D-145): بعضُ الصفوف `button`
 * وبعضُها `Link`، فالمشترك سلسلةُ الأصناف لا الوسم.
 */
export const dropdownItem =
  "w-full flex items-center gap-3 px-4 py-2.5 text-start text-[14px] text-foreground " +
  "hover:bg-surface-2 active:bg-surface-2 disabled:opacity-50 transition";

export const dropdownDivider = "my-1 h-px bg-[color:var(--divider)]";
