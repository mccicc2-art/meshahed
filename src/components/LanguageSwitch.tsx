"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { segmentedItem, segmentedTrack } from "./ui/controls";

export function LanguageSwitch({
  locale,
  compact = false,
}: {
  locale: Locale;
  compact?: boolean;
}) {
  const t = getDict(locale);
  const [pending, start] = useTransition();

  /**
   * تحميلٌ كامل لا `router.refresh()` — نفس قاعدة D-162.
   *
   * هذا ثاني مبدّلٍ للّغة في التطبيق (الأوّل علمُ صفحة الهبوط)، وتركُ أحدهما
   * على `refresh` يعني **سلوكين لنفس الفعل** ينحرفان عند أوّل إصلاح — وهو
   * بالضبط ما تمنعه قاعدة D-145. والسبب نفسه: `refresh` يعيد رسم شجرة React
   * ويترك `lang` و`dir` وكلَّ ودجت طرفٍ ثالث على حالها القديم.
   */
  function pick(next: Locale) {
    if (next === locale || pending) return;
    start(async () => {
      await setLocale(next);
      window.location.reload();
    });
  }

  const options: { id: Locale; label: string }[] = [
    { id: "ar", label: t.arabicLang },
    { id: "en", label: t.englishLang },
  ];

  return (
    <div
      role="group"
      aria-label={t.languageSection}
      className={`${segmentedTrack} ${pending ? "opacity-60" : ""}`}
    >
      {options.map((o) => {
        const active = o.id === locale;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => pick(o.id)}
            aria-pressed={active}
            className={segmentedItem(
              active,
              compact ? "px-3.5 pt-1.5 pb-3 text-xs" : "px-5 pt-2 pb-3 text-sm",
              false,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
