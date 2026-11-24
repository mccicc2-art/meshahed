"use client";

import { useState } from "react";
import { getDict, num, type Locale } from "@/core/i18n";
import type { FixItem } from "@/core/importFix";
import { applyImportFixesAction } from "@/lib/actions";
import { Icon } from "./Icon";
import { SettingsGroup } from "./settings/SettingsGroup";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsBottomSheet } from "./settings/SettingsBottomSheet";
import { sheetScroll } from "./ui/controls";

/**
 * ====== 🆕 T537 — ورقةُ «أعمال دخلت بالغلط سابقاً» (الويب) ======
 *
 * **لماذا**: استيرادٌ سابقٌ بالاسم أدخل غيرَ ما في ملفّه، وإعادةُ رفعِ الملفّ نفسِه تعرف ذلك (`core/importFix`). أحمد ٢٤ نوفمبر
 * «١أ»: لا يُنقل شيءٌ بلا تأكيده — كلُّ سطرٍ بعلامةٍ يرفعها إن أراد إبقاءه.
 * **كيف**: ورقةُ الإعدادات نفسُها — زرُّ «تمّ» فيها هو «صحّح» و«إلغاء» هو «لا، اتركها» — فلا زرَّ ثالثاً ولا ورقةَ ثانية.
 * والخادمُ يعيد الشروطَ كلَّها قبل أن يكتب، فما تغيّر بين العرض والضغط لا يُمسّ.
 */
export function ImportFixSheet({
  locale,
  items,
  onClose,
}: {
  locale: Locale;
  items: FixItem[];
  onClose: (done: { fixed: number; failed: number } | null) => void;
}) {
  const t = getDict(locale);
  const [on, setOn] = useState<Set<number>>(() => new Set(items.map((x) => x.wrongId)));
  const [busy, setBusy] = useState(false);
  const chosen = items.filter((x) => on.has(x.wrongId));

  const toggle = (id: number) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function apply() {
    if (!chosen.length || busy) return;
    setBusy(true);
    try {
      const r = await applyImportFixesAction(chosen.map(({ wrongId, rightId, rightTitle, rightPoster }) => ({ wrongId, rightId, rightTitle, rightPoster })));
      onClose({ fixed: r.fixed, failed: r.failed });
    } catch {
      onClose({ fixed: 0, failed: chosen.length });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsBottomSheet
      open
      title={t.importFixTitle}
      onCancel={() => (busy ? undefined : onClose(null))}
      onDone={() => void apply()}
      cancelLabel={t.importFixSkip}
      doneLabel={t.importFixApply(num(chosen.length, locale))}
      doneDisabled={busy || !chosen.length}
    >
      <div className={`${sheetScroll} px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
        <p className="text-12 text-muted leading-relaxed mb-3">{t.importFixHint(num(items.length, locale))}</p>
        <SettingsGroup>
          {items.map((x) => (
            <SettingsRow
              key={x.wrongId}
              title={x.rightTitle || x.wrongTitle}
              subtitle={t.importFixWas(x.wrongTitle)}
              onClick={() => toggle(x.wrongId)}
              trailing={<Icon name={on.has(x.wrongId) ? "check" : "minus"} size={18} className={on.has(x.wrongId) ? "text-accent" : "text-muted"} />}
            />
          ))}
        </SettingsGroup>
      </div>
    </SettingsBottomSheet>
  );
}
