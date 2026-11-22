"use client";

import { getDict, num, type Locale } from "@/core/i18n";
import { importRunCounts, importRunTitle, importRunWhen, type ImportRun } from "@/core/importer";
import { SettingsBottomSheet } from "./settings/SettingsBottomSheet";
import { sheetScroll } from "./ui/controls";

/**
 * ====== 🆕 T507 — «استيراداتك» ======
 *
 * أحمد ٢٢ نوفمبر: «نسجل عندنا وعنده انه استورد من لتربوكسيد» ثمّ «١ أ — واذا ضغط عليه تظهر له استيراداته». صفٌّ لكلِّ استيراد
 * (`import_runs`، هجرة ٢٥٧): المصدرُ، ويومُه وساعتُه، والسطحُ، وحصيلتُه، و«أُوقف» إن أوقفه صاحبُه. **ورقةُ الإعدادات نفسُها**
 * ولونُ النجاح الواحد للحال — لا مكوّنَ ثانياً. والتطبيقُ يرسم الصفوفَ نفسَها (`apps/mobile/src/settings/ImportHistorySheet.tsx`).
 */
export function ImportHistorySheet({
  locale,
  open,
  runs,
  onClose,
}: {
  locale: Locale;
  open: boolean;
  runs: ImportRun[];
  onClose: () => void;
}) {
  const t = getDict(locale);
  return (
    <SettingsBottomSheet
      open={open}
      title={t.importRunsTitle}
      onCancel={onClose}
      onDone={onClose}
      cancelLabel={t.cancelLabel}
      doneLabel={t.doneLabel}
    >
      <div className={`${sheetScroll} px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
        <p className="text-12 text-muted leading-relaxed mb-3">{runs.length ? t.importRunsHint : t.importRunsEmpty}</p>
        {runs.length > 0 && (
        <ul className="rounded-control border border-border bg-surface-2 overflow-hidden">
          {runs.map((run) => (
            <li key={run.id} className="border-b last:border-b-0 border-[color:var(--divider)] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <b className="text-14 font-semibold truncate min-w-0">{importRunTitle(run.source, t)}</b>
                {/* حالٌ لا زرّ: نصٌّ بلون النجاح الواحد — رقاقةٌ تبدو قابلةً للضغط ولا تفعل شيئاً */}
                <span className={`ms-auto shrink-0 text-12 font-semibold ${run.status === "done" ? "text-[color:var(--success)]" : "text-muted"}`}>
                  {run.status === "done" ? t.importRunDone : t.importRunCancelled}
                </span>
              </div>
              <p className="text-12 text-muted mt-0.5">
                {importRunWhen(run.createdAt, locale === "en" ? "en" : "ar")} · {run.platform === "app" ? t.importRunApp : t.importRunWeb}
              </p>
              <p className="text-12 mt-0.5 leading-relaxed">{importRunCounts(run, t, (n) => num(n, locale))}</p>
            </li>
          ))}
        </ul>
        )}
      </div>
    </SettingsBottomSheet>
  );
}
