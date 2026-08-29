"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sheet, SheetHeader } from "@/components/ui/Sheet";
import { Icon } from "@/components/Icon";
import { PLUS_GATE_EVENT } from "@/lib/plusGate";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * مضيفُ بوّابة Loopz+ — يُركَّب مرّةً في التخطيط كمضيفَي التوست وبوّابة
 * الزائر (D-633).
 *
 * ⚠️ **ولا زرَّ شراءٍ اليوم عمداً**: بوّابةُ الدفع لم تُفتح بعد،
 * **وزرٌّ يَعِد بما لا يأتي أسوأُ من غيابه** (D-217). فالورقةُ تقول ما
 * تكسبه وكم يكلّف ومتى — **وتصمت عمّا لا تستطيع.** ويومَ تصل البوّابة
 * يصير السطرُ الأخيرُ زرّاً، ولا يتغيّر شيءٌ آخر.
 */
export function PlusGateHost({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(PLUS_GATE_EVENT, show);
    return () => window.removeEventListener(PLUS_GATE_EVENT, show);
  }, []);

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={() => setOpen(false)}
      closeLabel={t.closeLabel}
      variant="center"
      labelledBy="plus-gate-title"
    >
      <SheetHeader
        id="plus-gate-title"
        title={t.plusGateTitle}
        closeLabel={t.closeLabel}
        onClose={() => setOpen(false)}
      />
      <div className="px-5 pt-3 pb-5 flex flex-col gap-4">
        <p className="text-14 text-muted leading-relaxed">{t.plusGateHint}</p>

        {/* السعرُ يُقال ولا يُخفى: **من يُمنع يستحقّ أن يعرف الثمن في
            اللحظة نفسِها** — لا في صفحةٍ أخرى يبحث عنها. */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <Icon name="sparkle-star" size={18} className="text-accent shrink-0" />
          <div className="min-w-0">
            <p className="text-15 font-bold leading-none">{t.plusPrice}</p>
            {/* 🆕 **وسطرُ التجديد فرضٌ لا تحسين** (D-786): سعرُ السنة
                الأولى دائمٌ لكلِّ مشترِكٍ جديد، **وثمنٌ أوّلُ يُعرض بلا
                ذكر ما بعده هو الوعدُ الذي لا يُسلَّم** (D-217). */}
            <p className="mt-1 text-12 text-muted leading-none">{t.plusPriceRenew}</p>
            <p className="mt-1.5 text-12 text-muted leading-none">{t.plusSoon}</p>
          </div>
        </div>

        {/* **ومن يريد أن يرى ما يشتريه يُدَلّ عليه** — لا زرَّ شراءٍ
            هنا (D-217)، بل صفحةٌ تعدّ ما بُني فعلاً وما لم يُبنَ بعد. */}
        <Link
          href="/plus"
          className="text-12 font-bold text-accent hover:underline self-start"
          onClick={() => setOpen(false)}
        >
          {t.plusLearnMore}
        </Link>
      </div>
    </Sheet>
  );
}
