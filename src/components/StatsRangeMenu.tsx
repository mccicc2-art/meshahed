"use client";

import { useState } from "react";
import Link from "next/link";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { Icon } from "./Icon";
import { getDict, type Locale } from "@/lib/i18n";
import type { StatsRange } from "./LibraryAnalysis";
import { tap } from "@/lib/haptics";

/**
 * 🆕 **قائمةُ «⋯» في ترويسة الإحصائيات = مُبدِّلُ المدى** (D-682).
 *
 * ⚖️ **وهي نقضُ عرضِ D-679 لا نقضُ جوهره**: تبويباتُ المدى المقسّمة
 * غادرت وجهَ الصفحة (مواصفةُ أحمد لا تحملها، **وزرُّ «⋯» بلا فعلٍ
 * كذبةُ D-217**) — **فالأداةُ انتقلت إلى القائمة ولم تمت**، والمدى
 * باقٍ في الرابط لا في حالةِ عميل (D-438/D-463): **الصفوفُ روابطُ.**
 *
 * ⚠️ **ولا تُرسم في إحصائيات عضوٍ آخر**: لا مدى هناك أصلاً (لا تواريخَ
 * تُقرأ للزائر) — **وقائمةٌ فارغةٌ زرٌّ يَعِد ولا يعطي.**
 */
export function StatsRangeMenu({ locale, current }: { locale: Locale; current: StatsRange }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  /* تسميةُ السنة تسميةُ التبويب السابق نفسُها — رقمُ السنة الجارية */
  const year = new Date().getUTCFullYear();

  const items: { key: StatsRange; label: string; href: string }[] = [
    { key: "all", label: t.statsRangeAll, href: "/stats" },
    { key: "year", label: String(year), href: "/stats?range=year" },
    { key: "month", label: t.statsRangeMonth, href: "/stats?range=month" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tap(8);
          setOpen(true);
        }}
        aria-label={t.statsRangeMenu}
        aria-haspopup="dialog"
        className="shrink-0 grid place-items-center w-11 h-11 -me-2 rounded-full text-foreground hover:text-accent active:scale-95 transition"
      >
        <Icon name="dots" size={20} />
      </button>

      {open && (
        <Sheet open onClose={() => setOpen(false)} closeLabel={t.closeLabel} labelledBy="stats-range-title">
          <SheetHeader id="stats-range-title" title={t.statsRangeMenu} closeLabel={t.closeLabel} onClose={() => setOpen(false)} />
          <div className="pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            {items.map((it) => (
              <Link
                key={it.key}
                href={it.href}
                scroll={false}
                onClick={() => setOpen(false)}
                aria-current={current === it.key ? "page" : undefined}
                className="flex items-center gap-3 w-full text-start px-5 py-3.5 text-sm font-semibold border-t border-[color:var(--divider)] first-of-type:border-t-0 transition active:bg-surface-2"
              >
                <span className="flex-1 min-w-0 truncate">{it.label}</span>
                {current === it.key && (
                  <Icon name="check-line" size={18} className="shrink-0 text-accent" aria-hidden />
                )}
              </Link>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
