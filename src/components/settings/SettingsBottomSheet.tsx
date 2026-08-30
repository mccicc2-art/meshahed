"use client";

import { useId, type ReactNode } from "react";
import {
  Sheet,
  SheetGrabHandle,
  useSheetDragToDismiss,
  type SheetVariant,
} from "../ui/Sheet";
import { tap } from "@/lib/haptics";

/**
 * ورقةُ الإعدادات — **«إلغاء · عنوان · تمّ»** (D-555، تصميمُ أحمد).
 *
 * ⚠️ **وليست ورقةً ثانية** (القاعدة ٣): الحجابُ والموضعُ والقفلُ وحصرُ
 * التركيز و`Escape` **كلُّها `Sheet` نفسُها** — **والذي أُضيف ترويسةٌ
 * بثلاث خانات** بدل ترويسةِ «عنوانٌ و×».
 *
 * **ولماذا لا تكفي `SheetHeader`:** زرُّها الوحيد × **يُقرأ إغلاقاً لا
 * إلغاءً** — **وورقةٌ تُجمَّع فيها تعديلاتٌ قبل أن تُطبَّق يجب أن تقول
 * صراحةً أين تُرمى وأين تُثبَّت.** **و«تمّ» في الطرف و«إلغاء» في الطرف
 * الآخر جوابُ السؤالين معاً.**
 *
 * ⚠️ **والخروجُ بالحجاب أو بـ`Escape` أو بالسحب لأسفل = إلغاء** بنصّ
 * المواصفة: **التعديلاتُ مسوّدةٌ حتى تُضغط «تمّ»** — **ووَرَقةٌ تحفظ ما
 * لم يُؤكَّد تجعل التراجعَ رحلةً ثانية.**
 *
 * **والعنوانُ في المنتصف حقيقةً لا تقريباً**: الخانتان الجانبيّتان
 * `flex-1 basis-0` **فتتساويان مهما اختلف طولُ الكلمتين** — **و«إلغاء»
 * أقصرُ من «Cancel» وأطولُ من «تمّ»**، ووسطٌ يُحسب من عرضِ النصّ يزيغ
 * بين اللغتين.
 *
 * ================= 🆕 وتصعد من القاع بمقبض (D-558) ==================
 *
 * **قرارُ أحمد بعد أن رأى التصميمين**: «أوراق الإعدادات وحدها من
 * الأسفل». **والمرساةُ خاصّيّةٌ في `Sheet` نفسِها** (`anchor`) —
 * **وحجّةُ حصرِها مكتوبةٌ هناك**، فلا تُخترع مواضعُ عند المستدعين.
 *
 * ⚠️ **والمقبضُ ليس زينة**: **قضيبٌ صغيرٌ فوق الورقة هو ما يقول إنها
 * تُسحب** — **وسحبٌ يعمل بلا علامةٍ تدلّ عليه لا يجده أحد**، **وعلامةٌ
 * لا تعمل وعدٌ يُخلَف** (D-138). **فكلاهما هنا**: القضيبُ يُرى،
 * والسحبُ يُلغي.
 *
 * ⚠️ **والسحبُ يُلغي لا يحفظ** (شرطُ المواصفة: «إلغاء/سحب لأسفل
 * يتجاهل»): **هو مخرجُ الحجاب و`Escape` نفسُه** — **وثلاثةُ أبوابٍ
 * للخروج يجب أن تخرج إلى الحالة نفسِها.**
 *
 * ⚠️ **والعتبةُ ٩٠ بكسلاً لا بكسلاً واحداً**: **تمريرةٌ داخل الورقة
 * تبدأ بحركةٍ رأسيّةٍ صغيرة**، **وعتبةٌ قصيرةٌ تُغلق الورقةَ على من
 * أراد أن يقرأ ما تحت.** **والمقبضُ وحدَه يمسك الإيماءة** — لا جسمُ
 * الورقة — **فلا تنازعَ مع تمرير القائمة أصلاً.**
 */
export function SettingsBottomSheet({
  open,
  title,
  onCancel,
  onDone,
  cancelLabel,
  doneLabel,
  doneDisabled = false,
  variant = "bottom",
  children,
}: {
  open: boolean;
  title: string;
  /** يُرمى ما في المسوّدة — الحجابُ و`Escape` والسحبُ يمرّون من هنا */
  onCancel: () => void;
  /** تُثبَّت المسوّدة */
  onDone: () => void;
  cancelLabel: string;
  doneLabel: string;
  doneDisabled?: boolean;
  /** `top` لمن فيها حقلُ كتابة — لوحةُ المفاتيح تأكل نصفَ الشاشة (D-018) */
  variant?: SheetVariant;
  children: ReactNode;
}) {
  const id = useId();
  /* 🆕 **والإيماءةُ خرجت إلى `ui/Sheet`** (D-802): **جاء قارئُها الثاني**
     (ورقةُ «متى شاهدتَ هذا الموسم؟») — **وعند القارئ الثاني يُستخرج**
     (D-376). **والعتبةُ والحجّةُ كلُّها هناك، ولا نسخةَ ثانيةَ لها.** */
  const { handleProps, panelProps } = useSheetDragToDismiss(onCancel);

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      closeLabel={cancelLabel}
      labelledBy={id}
      variant={variant}
      anchor="bottom"
      className={panelProps.className}
      panelStyle={panelProps.panelStyle}
    >
      <SheetGrabHandle {...handleProps} />

      <div className="flex items-center gap-2 px-2 pt-1 pb-2 border-b border-[color:var(--divider)]">
        <span className="flex-1 basis-0 min-w-0 flex justify-start">
          <button
            type="button"
            onClick={() => {
              tap(8);
              onCancel();
            }}
            className="h-11 px-3 rounded-control text-14 font-medium text-muted hover:text-foreground transition active:scale-95 truncate"
          >
            {cancelLabel}
          </button>
        </span>

        <h3 id={id} className="min-w-0 text-15 font-bold truncate text-center">
          {title}
        </h3>

        <span className="flex-1 basis-0 min-w-0 flex justify-end">
          <button
            type="button"
            onClick={() => {
              tap(10);
              onDone();
            }}
            disabled={doneDisabled}
            className="h-11 px-3 rounded-control text-14 font-bold text-accent hover:brightness-110 transition active:scale-95 truncate disabled:opacity-40 disabled:pointer-events-none"
          >
            {doneLabel}
          </button>
        </span>
      </div>

      {children}
    </Sheet>
  );
}
