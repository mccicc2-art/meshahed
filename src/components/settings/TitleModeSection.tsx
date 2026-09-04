"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTitleMode } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import {
  TITLE_MODES,
  resolveMediaTitle,
  type TitleMode,
} from "@/core/titleMode";
import { SettingsOptionRow, SettingsOptionList } from "./SettingsOptionRow";
import { SettingsExpandRow } from "./SettingsExpandRow";

/**
 * **«عرض عناوين الأعمال»** (D-544، مواصفةُ أحمد المكتوبة).
 *
 * **ونفسُ عائلةِ `FontSizeSection` حرفاً** (D-466 → D-555): **خياراتٌ
 * رأسيّةٌ بعرضٍ كامل**، **ثمّ معاينة** — **ولا عائلةَ تحكّمٍ ثالثة**
 * (القاعدة ٣).
 *
 * 🆕 **والورقةُ صارت توسّعاً في المكان** (D-590، حكمُ أحمد: «كل
 * الإعدادات خلّها تضغط وتنزل مكانها») — **وكان هذا الصفُّ مؤجَّلاً
 * بالاسم في D-569 §4 («يتحوّلان بكلمةٍ منك»)، وهذه كلمتُه.**
 * **واللوحُ لا يُطوى عند الاختيار عمداً**: المعاينةُ تحته تُعاد
 * رسمُها بالوضع الجديد، **فتجريبُ الأوضاع الأربعة بأربع ضغطاتٍ لا
 * بأربع فتحات** (حجّةُ الثيم في D-569 نفسُها).
 *
 * ⚖️ **وسطورُ الشرح تحت كلِّ خيارٍ سقطت** (D-557، تصميمُ أحمد):
 * **سطرٌ واحدٌ فقط — «موصى به» تحت الخيار الافتراضيّ.**
 *
 * ⚠️ **والمعاينةُ ترسمها `resolveMediaTitle` نفسُها** لا نصٌّ مكتوبٌ
 * بيدٍ لكلِّ خيار: **جدولُ أمثلةٍ يُكتب مرّتين يفترق مرّةً** (D-145)،
 * **والمعاينةُ التي لا تمرّ بالمحرّك وعدٌ لا ضمان.**
 *
 * **ولا زرَّ حفظ**: كوكيٌّ واحدٌ يُكتب لحظةَ الضغط ثمّ `router.refresh()`
 * تُعيد رسمَ ما في الشاشة — **وزرُّ حفظٍ لخيارٍ واحد احتكاكٌ بلا مقابل**
 * (حجّةُ `RegionSwitch`).
 */

/** مثالان من مواصفة أحمد بعينها — عملٌ أجنبيٌّ وعملٌ عربيّ */
const SAMPLES: { localized: string; original: string; translit: string }[] = [
  { localized: "صراع العروش", original: "Game of Thrones", translit: "جيم أوف ثرونز" },
  { localized: "Hidden Secret", original: "عوالم خفية", translit: "عوالم خفية" },
];

export function TitleModeSection({
  locale,
  initialMode,
}: {
  locale: Locale;
  initialMode: TitleMode;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [mode, setMode] = useState<TitleMode>(initialMode);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const label: Record<TitleMode, string> = {
    localized: t.titleModeLocalized,
    original: t.titleModeOriginal,
    translit: t.titleModeTranslit,
    both: t.titleModeBoth,
  };
  /* ⚖️ 🆕 **الصوتيّةُ صارت للواجهتين** (D-593، حكمُ أحمد بلقطةٍ للورقة
     الإنجليزيّة: «هنا قلنا فيه خيار رابع الكتابة الصوتية») — **نقضٌ
     مسجَّلٌ لسطرٍ من مواصفة D-544 نفسِها** («يظهر عند استخدام الواجهة
     العربية فقط»): **صاحبُ الواجهة الإنجليزيّة قد يقرأ العربيّةَ ويريد
     أسماءَه بها** — وأحمد نفسُه الشاهد. **والحارسُ سقط من الكاتب
     والقارئ معاً** (D-177: حارسٌ على طرفٍ واحد ليس حارساً — وإسقاطُه
     من طرفٍ واحدٍ كذبٌ مثله). */
  const options = TITLE_MODES;

  function pick(next: TitleMode) {
    if (next === mode || pending) return;
    const previous = mode;
    setMode(next);
    start(async () => {
      try {
        await setTitleMode(next);
        /* **إعادةُ رسمٍ لا إعادةُ تحميل**: الاسمُ يُحلُّ على الخادم،
           **فتُعاد رسمةُ الخادم بالأسماء الجديدة** بلا صفحةٍ بيضاء. */
        router.refresh();
      } catch {
        setMode(previous);
      }
    });
  }

  return (
    <SettingsExpandRow
      icon="film"
      title={t.titleNamesTitle}
      value={label[mode]}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <div className={pending ? "opacity-60" : ""}>
        <SettingsOptionList label={t.titleModeSection}>
          {options.map((m) => (
            <SettingsOptionRow
              key={m}
              selected={m === mode}
              title={label[m]}
              subtitle={m === "localized" ? t.titleModeRecommended : undefined}
              onSelect={() => pick(m)}
              disabled={pending}
            />
          ))}
        </SettingsOptionList>

        <div className="mt-3 rounded-lg bg-surface-2 p-3 space-y-2">
          <p className="text-12 text-muted">{t.cpPreview}</p>
          {SAMPLES.map((sample, index) => {
            const result = resolveMediaTitle(
              locale === "en"
                ? {
                    localized: index === 0 ? sample.original : sample.localized,
                    original: sample.original,
                    translit: sample.translit,
                  }
                : sample,
              mode,
            );
            return (
              <div key={sample.original}>
                <p className="text-14 font-semibold leading-tight" dir="auto">
                  {result.primary}
                </p>
                {result.secondary ? (
                  <p className="text-12 text-muted leading-tight mt-0.5" dir="auto">
                    {result.secondary}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </SettingsExpandRow>
  );
}
