"use client";

import { useState, useTransition } from "react";
import { setDmPolicy } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { DM_POLICIES, type DmPolicy } from "@/core/dmPolicy";
import { flashError } from "@/lib/toast";
import { SettingsOptionRow, SettingsOptionList } from "./SettingsOptionRow";
import { SettingsExpandRow } from "./SettingsExpandRow";

/**
 * 🆕 D-1380 — «من يقدر يراسلني» (أحمد ١٢ أكتوبر: «ضيف في الخصوصية زر إغلاق الخاص»).
 * وصفةُ «حجم الخط» (`FontSizeSection`) حرفاً: صفٌّ يتوسّع في مكانه بثلاثة خيارات — لا عائلةَ تحكّمٍ ثالثة (القاعدة ٣).
 * الاختيارُ يُحفظ لحظةَ اللمس كالثيم؛ وإن رُفض يعود الصفُّ إلى قيمته ويقول السبب.
 */
export function DmPolicySection({ locale, initial }: { locale: Locale; initial: DmPolicy }) {
  const t = getDict(locale);
  const [value, setValue] = useState<DmPolicy>(initial);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const labels: Record<DmPolicy, string> = {
    everyone: t.dmPolicyEveryone,
    mutual: t.dmPolicyMutual,
    none: t.dmPolicyNone,
  };

  function pick(next: DmPolicy) {
    const prev = value;
    setValue(next);
    start(async () => {
      try {
        await setDmPolicy(next);
      } catch (e) {
        setValue(prev);
        flashError((e as Error).message);
      }
    });
  }

  return (
    <SettingsExpandRow icon="chat" title={t.dmPolicyLabel} value={labels[value]} open={open} onToggle={() => setOpen((v) => !v)}>
      <SettingsOptionList label={t.dmPolicyLabel}>
        {DM_POLICIES.map((p) => (
          <SettingsOptionRow key={p} selected={p === value} title={labels[p]} onSelect={() => pick(p)} />
        ))}
      </SettingsOptionList>
      <p className="px-1 pt-2 text-12 text-muted">{t.dmPolicyHint}</p>
    </SettingsExpandRow>
  );
}
