"use client";

import { useState } from "react";
import { SectionOrderList } from "../ui/SectionOrderList";
import { type IconName } from "../Icon";
import { sheetScroll } from "../ui/controls";
import { SettingsBottomSheet } from "./SettingsBottomSheet";

/**
 * ورقةُ الترتيب — **«رتّب الأقسام» شاشةٌ لا كتلةٌ في وسط الصفحة**
 * (D-555، مواصفةُ أحمد).
 *
 * ================= لماذا خرجت من الصفحة =================
 *
 * **صفحةُ «الرئيسية والملفّ» كانت ثلاثَ شاشاتٍ طولاً**: إحدى عشرةَ
 * قسماً في سجلٍّ يُسحب، وتسعُ خاناتٍ في سجلٍّ آخر، **وبينهما وبعدهما
 * مفاتيحُ ورقائق** — **وزرُّ الحفظ في القاع.** **فمن غيّر مفتاحاً في
 * الأعلى يمرّر شاشتين ليحفظه.**
 *
 * ⚠️ **والأخطرُ أن السحبَ داخل صفحةٍ تُمرَّر يتنازع مع تمريرِ الصفحة**
 * — **وهو نفسُ سببِ فصلِ وضعِ الترتيب في `ListDetail`.** **وفي ورقةٍ
 * لها تمريرُها الخاصّ لا تنازع**: الصفحةُ خلفها مقفلةٌ (`Sheet` تقفل
 * `overflow` على الجذر).
 *
 * ⚠️ **والترتيبُ مسوّدةٌ حتى «تمّ»**: **السحبُ عشرُ حركاتٍ متتالية**،
 * **و«إلغاء» يرمي العشرَ جميعاً** — وهو ما لا يستطيعه سجلٌّ يكتب في
 * الحالة مباشرةً.
 */
export function SettingsArrangeSheet<K extends string>({
  open,
  title,
  hint,
  all,
  picked,
  meta,
  labels,
  min,
  max,
  onCancel,
  onDone,
  cancelLabel,
  doneLabel,
}: {
  open: boolean;
  title: string;
  /** سطرٌ واحدٌ يقول ما تفعله الأسهمُ والمقبض */
  hint?: string;
  all: readonly K[];
  picked: readonly K[];
  meta: Record<K, { icon: IconName; label: string }>;
  labels: { up: string; down: string; hide: string; show: string; drag?: string };
  min?: number;
  max?: number;
  onCancel: () => void;
  onDone: (next: K[]) => void;
  cancelLabel: string;
  doneLabel: string;
}) {
  const [draft, setDraft] = useState<K[]>([...picked]);
  const [wasOpen, setWasOpen] = useState(open);

  /* بذرُ المسوّدة عند لحظةِ الفتح لا عند التركيب — **الورقةُ تبقى
     مركَّبةً بعد الإغلاق**، ولو بُذرت مرّةً لعادت في الفتحة الثانية
     تحمل ترتيباً ألغاه صاحبُه. (نمطُ هذا المستودع: `ListContinueCard`.) */
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setDraft([...picked]);
  }

  return (
    <SettingsBottomSheet
      open={open}
      title={title}
      onCancel={onCancel}
      onDone={() => onDone(draft)}
      cancelLabel={cancelLabel}
      doneLabel={doneLabel}
    >
      <div className={`${sheetScroll} px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
        {hint && <p className="px-1 mb-2 text-12 text-muted leading-relaxed">{hint}</p>}
        <SectionOrderList
          all={all}
          picked={draft}
          meta={meta}
          labels={labels}
          min={min}
          max={max}
          onChange={setDraft}
        />
      </div>
    </SettingsBottomSheet>
  );
}
