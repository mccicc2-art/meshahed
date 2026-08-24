"use client";

import { useState, useTransition } from "react";
import { setLocale } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { SettingsOptionRow, SettingsOptionList } from "./SettingsOptionRow";
import { SettingsExpandRow } from "./SettingsExpandRow";

/**
 * لغةُ الواجهة — **صفٌّ يقول اللغةَ الحاليّة، ولوحٌ تحته يبدّلها**
 * (D-555، ثمّ ⚖️ D-569: **الورقةُ السفليّةُ صارت توسّعاً في المكان**
 * بطلب أحمد — الحجّةُ في `SettingsExpandRow`).
 *
 * **وكان مقسَّماً بخطٍّ سفليّ داخل بطاقةٍ فيها عنوانٌ وفقرةُ شرح**:
 * **أربعةُ أسطرٍ لتبديلٍ بين لغتين** — **ولا تقول الصفحةُ في سطرِها
 * الأوّل ما اللغةُ المختارةُ الآن** بل تُترك للعين تبحث عن الخانة
 * المعلَّمة. **والصفُّ يقول القيمةَ في طرفه كبقيّة صفوف الإعدادات.**
 *
 * ⚠️ **والتحميلُ الكاملُ باقٍ لا `router.refresh()`** (D-162): إعادةُ
 * الرسم تترك `lang` و`dir` على حالهما — **فتُقرأ عربيّةٌ في صفحةٍ
 * اتّجاهُها إنجليزيّ.** **والذي تبدّل شكلُ الاختيار لا طريقُه.**
 *
 * ⚠️ **والورقةُ تُغلق باختيار اللغة نفسِه**: الصفحةُ ستُعاد كلُّها بعد
 * لحظة — **و«تمّ» فوق فعلٍ يُنفَّذ بمجرّد اللمس خطوةٌ زائدة.**
 */
export function LanguageRow({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const options: { id: Locale; label: string }[] = [
    { id: "ar", label: t.arabicLang },
    { id: "en", label: t.englishLang },
  ];
  const current = options.find((o) => o.id === locale)?.label ?? "";

  function pick(next: Locale) {
    if (next === locale || pending) return;
    start(async () => {
      await setLocale(next);
      window.location.reload();
    });
  }

  return (
    <SettingsExpandRow
      icon="compass"
      title={t.languageSection}
      value={current}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <div className={pending ? "opacity-60 pointer-events-none" : ""}>
        <SettingsOptionList label={t.languageSection}>
          {options.map((o) => (
            <SettingsOptionRow
              key={o.id}
              selected={o.id === locale}
              title={o.label}
              onSelect={() => pick(o.id)}
            />
          ))}
        </SettingsOptionList>
      </div>
    </SettingsExpandRow>
  );
}
