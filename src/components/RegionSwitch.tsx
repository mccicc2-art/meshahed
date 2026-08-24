"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWatchRegion } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { WATCH_REGIONS, regionName, regionFlag } from "@/lib/region";
import { tap } from "@/lib/haptics";
import { SettingsPickerSheet } from "./settings/SettingsPickerSheet";
import { SettingsRow } from "./settings/SettingsRow";

/**
 * اختيار بلد المشاهدة.
 *
 * 🆕 **صفٌّ يقول البلدَ وورقةٌ فيها بحث** (D-555، مواصفةُ أحمد: «احذف
 * قائمة الدول الأفقيّة»).
 *
 * ⚖️ **ونقضُ D-016 مسجَّلٌ باسمه**: كانت خمسةَ عشرَ رقاقةً في مسارٍ
 * **يُمرَّر أفقيّاً** — وهو تعريفُ عائلة الرقائق بحقّ. **لكنّ الشكوى
 * ليست في العائلة بل في التمرير الأفقيّ نفسِه**: **البلدُ المختارُ قد
 * يكون خلف الحافّة، فلا تقول الصفحةُ في سطرها الأوّل أين أنت** —
 * **وصفحةُ إعداداتٍ لا تُعلن قيمتَها الحاليّة تُفتح لتُقرأ لا لتُغيَّر.**
 * **والصفُّ يقولها في طرفه كبقيّة صفوف الإعدادات**، والورقةُ تحمل
 * الخمسةَ عشرَ وفيها بحث.
 *
 * والتغيير يُطبَّق فوراً بلا زرّ حفظ: هو كوكي واحد، ونتيجته تظهر في الشاشة
 * التالية التي تُفتح — وزرُّ حفظٍ لخيارٍ واحد احتكاكٌ بلا مقابل.
 */
export function RegionSwitch({ locale, region }: { locale: Locale; region: string }) {
  const t = getDict(locale);
  const loc = locale === "en" ? "en" : "ar";
  const router = useRouter();
  const [current, setCurrent] = useState(region);
  const [pending, start] = useTransition();

  function pick(code: string) {
    if (code === current || pending) return;
    const previous = current;
    setCurrent(code);
    tap(8);
    start(async () => {
      try {
        await setWatchRegion(code);
        router.refresh();
      } catch {
        setCurrent(previous);
      }
    });
  }

  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsRow
        icon="compass"
        title={t.regionSection}
        value={`${regionFlag(current)} ${regionName(current, loc)}`}
        onClick={() => setOpen(true)}
      />

      {/* **خيارٌ واحد: الاختيارُ هو «تمّ»** — والورقةُ تُغلق بما اختير */}
      <SettingsPickerSheet
        open={open}
        title={t.regionSection}
        multi={false}
        options={WATCH_REGIONS.map((r) => ({
          key: r.code,
          label: `${regionFlag(r.code)}  ${regionName(r.code, loc)}`,
        }))}
        picked={[current]}
        onCancel={() => setOpen(false)}
        onDone={(next) => {
          setOpen(false);
          if (next[0]) pick(next[0]);
        }}
        labels={{
          cancel: t.cancelLabel,
          done: t.doneLabel,
          search: t.regionSection,
          selected: t.cpSelected,
          clear: t.cpClear,
          all: t.cpAllCategories,
          empty: t.cpNothing,
          noMatch: t.cpNoMatch,
          remove: (n) => n,
          add: (n) => n,
        }}
      />
    </>
  );
}
