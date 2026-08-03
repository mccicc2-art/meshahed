"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export interface FilterGroup {
  /** اسم المعامل في الرابط */
  param: string;
  label: string;
  /** أول قيمة هي الافتراضية وتُحذف من الرابط */
  options: { value: string; label: string }[];
}

/**
 * شريط فلاتر مربوط بالرابط لا بحالة داخلية.
 *
 * لماذا الرابط: الفلتر يصير قابلاً للمشاركة والرجوع بزر المتصفح، والصفحة
 * تُرسم على الخادم بالفلتر مطبَّقاً — فلا وميض قائمة قديمة قبل الجديدة.
 * والقيمة الافتراضية تُحذف من الرابط حتى يبقى نظيفاً.
 */
export function FilterBar({
  groups,
  resetLabel,
  keep = [],
}: {
  groups: FilterGroup[];
  resetLabel: string;
  /** معاملات تبقى كما هي عند تغيير أي فلتر (مثل التبويب) */
  keep?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function valueOf(g: FilterGroup) {
    const v = params.get(g.param);
    return g.options.some((o) => o.value === v) ? (v as string) : g.options[0].value;
  }

  function set(g: FilterGroup, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === g.options[0].value) next.delete(g.param);
    else next.set(g.param, value);
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function reset() {
    const next = new URLSearchParams();
    for (const k of keep) {
      const v = params.get(k);
      if (v) next.set(k, v);
    }
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const dirty = groups.some((g) => params.get(g.param) && params.get(g.param) !== g.options[0].value);

  return (
    <div
      className={`flex flex-col gap-2 transition-opacity ${pending ? "opacity-60" : "opacity-100"}`}
    >
      {groups.map((g) => (
        <div key={g.param} className="flex items-center gap-2">
          <span className="text-[11px] text-muted w-12 shrink-0">{g.label}</span>
          <div className="-mx-1 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-1.5 w-max">
              {g.options.map((o) => {
                const active = valueOf(g) === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => set(g, o.value)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition whitespace-nowrap ${
                      active
                        ? "bg-accent text-[color:var(--on-accent)] border-accent"
                        : "bg-surface text-muted border-border hover:text-foreground hover:border-accent/50"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {dirty && (
        <button
          onClick={reset}
          className="self-start text-[11px] text-muted hover:text-accent transition mt-0.5"
        >
          ✕ {resetLabel}
        </button>
      )}
    </div>
  );
}
