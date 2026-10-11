"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetGrabHandle, useSheetDragToDismiss } from "./ui/Sheet";
import { sheetScroll } from "./ui/controls";
import { buttonClass } from "./ui/Button";
import { Icon } from "./Icon";
import { tap } from "@/lib/haptics";
import { HOME_QUEUE_EVENT, type QueueRow } from "./HomeQueueOrder";

/**
 * ====== 🆕 D-1355 — ورقةُ «الكلّ» الواحدةُ لأقسام الرئيسيّة (الويب) ======
 *
 * حكمُ أحمد ١١ أكتوبر (D-1353، بتسجيلٍ مرّ فيه على رؤوس الأقسام): «يبيلنا نحدّد آليّة تعمَّم على جميع أقسام
 * الرئيسيّة»، وقرارُه لها «التطبيق والويب». التطبيقُ شُحن في D-1353 (`apps/mobile/src/home/HomeAllSheet.tsx`)؛ هذه
 * نسختُه هنا، بالقواعد نفسِها:
 * - **«الكلّ» والعنوانُ يفتحان ورقةً بمحتوى القسم نفسِه** — في كلِّ قسم.
 * - **ارتفاعُها صفّان** والباقي بالتمرير («ماخذه حجم كبير، خلّ يبان صفّين»).
 * - **الترتيبُ زرٌّ داخل الورقة** لا معنًى ثانٍ لكلمة «الكلّ».
 *
 * ⚖️ **ينقض بحكم صاحبها** D-605/D-624/D-863 («الكلّ» في الصفوف الثلاثة هي زرُّ الترتيب) و D-378 (العنوانُ بابُ
 * المكتبة). **ويُبقي** D-868 («الكلّ يفتحها منبثقةً هنا») وسقفَ D-733 (الورقةُ تُرسم مع الصفحة لا عند فتحها).
 *
 * 🔑 **بابان لورقةٍ واحدة بحدث نافذة** (نمطُ `HomeQueueSheetHost`): العنوانُ في رأس القسم و«الكلّ» في طرفه عنصران
 * متباعدان في شجرة خادم، والحدثُ يقطع جرَّ الخيط بينهما. الورقةُ تسكن بجوار كلمة «الكلّ».
 *
 * ⚖️ **من القاع، بقرار صاحبها** («1 ب»، ١١ أكتوبر، بعد أن قيل له إن أوراقَ الويب من الأعلى): استثناءٌ جديدٌ محصورٌ من
 * D-177 بجوار D-558/D-1314 — ورقةُ الرئيسيّة تصعد كما تصعد في التطبيق. والمرساةُ والمقبضُ والسحبُ أدواتُ `Sheet`
 * المشتركةُ (D-802) لا نسخةٌ هنا. ⚠️ والثمنُ يُقال: ورقةُ الترتيب التي تتبادل معها تبقى من الأعلى.
 *
 * ⚖️ **الترتيبُ يفتح ورقتَه القائمة** (`ReorderSheet` بتبويب «عرض» فيها — D-918) **بعد أن تُغلق هذه**: ورقةٌ فوق
 * ورقةٍ ليست من لغتنا، ونسخُ السحب هنا لغةٌ ثانية. في التطبيق تتحوّل الورقةُ نفسُها؛ هنا تتبادلان.
 */
export const HOME_ALL_EVENT = "loopz:home-all";
export type HomeAllSection = "continue" | "towatch" | "upcoming" | "shows" | "movies" | "lists" | "friends";

/** العنوانُ بابٌ — يفتح ورقةَ قسمه (`HomeAllSheet` بالاسم نفسِه) */
export function HomeAllTitle({ section, children }: { section: HomeAllSection; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => {
        tap(6);
        window.dispatchEvent(new CustomEvent(HOME_ALL_EVENT, { detail: section }));
      }}
      className="hover:text-accent transition text-start"
    >
      {children}
    </button>
  );
}

/**
 * كلمةُ «الكلّ» وورقتُها. `word` غائبة ⇒ لا زرَّ يُرسم (القسمُ يكتفي بعنوانه باباً) والورقةُ تبقى تسمع الحدث.
 * `content` مرسومٌ في الخادم (الملصقاتُ مكوّناتُ خادم — سابقةُ D-644).
 */
export function HomeAllSheet({
  section,
  title,
  count,
  word,
  className = "",
  closeLabel,
  reorder,
  content,
}: {
  section: HomeAllSection;
  title: string;
  /** «٧ أعمال» — سطرٌ تحت العنوان */
  count: string;
  word?: string;
  className?: string;
  closeLabel: string;
  /** صفٌّ يُرتَّب: زرٌّ داخل الورقة يفتح ورقةَ الترتيب القائمة */
  reorder?: { row: QueueRow; label: string };
  content: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent).detail === section) setOpen(true);
    };
    window.addEventListener(HOME_ALL_EVENT, onOpen);
    return () => window.removeEventListener(HOME_ALL_EVENT, onOpen);
  }, [section]);
  const { handleProps, panelProps } = useSheetDragToDismiss(() => setOpen(false));
  const id = `home-all-${section}`;
  return (
    <>
      {word ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            tap(6);
            setOpen(true);
          }}
          className={className}
        >
          {word}
        </button>
      ) : null}
      <Sheet open={open} onClose={() => setOpen(false)} closeLabel={closeLabel} variant="bottom" anchor="bottom" labelledBy={id} className={panelProps.className} panelStyle={panelProps.panelStyle}>
        <SheetGrabHandle {...handleProps} />
        <p id={id} className="text-center font-bold text-15 pt-1 pb-1">
          {title}
        </p>
        <div className="flex items-center justify-between gap-3 px-4 pb-3 min-h-11">
          <span className="text-12 text-muted">{count}</span>
          {reorder ? (
            <button
              type="button"
              onClick={() => {
                tap(6);
                setOpen(false);
                /* بعد الإغلاق لا معه: ورقتان في إطارٍ واحدٍ تتنازعان قفلَ التمرير والتركيز */
                window.setTimeout(() => window.dispatchEvent(new CustomEvent(HOME_QUEUE_EVENT, { detail: reorder.row })), 0);
              }}
              className={buttonClass({ variant: "surface", size: "sm", className: "gap-2" })}
            >
              <Icon name="grip" size={16} className="text-accent" />
              <span>{reorder.label}</span>
            </button>
          ) : null}
        </div>
        {/* صفّان وإطلالةُ الثالث — والباقي يُمرَّر داخل الورقة */}
        <div className={`${sheetScroll} px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] max-h-[376px] sm:max-h-[448px]`}>{content}</div>
      </Sheet>
    </>
  );
}
