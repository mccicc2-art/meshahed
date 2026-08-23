"use client";

import type { ReactNode } from "react";
import { tap } from "@/lib/haptics";

/**
 * صفُّ خيارٍ — **قرصُ راديو في الصدر، وخياراتٌ رأسيّةٌ بعرضٍ كامل**
 * (D-555 → D-557، تصميمُ أحمد لصفحة «تفضيلات المحتوى»).
 *
 * **والعلّةُ التي وُلد منها:** «حجمُ الخطّ» و«عرضُ الأسماء» و«لغةُ
 * الواجهة» كانت كلُّها **مساراتِ رقائقَ أفقيّة**. **وأربعُ رقائقَ
 * بأسماءٍ عربيّةٍ طويلةٍ في شاشةِ ٣٩٠ بكسلاً تخرج عن الحافّة** —
 * **فيصير الخيارُ الرابع سرّاً يُكتشف بالسحب.** والعمودُ يُظهر الأربعةَ
 * جميعاً، **ويترك لكلِّ خيارٍ سطرَ شرحٍ لا يسعه عرضُ رقاقة.**
 *
 * ================= 🆕 والعلامةُ صارت راديو (D-557) =================
 *
 * **بُنيت في D-555 صحّاً أصفرَ في الطرف** — **وتصميمُ أحمد يضعها قرصَ
 * راديو في الصدر**: حلقةٌ صفراءُ فيها نقطةٌ صفراء للمختار، وحلقةٌ
 * رماديّةٌ فارغةٌ لغيره.
 *
 * **وهو أصحُّ مما بنيتُ، لا مجرّدَ ذوق:** **الصحُّ يقول «تمّ»
 * والراديو يقول «واحدٌ من هؤلاء»** — **وصحٌّ في طرف صفٍّ يُقرأ حالةً
 * منتهية، فيبدو الصفُّ الخالي من الصحّ صفّاً لم يُنجَز بعد** لا
 * خياراً لم يُختَر. **والقرصُ في الصدر يُرى قبل النصّ**، فتُقرأ
 * المجموعةُ مجموعةً من أوّل نظرة.
 *
 * ⚠️ **ولا خطوطَ فاصلةً بين الخيارات** (تصميمُه): **الأقراصُ في عمودٍ
 * واحدٍ تفصل الصفوفَ بنفسها** — **وخيطٌ بين كلِّ راديوين يجعل المجموعةَ
 * قائمةَ أوامرَ لا مجموعةَ اختيار.**
 *
 * ⚠️ **ودلالةُ الراديو لا الزرّ**: `role="radio"` داخل `radiogroup`
 * **يقول لقارئ الشاشة «واحدٌ من أربعة» ويقول أيُّها المختار** —
 * **وأربعةُ أزرارٍ متجاورةٍ تُقرأ أربعةَ أفعالٍ مستقلّة.**
 */
export function SettingsOptionRow({
  selected,
  title,
  subtitle,
  preview,
  onSelect,
  disabled = false,
}: {
  selected: boolean;
  title: string;
  /** سطرُ شرحٍ واحد — «موصى به» · متى يُستعمل هذا الخيار */
  subtitle?: string;
  /** معاينةٌ حيّةٌ للخيار نفسِه — لا نصٌّ يصفه */
  preview?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => {
        if (selected) return;
        tap(6);
        onSelect();
      }}
      className="w-full flex items-center gap-3 min-h-14 px-4 py-3 text-start transition rounded-control hover:bg-surface-2 active:opacity-80 disabled:opacity-50 disabled:pointer-events-none"
    >
      {/* **القرصُ حلقةٌ ونقطة** — **ولا يتبدّل مقاسُه بين الحالتين**
          فلا يزحف النصُّ عند كلِّ اختيار */}
      <span
        aria-hidden
        className={`shrink-0 grid place-items-center w-6 h-6 rounded-full border-2 transition ${
          selected ? "border-accent" : "border-[color:var(--border)]"
        }`}
      >
        <span
          className={`block w-3 h-3 rounded-full transition ${
            selected ? "bg-accent" : "bg-transparent"
          }`}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-15 font-semibold leading-tight truncate" dir="auto">
          {title}
        </span>
        {subtitle && (
          <span
            className="block text-12 font-medium text-muted leading-tight truncate mt-0.5"
            dir="auto"
          >
            {subtitle}
          </span>
        )}
        {preview && <span className="block mt-1.5">{preview}</span>}
      </span>
    </button>
  );
}

/**
 * حاضنةُ الخيارات — **مجموعةُ راديو واحدة، بلا بطاقةٍ ولا خيوط.**
 *
 * ⚖️ **وسقطت عنها البطاقةُ التي وُلدت بها في D-555**: **تصميمُ أحمد
 * يضع الخياراتِ داخل بطاقةِ القسم نفسِها** (`SettingsSection boxed`)
 * — **وبطاقةٌ داخل بطاقة هي العلّةُ التي وُلدت هذه الجولةُ كلُّها
 * لأجلها.**
 */
export function SettingsOptionList({
  label,
  children,
}: {
  /** وصفُ المجموعة لقارئ الشاشة — عنوانُ القسم نفسُه */
  label: string;
  children: ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1">
      {children}
    </div>
  );
}
