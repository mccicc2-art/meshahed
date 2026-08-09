"use client";

import { Icon, type IconName } from "../Icon";

/**
 * قائمة ترتيبٍ وإخفاء — **محرّك واحد لشاشتَي التخصيص** (D-129).
 *
 * كانت هذه الحلقة مكتوبةً مرّتين داخل `HomeCustomize` (الأقسام وخانات
 * بطاقة الأرقام)، وكانت شاشة البروفايل ستكتبها ثالثة. هي الآن مكوّنٌ
 * واحد يقبل سجلّ أسماءٍ: `HOME_SECTIONS` أو `HEADER_STATS` أو
 * `PROFILE_SECTIONS` — سجلّاتٌ ثلاثة، مصنعٌ واحد (قاعدة `06`).
 *
 * **الترتيب بأسهمٍ لا سحبٍ:** السحب على الجوال يتعارك مع تمرير الصفحة
 * ويحتاج مكتبة، والسهمان يؤدّيان الغرض بلا كليهما. والإخفاء من القائمة
 * نفسها — عينٌ مفتوحة أو مغلقة — فالمكان الذي تُرتّب فيه هو المكان الذي
 * تُخفي فيه.
 */
export function SectionOrderList<K extends string>({
  all,
  picked,
  meta,
  labels,
  min,
  max,
  onChange,
}: {
  /** السجلّ كاملاً — ما ليس في `picked` يُرسم مشطوباً في الذيل */
  all: readonly K[];
  /** المختار بترتيب عرضه */
  picked: readonly K[];
  meta: Record<K, { icon: IconName; label: string }>;
  labels: { up: string; down: string; hide: string; show: string };
  /** أقلّ ما يبقى مختاراً — دونه يُعطَّل زرّ الإخفاء (خانات الأرقام) */
  min?: number;
  /** أكثر ما يُختار — فوقه يُعطَّل زرّ الإظهار */
  max?: number;
  onChange: (next: K[]) => void;
}) {
  const hidden = all.filter((k) => !picked.includes(k));
  const atMin = min !== undefined && picked.length <= min;
  const atMax = max !== undefined && picked.length >= max;

  const rowCls =
    "flex items-center justify-between gap-3 px-3.5 py-3 border-b border-[color:var(--divider)] last:border-b-0";
  const iconBtn =
    "grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none transition";

  function move(k: K, dir: -1 | 1) {
    const next = [...picked];
    const i = next.indexOf(k);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function toggle(k: K) {
    if (picked.includes(k)) {
      if (atMin) return;
      onChange(picked.filter((s) => s !== k));
    } else {
      if (atMax) return;
      onChange([...picked, k]);
    }
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {picked.map((k, i) => (
        <div key={k} className={rowCls}>
          <span className="flex items-center gap-2.5 min-w-0 text-sm">
            <Icon name={meta[k].icon} size={18} className="text-muted shrink-0" />
            <span className="truncate">{meta[k].label}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => move(k, -1)}
              disabled={i === 0}
              aria-label={labels.up}
              title={labels.up}
              className={iconBtn}
            >
              <Icon name="chevron-up" size={16} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => move(k, 1)}
              disabled={i === picked.length - 1}
              aria-label={labels.down}
              title={labels.down}
              className={iconBtn}
            >
              <Icon name="chevron-down" size={16} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => toggle(k)}
              disabled={atMin}
              aria-label={labels.hide}
              title={labels.hide}
              className={iconBtn}
            >
              <Icon name="eye" size={16} />
            </button>
          </span>
        </div>
      ))}

      {hidden.map((k) => (
        <div key={k} className={`${rowCls} opacity-50`}>
          <span className="flex items-center gap-2.5 min-w-0 text-sm">
            <Icon name={meta[k].icon} size={18} className="text-muted shrink-0" />
            <span className="truncate line-through">{meta[k].label}</span>
          </span>
          <button
            type="button"
            onClick={() => toggle(k)}
            disabled={atMax}
            aria-label={labels.show}
            title={labels.show}
            className={`${iconBtn} shrink-0`}
          >
            <Icon name="eye-off" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * مفتاح إظهار/إخفاء — نفس مفتاح iOS في شاشتَي التخصيص.
 *
 * كان مكتوباً داخل `HomeCustomize` وحدها؛ استخراجُه هنا يمنع أن ترسم
 * شاشة البروفايل مفتاحاً ثانياً يختلف عنه بأربعة بكسلات.
 */
export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-3.5 py-3 border-b border-[color:var(--divider)] last:border-b-0 cursor-pointer">
      <span className="text-sm">{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      {/* مفتاح iOS: المسار يتلوّن والقرص ينزلق */}
      <span
        aria-hidden
        className="relative w-11 h-6.5 shrink-0 rounded-full transition peer-focus-visible:outline-2 peer-focus-visible:outline-accent bg-surface-2 peer-checked:bg-accent"
      >
        <span
          className={`absolute top-0.5 start-0.5 w-5.5 h-5.5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : ""
          }`}
        />
      </span>
    </label>
  );
}
