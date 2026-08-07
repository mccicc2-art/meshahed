"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWatchRegion } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { WATCH_REGIONS, regionName } from "@/lib/region";
import { tap } from "@/lib/haptics";
import { chipClass, chipRow } from "./ui/controls";

/**
 * اختيار بلد المشاهدة.
 *
 * رقائق لا مقسّم: خمسة عشر خياراً قائمةٌ مفتوحة تُمرَّر أفقياً، وهذا تعريف
 * عائلة الرقائق (D-016). المقسّم لثلاثةٍ معروفة لا لخمسة عشر.
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

  return (
    <div
      role="group"
      aria-label={t.regionSection}
      className={`${chipRow} ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex gap-2 w-max pb-1">
        {WATCH_REGIONS.map((r) => (
          <button
            key={r.code}
            type="button"
            aria-pressed={r.code === current}
            onClick={() => pick(r.code)}
            className={chipClass(r.code === current)}
          >
            {regionName(r.code, loc)}
          </button>
        ))}
      </div>
    </div>
  );
}
