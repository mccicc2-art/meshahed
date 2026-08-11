"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import type { RailWin } from "@/lib/browse";

/**
 * رقائق نافذة صفّ «أفضل ١٠» — أسبوع/شهر/سنة (طلب أحمد نصاً، D-099).
 *
 * ثلاثة أزرار خفيفة في طرف عنوان الصفّ، ولكل صفٍّ نافذته المستقلة في
 * الرابط (`wm`/`ws`/`wa` — الافتراضي أسبوع يُحذف): تغيير نافذة الأفلام
 * لا يحرّك المسلسلات، والرابط يُشارَك بحالته. حلّت محلّ محور النافذة
 * العام الذي كان في ورقة الفلاتر — أداتان على نفس الصفوف لَبسٌ.
 *
 * `replace` لا `push` مع بقاء الموضع — لمسةُ فلترٍ لا تبديل صفحة
 * (قاعدة D-095)، وعشرات اللمسات لا تتكدس في تاريخ الرجوع (قصد D-023).
 */
export function RailWindowChips({
  param,
  value,
  locale,
}: {
  /** `wam` = نافذة صفّ أفلام الأنمي (D-169) */
  param: "wm" | "ws" | "wa" | "wam";
  value: RailWin;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();

  const opts: { v: RailWin; label: string }[] = [
    { v: "week", label: t.railWinWeek },
    { v: "month", label: t.railWinMonth },
    { v: "year", label: t.railWinYear },
  ];

  function go(v: RailWin) {
    if (v === value) return;
    tap(8);
    const p = new URLSearchParams(search.toString());
    if (v === "week") p.delete(param);
    else p.set(param, v);
    const qs = p.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <span
      role="group"
      aria-label={t.railWinGroup}
      className={`inline-flex items-center gap-1 transition-opacity ${pending ? "opacity-60" : ""}`}
    >
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={o.v === value}
          onClick={() => go(o.v)}
          className={`text-[11px] font-bold rounded-full px-2.5 py-1 border transition ${
            o.v === value
              ? "text-accent border-accent/40 bg-accent/10"
              : "text-muted border-transparent hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
