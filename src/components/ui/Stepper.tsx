"use client";

import { Icon } from "@/components/Icon";
import { tap } from "@/lib/haptics";

/**
 * 🆕 **العدّاد − / +** (T467، أحمد «١ج»: نسبةُ الأنواع في القائمة الذكيّة بخطوات ١٠٪).
 *
 * ⚠️ **عنصرٌ جديدٌ في النظام — قيل لأحمد قبل البناء**: لا عدّادَ قبله في الويب ولا في التطبيق، **والرقاقةُ والمقطعُ لا
 * يحملان قيمةً تزيد وتنقص**. **فلبس جسدَ الرقاقة بعينه** (`rounded-full border` وارتفاعُ `sm` وخطُّها) — **لا شكلاً ثالثاً**،
 * والفرقُ زرّان في طرفيه. ونظيرُه في التطبيق `ui/Stepper.tsx` بالمقاسات نفسِها.
 *
 * **والزرُّ الذي لا يتحرّك مطفأٌ لا مخفيّ** (D-046: لا شيءَ يتغيّر موضعُه بعد أن يُرسم)، **و«−» في بداية السطر**: ينقلب
 * مع الاتّجاه كما ينقلب كلُّ صفّ.
 */
export function Stepper({
  label,
  canDec,
  canInc,
  onDec,
  onInc,
  decLabel,
  incLabel,
}: {
  label: string;
  canDec: boolean;
  canInc: boolean;
  onDec: () => void;
  onInc: () => void;
  /** لقارئ الشاشة — الرمزُ وحدَه لا يقول أيَّ نوعٍ يتحرّك */
  decLabel: string;
  incLabel: string;
}) {
  const btn =
    "grid place-items-center h-7 w-7 rounded-full text-foreground hover:bg-surface-2 disabled:opacity-35 disabled:hover:bg-transparent transition";
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface px-0.5 py-0.5 text-12 font-semibold whitespace-nowrap">
      <button
        type="button"
        className={btn}
        disabled={!canDec}
        aria-label={decLabel}
        onClick={() => {
          tap(8);
          onDec();
        }}
      >
        <Icon name="minus" size={14} />
      </button>
      <span className="px-1 text-foreground tabular-nums" aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        className={btn}
        disabled={!canInc}
        aria-label={incLabel}
        onClick={() => {
          tap(8);
          onInc();
        }}
      >
        <Icon name="plus" size={14} />
      </button>
    </span>
  );
}
