"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWatchRegion } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { WATCH_REGIONS, regionName, regionFlag } from "@/lib/region";
import { tap } from "@/lib/haptics";
import { SettingsPickerPanel } from "./settings/SettingsPickerPanel";
import { SettingsExpandRow } from "./settings/SettingsExpandRow";

/**
 * اختيار بلد المشاهدة.
 *
 * **صفٌّ يقول البلدَ في طرفه** (D-555، مواصفةُ أحمد: «احذف قائمة الدول
 * الأفقيّة») — **وصفحةُ إعداداتٍ لا تُعلن قيمتَها الحاليّة تُفتح لتُقرأ
 * لا لتُغيَّر.**
 *
 * 🆕 **والورقةُ صارت توسّعاً في المكان** (D-590، حكمُ أحمد: «كل
 * الإعدادات خلّها تضغط وتنزل مكانها») — **وكان هذا الصفُّ مؤجَّلاً
 * بالاسم في D-569 §4، وهذه كلمتُه.** الخمسةَ عشرَ بلداً بلاطاتٌ تحت
 * الصفّ وفيها بحث — **والاختيارُ يطوي اللوحَ بنفسه**: خيارٌ واحدٌ لا
 * يبقى ما يُفعل بعده (حجّةُ «الاختيارُ هو تمّ» من الورقة، بلا ورقة).
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
    <SettingsExpandRow
      icon="compass"
      title={t.regionSection}
      value={`${regionFlag(current)} ${regionName(current, loc)}`}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <SettingsPickerPanel
        multi={false}
        options={WATCH_REGIONS.map((r) => ({
          key: r.code,
          label: `${regionFlag(r.code)}  ${regionName(r.code, loc)}`,
        }))}
        value={[current]}
        onChange={(next) => {
          setOpen(false);
          if (next[0]) pick(next[0]);
        }}
        labels={{
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
    </SettingsExpandRow>
  );
}
