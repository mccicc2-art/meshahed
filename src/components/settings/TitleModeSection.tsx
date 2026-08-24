"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTitleMode } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import {
  TITLE_MODES,
  resolveMediaTitle,
  titleModeAllowed,
  type TitleMode,
} from "@/lib/titleMode";
import { SettingsOptionRow, SettingsOptionList } from "./SettingsOptionRow";
import { SettingsRow } from "./SettingsRow";
import { SettingsBottomSheet } from "./SettingsBottomSheet";

/**
 * **«عرض عناوين الأعمال»** (D-544، مواصفةُ أحمد المكتوبة).
 *
 * **ونفسُ عائلةِ `FontSizeSection` حرفاً** (D-466 → D-555): **خياراتٌ
 * رأسيّةٌ بعرضٍ كامل**، **ثمّ معاينة** — **ولا عائلةَ تحكّمٍ ثالثة**
 * (القاعدة ٣).
 *
 * 🆕 **والرقائقُ صارت عموداً** (مواصفةُ أحمد: «خيارات رأسيّة بعرض
 * كامل»): **أربعةُ خياراتٍ أسماؤها «حسب لغة التطبيق» و«الاسم الأصلي»
 * و«نطق عربي» و«المحلّي والأصلي معاً»** — **ومسارٌ أفقيٌّ يحملها في
 * شاشةِ ٣٩٠ بكسلاً يدفع نصفَها خلف الحافّة.**
 *
 * ⚖️ 🆕 **وسطورُ الشرح تحت كلِّ خيارٍ سقطت** (D-557، تصميمُ أحمد):
 * **في تصميمه سطرٌ واحدٌ فقط — «موصى به» تحت الخيار الافتراضيّ**،
 * **وما عداه اسمٌ مجرَّد.** **وكنتُ في D-555 أضعُ تحت كلِّ خيارٍ
 * مثالَه** (`صراع العروش · Hidden Secret`) — **وهو تكرارٌ لِما تقوله
 * المعاينةُ تحتها بالمحرّك نفسِه**، **ومثالان لشيءٍ واحدٍ في شاشةٍ
 * واحدة يجعل القارئ يقارنهما بدل أن يختار.**
 *
 * ⚠️ **والمعاينةُ ترسمها `resolveMediaTitle` نفسُها** لا نصٌّ مكتوبٌ
 * بيدٍ لكلِّ خيار: **جدولُ أمثلةٍ يُكتب مرّتين يفترق مرّةً** (D-145)،
 * **والمعاينةُ التي لا تمرّ بالمحرّك وعدٌ لا ضمان.** **فما تراه هنا هو
 * حرفيّاً ما سيُرسم في البطاقات.**
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
  /* **الصوتيّةُ تُسقط من القائمة في الواجهة الإنجليزية** — بنصِّ
     المواصفة، **والحارسُ مكرَّرٌ في الكاتب والقارئ** (D-177) فلا يكفي
     إخفاؤها هنا. */
  const options = TITLE_MODES.filter((m) => titleModeAllowed(m, locale));

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
    <>
      <SettingsRow
        icon="film"
        title={t.titleNamesTitle}
        value={label[mode]}
        onClick={() => setOpen(true)}
      />

      <SettingsBottomSheet
        open={open}
        title={t.titleNamesTitle}
        onCancel={() => setOpen(false)}
        onDone={() => setOpen(false)}
        cancelLabel={t.cancelLabel}
        doneLabel={t.doneLabel}
      >
        <div className={`p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] ${pending ? "opacity-60" : ""}`}>
          <SettingsOptionList label={t.titleModeSection}>
            {options.map((m) => (
              <SettingsOptionRow
                key={m}
                selected={m === mode}
                title={label[m]}
                subtitle={m === "localized" ? t.titleModeRecommended : undefined}
                onSelect={() => {
                  pick(m);
                  setOpen(false);
                }}
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
      </SettingsBottomSheet>
    </>
  );
}
