"use client";

import { Sheet } from "../ui/Sheet";
import { buttonClass } from "../ui/Button";

/**
 * حوارُ «تغييراتٌ لم تُحفظ» — **البابُ الذي يمنع الخسارة الصامتة**
 * (D-462، مواصفةُ أحمد).
 *
 * **وكان الرجوعُ يمحو التعديل بلا كلمة**: الصفحةُ تُغلق، **والمستخدم لا
 * يعرف أنه خسر شيئاً حتى يعود فيجد الاسمَ القديم** — **وفعلٌ يخفي أثرَه
 * بلا علامةٍ ظاهرةٍ كذبة** (D-030).
 *
 * ⚠️ **و«تابع التعديل» هو الفعلَ الآمنَ لا «تجاهل»**: اللمسُ خارج
 * الورقة والهروبُ كلاهما يُبقيك مكانَك — **والخسارةُ لا تقع إلّا بضغطةٍ
 * مقصودةٍ على زرٍّ أحمر.**
 */
export function UnsavedChangesDialog({
  open,
  title,
  body,
  discardLabel,
  keepLabel,
  closeLabel,
  onDiscard,
  onKeep,
}: {
  open: boolean;
  title: string;
  body: string;
  discardLabel: string;
  keepLabel: string;
  closeLabel: string;
  onDiscard: () => void;
  onKeep: () => void;
}) {
  return (
    <Sheet open={open} onClose={onKeep} closeLabel={closeLabel} labelledBy="unsaved-title">
      <div className="px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
        <div>
          <h3 id="unsaved-title" className="text-[15px] font-bold">
            {title}
          </h3>
          <p className="text-[14px] text-muted leading-relaxed mt-1.5">{body}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onKeep} className={buttonClass({ full: true })}>
            {keepLabel}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className={buttonClass({ variant: "ghost", full: true, className: "!text-[color:var(--error)]" })}
          >
            {discardLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
