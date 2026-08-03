"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import type { LeaderTab } from "@/lib/leaderboard";

/**
 * تبويبات الأخبار كروابط لا كأزرار.
 *
 * الرابط يعني أن كل تبويب صفحة كاملة على الخادم يمكن مشاركتها والرجوع
 * إليها، وأن التبويب يعمل قبل أن يصل جافاسكربت.
 */
export function NewsTabs({ locale, active }: { locale: Locale; active: LeaderTab }) {
  const t = getDict(locale);
  const pathname = usePathname();
  const params = useSearchParams();

  const tabs: { key: LeaderTab; label: string }[] = [
    { key: "upcoming", label: t.tabUpcoming },
    { key: "rated", label: t.tabRated },
    { key: "watched", label: t.tabWatched },
  ];

  function hrefFor(key: LeaderTab) {
    // الفلاتر الزمنية والنوعية تنتقل مع التبويب، وفلتر المكتبة يخصّ
    // «القادم» وحده فيُسقَط عند الخروج منه
    const next = new URLSearchParams();
    if (key !== "upcoming") next.set("tab", key);
    for (const k of ["type", "range", "src"]) {
      const v = params.get(k);
      if (v && !(key === "upcoming" && k !== "type")) next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    // شبكة من ثلاثة لا صفّاً قابلاً للسحب: التبويبات الثلاثة ثابتة العدد،
    // والصفّ كان يدفع «الأكثر مشاهدة» خارج الشاشة على الجوال حتى وهو مُفعَّل
    <div role="tablist" className="grid grid-cols-3 gap-1.5 mb-4">
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={hrefFor(tab.key)}
            scroll={false}
            role="tab"
            aria-selected={on}
            className={`px-2 py-2.5 rounded-xl text-[13px] sm:text-sm font-bold border transition text-center leading-tight ${
              on
                ? "bg-accent text-[color:var(--on-accent)] border-accent"
                : "bg-surface text-muted border-border hover:text-foreground hover:border-accent/50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
