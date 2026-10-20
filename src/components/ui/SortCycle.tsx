"use client";

import { Icon } from "../Icon";

/**
 * ====== زرُّ الترتيب الدوّار — «الأحدث ⌄» (🆕 D-1493) ======
 *
 * أحمد ٢٠ أكتوبر: «الأحدث وفيه سهم اضغطه وابدل بينهم» — المختارُ وحدَه ظاهر، والضغطةُ تنقل إلى التالي وتدور.
 * نظيرُ `apps/mobile/src/library/SortCycle.tsx` حرفاً، ونسخةٌ واحدةٌ لكلِّ ترتيبٍ من هذا النوع (القاعدة ٣).
 */
export function SortCycle<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (next: K) => void;
  label: string;
}) {
  const i = Math.max(0, options.findIndex((o) => o.key === value));
  const cur = options[i];
  const next = options[(i + 1) % options.length];
  return (
    <button
      type="button"
      onClick={() => (next && next.key !== value ? onChange(next.key) : undefined)}
      aria-label={`${label}: ${cur?.label ?? ""}`}
      title={next?.label}
      className="inline-flex items-center gap-1 text-14 font-semibold text-foreground hover:opacity-80 transition"
    >
      <span>{cur?.label ?? ""}</span>
      <Icon name="chevron-down" size={14} className="text-muted" />
    </button>
  );
}
